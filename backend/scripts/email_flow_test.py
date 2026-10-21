"""Test the email paths: who may be mailed, what the queue does, and what a route says.

`email_test.py` proves the transport and the templates. This file proves the decisions
around them, which is where a feature like this actually goes wrong:

* **An address that has not been opened at cannot receive anything.** Not one message
  in here is produced by a typed string alone, and the suite checks that from the
  database as well as from the response — a double opt-in that only exists in a
  docstring is the worst kind of promise to make about a child's contact details.
* **Permission is per purpose.** A result copy and a weekly summary are two decisions,
  and the checks below turn on one and leave the other off to show the difference.
* **The queue is honest about what it did.** A row that could not be sent stays
  retryable, a row nobody agreed to closes, a row with no key waits without being
  charged an attempt, and a row older than the limit never arrives late.
* **Nothing is ever mailed twice for one event.** Two taps, two captures of one
  payment, and two drains of one week are each run here, and each must produce one
  message.

Nothing in this file talks to Resend, and neither does anything in the app while it
runs: the HTTP layer is replaced with a stub that records every ask, exactly the way
`payments_test.py` replaces Razorpay's. That is also what makes the "no address ever
reaches a log line" check possible at all. What it cannot prove is that a real mailbox
really receives a real message — that needs a test-mode key of your own, and the
README says so instead of implying otherwise.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/email_flow_test.py
"""

from __future__ import annotations

import base64
import json
import os
import pathlib
import re
import secrets
import sys
import tempfile
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_email_flow_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # the throttles themselves are in security_test.py
os.environ["CLERK_SECRET_KEY"] = "sk_test_" + secrets.token_hex(12)
for _key in ("RESEND_API_KEY", "FROM_EMAIL", "EMAIL_REPLY_TO"):
    os.environ.pop(_key, None)

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402
from svix.webhooks import Webhook  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    Career,
    ConsentRecord,
    EmailJob,
    Payment,
    Result,
    SavedCareer,
    StudentProfile,
    User,
)
from app.routers import payments  # noqa: E402
from app.services import email as transport  # noqa: E402
from app.services import email_consent as consent  # noqa: E402
from app.services import email_jobs as jobs  # noqa: E402
from app.services import email_messages as messages  # noqa: E402

PASS: list[str] = []
FAIL: list[str] = []


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def check(label: str, condition, detail: str = "") -> None:
    if condition:
        PASS.append(label)
        print(f"  [PASS] {label}")
    else:
        FAIL.append(label)
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail else ""))


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def env(**values: str | None) -> None:
    for key, value in values.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    get_settings.cache_clear()


def configure() -> None:
    """Point the settings at a mailbox that does not exist, on a key that does not."""
    env(RESEND_API_KEY="re_test_123", FROM_EMAIL="CareerGuide AI <hello@example.invalid>")


def unconfigure() -> None:
    env(RESEND_API_KEY="", FROM_EMAIL="")


class _Response:
    def __init__(self, status_code: int = 200, payload: dict | None = None) -> None:
        self.status_code = status_code
        self._payload = payload or {"id": "email_stub"}

    def json(self) -> dict:
        return self._payload


class _StubHttpx:
    """Stands in for the httpx module inside `services/email.py`."""

    HTTPError = httpx.HTTPError

    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.response = _Response()
        self.raises = False

    def post(self, url: str, **kwargs):
        self.calls.append({"url": url, **kwargs})
        if self.raises:
            raise _StubHttpx.HTTPError("connection reset")
        return self.response

    def reset(self) -> None:
        self.calls.clear()
        self.response = _Response()
        self.raises = False

    def addresses(self) -> list[str]:
        return [call["json"]["to"][0] for call in self.calls]


STUDENT = {
    "role": "student",
    "display_name": "Aarav",
    "preferred_language": "en",
    "class_level": "class-9",
    "interest_areas": ["drawing"],
    "consent_profile": True,
    "consent_voice": False,
    "consent_age": "11-12",
}
PARENT = {
    "role": "parent",
    "display_name": "Rakesh",
    "preferred_language": "en",
    "consent_profile": True,
    "consent_age": "adult",
}

client = TestClient(app)
STUB = _StubHttpx()
transport.httpx = STUB
LIFESPAN = ExitStack()
LIFESPAN.enter_context(client)


def signup(body: dict | None = None) -> tuple[str, int]:
    response = client.post("/api/auth/onboarding", json=body or STUDENT)
    assert response.status_code == 200, response.text[:300]
    data = response.json()
    return data["token"], data["user"]["id"]


def row(user_id: int) -> User | None:
    with SessionLocal() as db:
        found = db.get(User, user_id)
        if found is not None:
            db.expunge(found)
        return found


def jobs_for(user_id: int) -> list[EmailJob]:
    with SessionLocal() as db:
        rows = list(db.scalars(select(EmailJob).where(EmailJob.user_id == user_id)))
        for item in rows:
            db.expunge(item)
        return rows


def agree(token: str, scope: str, granted: bool = True) -> None:
    response = client.post(
        "/api/auth/consent", json={"scope": scope, "granted": granted}, headers=auth(token)
    )
    assert response.status_code == 200, response.text[:200]


def attach(token: str, address: str):
    return client.put("/api/email/address", json={"address": address}, headers=auth(token))


def token_from_last_call() -> str:
    """The confirmation link's token, read out of the message that was mailed.

    Not a shortcut — it is the only way the route under test could hand it over. The
    backend keeps a hash of it, so nothing here can compute the value from the account.
    """
    html = STUB.calls[-1]["json"]["html"]
    found = re.search(r"[?&]token=([A-Za-z0-9_-]{20,})", html)
    assert found, "no confirmation link in the message that was sent"
    return found.group(1)


def confirm_by_link(token: str, address: str) -> bool:
    """Attach and confirm an address the way a family actually does it."""
    response = attach(token, address)
    link = token_from_last_call()
    done = client.post("/api/email/confirm", json={"token": link})
    return done.status_code == 200 and done.json()["confirmed"]


def capture_stdout(fn) -> str:
    import io
    from contextlib import redirect_stdout

    buffer = io.StringIO()
    with redirect_stdout(buffer):
        fn()
    return buffer.getvalue()


def finish_questionnaire(token: str) -> int | None:
    """Start, answer and submit one sitting. Returns the result id."""
    from app.services import assessment_bank

    kind = assessment_bank.TYPES[0]
    started = client.post(f"/api/assessments/{kind}/start", json={"language": "en"}, headers=auth(token))
    if started.status_code != 200:
        return None
    assessment_id = started.json()["assessment_id"]
    items = client.get(
        f"/api/assessments/session/{assessment_id}/questions", headers=auth(token)
    ).json().get("items") or []
    for item in items:
        client.post(
            f"/api/assessments/session/{assessment_id}/answer",
            json={"code": item["code"], "value": "3"},
            headers=auth(token),
        )
    submitted = client.post(
        f"/api/assessments/session/{assessment_id}/submit", json={}, headers=auth(token)
    )
    assert submitted.status_code == 200, submitted.text[:200]
    with SessionLocal() as db:
        result = db.scalars(
            select(Result).where(Result.assessment_id == assessment_id)
        ).first()
        return result.id if result else None


# ---------------------------------------------------------------- 1. no key, no mail
section("1. a deployment that cannot mail says so")
unconfigure()
token_a, id_a = signup()
STUB.reset()

state = client.get("/api/email", headers=auth(token_a))
check("the settings route still answers, with the truth in it",
      state.status_code == 200 and state.json()["enabled"] is False, state.text[:200])
check("…and the sentence a family sees names the missing thing",
      "not switched on" in state.json()["note"], state.json())
check("…and no address is claimed", state.json()["address"] is None)
check("health reports it too", client.get("/api/health").json()["email_enabled"] is False)

refused = attach(token_a, "aarav@example.invalid")
check("attaching an address is not refused outright — it is saved for later",
      refused.status_code == 200 and refused.json()["reason"] == "disabled", refused.text[:200])
check("…but it says plainly that no link went out",
      refused.json()["delivered"] is False and "cannot mail" in refused.json()["note"],
      refused.json())
check("…and not one call was made to the email service", STUB.calls == [], STUB.calls)
check("the account now holds an unconfirmed address",
      row(id_a).contact_email == "aarav@example.invalid"
      and row(id_a).email_confirmed_at is None)

# ---------------------------------------------------- 2. typed is not the same as usable
section("2. the address has to be opened at before anything can use it")
configure()
STUB.reset()

bad = attach(token_a, "not-an-address")
check("a string that is not an address is refused outright",
      bad.status_code == 422, bad.text[:200])
check("…with a sentence rather than a field error",
      "not an email address" in bad.json()["detail"], bad.json())

again = attach(token_a, "aarav@example.invalid")
check("the address saved while email was off can now be sent a link",
      again.status_code == 200 and again.json()["delivered"] is True, again.text[:200])
check("…one call, to the address that was typed",
      len(STUB.calls) == 1 and STUB.addresses() == ["aarav@example.invalid"], STUB.addresses())
check("…and the token in that message is not what the database keeps",
      row(id_a).email_confirm_hash is not None
      and row(id_a).email_confirm_hash != token_from_last_call()
      and len(row(id_a).email_confirm_hash) == 64,
      row(id_a).email_confirm_hash)

link = token_from_last_call()
wrong = client.post("/api/email/confirm", json={"token": "x" * 32})
check("a link nobody minted confirms nothing",
      wrong.status_code == 200 and wrong.json()["confirmed"] is False, wrong.json())
check("…and it does not say why, beyond the one sentence that covers both cases",
      "does not match" in wrong.json()["note"], wrong.json())

done = client.post("/api/email/confirm", json={"token": link})
check("the real link confirms the address",
      done.json()["confirmed"] is True and "welcome" in done.json()["note"], done.json())
check("…and the account is switched on", row(id_a).email_confirmed_at is not None)
check("…with the spent token destroyed",
      row(id_a).email_confirm_hash is None
      and row(id_a).email_confirm_expires_at is None)
check("…and the welcome message was the second thing sent",
      len(STUB.calls) == 2 and "confirmed" in STUB.calls[1]["json"]["html"], len(STUB.calls))
replay = client.post("/api/email/confirm", json={"token": link})
check("opening the same link a second time confirms nothing",
      replay.json()["confirmed"] is False, replay.json())
check("…and sends nothing either", len(STUB.calls) == 2, len(STUB.calls))

after = client.get("/api/email", headers=auth(token_a)).json()
check("the state route now reports a confirmed address",
      after["confirmed"] is True and after["pending_confirmation"] is False, after)
check("…and both purposes still off, because confirming an address is not agreeing to mail",
      after["purposes"] == {"email_result": False, "email_digest": False}, after)

# ------------------------------------------------------------------- 3. per purpose
section("3. two purposes, two decisions")
STUB.reset()
result_id = finish_questionnaire(token_a)
check("a finished questionnaire exists to be mailed", result_id is not None)
queued_now = jobs_for(id_a)
check("…and submitting it queued exactly one copy for this account",
      len(queued_now) == 1 and queued_now[0].purpose == "email_result", queued_now)
check("…which closed itself as not agreed, because nobody agreed to anything",
      queued_now[0].status == jobs.SKIPPED and queued_now[0].detail == "not-agreed",
      [(j.status, j.detail) for j in queued_now])
check("…and nothing was sent", STUB.calls == [], STUB.calls)

asked = client.post(f"/api/email/result/{result_id}", headers=auth(token_a))
check("asking for a copy before agreeing is refused in words",
      asked.status_code == 200 and asked.json()["reason"] == "not-agreed", asked.text[:200])
check("…and the answer says which switch is missing",
      "not agreed" in asked.json()["note"].lower(), asked.json())

agree(token_a, "email_result")
STUB.reset()
sent = client.post(f"/api/email/result/{result_id}", headers=auth(token_a))
check("after agreeing, the same request sends the summary",
      sent.json()["delivered"] is True and STUB.addresses() == ["aarav@example.invalid"],
      sent.json())
check("…the message is the result one, not a welcome or a receipt",
      "Your " in sent.json()["note"] or "result" in STUB.calls[-1]["json"]["subject"].lower(),
      STUB.calls[-1]["json"]["subject"])
mail = STUB.calls[-1]["json"]["html"]
with SessionLocal() as db:
    draft = messages.BUILDERS["result"](db, row(id_a), result_id, None)
check("…and it carries the shaped summary, not the answers",
      set(draft.context) == {"lang", "name", "instrument", "instrument_label",
                             "completed_on", "traits", "result_url"}
      and all(set(entry) == {"label", "percent"} for entry in draft.context["traits"])
      and f"result={result_id}" not in mail,
      (sorted(draft.context), draft.context.get("traits")))

twice = client.post(f"/api/email/result/{result_id}", headers=auth(token_a))
check("asking again immediately does not mail a second copy",
      len(STUB.calls) == 1 and twice.json()["reason"] == "sent", twice.json())

digest_only = client.get("/api/email", headers=auth(token_a)).json()
check("the result agreement did not switch the weekly summary on",
      digest_only["purposes"] == {"email_result": True, "email_digest": False},
      digest_only)

other = client.post(f"/api/email/result/{result_id + 999}", headers=auth(token_a))
check("a result id that is not yours is not mailed, and is not found",
      other.status_code == 404, other.text[:200])

token_p, _ = signup(PARENT)
check("a parent account cannot ask for the child's result copy",
      client.post(f"/api/email/result/{result_id}", headers=auth(token_p)).status_code == 403)
check("…and an anonymous request gets nothing either",
      client.post(f"/api/email/result/{result_id}").status_code in (401, 403))

# --------------------------------------------------------------------- 4. the queue
section("4. what the queue does when a send does not work")
# A second family who agreed in advance, and a provider that is unreachable at the
# moment of sending. That order matters: the row then genuinely is where a retry
# starts, instead of being pushed back into that state by the test.
token_retry, id_retry = signup()
confirm_by_link(token_retry, "retry@example.invalid")
agree(token_retry, "email_result")
STUB.reset()
STUB.raises = True
unfinished = finish_questionnaire(token_retry)
check("a questionnaire finished while the mail service is down still finishes",
      unfinished is not None)

with SessionLocal() as db:
    job = db.get(EmailJob, jobs_for(id_retry)[0].id)
    check("…its copy of the result is left pending, charged with the one try it made",
          job.status == jobs.PENDING and job.attempts == 1, (job.status, job.attempts))
    check("…and the row says only the word, never the provider's error text",
          job.detail == "failed", job.detail)
    check("…and it is still a pointer to that one result",
          job.purpose == "email_result" and job.ref_id == unfinished,
          (job.purpose, job.ref_id))
    check("asking for the same copy twice returns that row, never a second one",
          jobs.enqueue(db, id_retry, "email_result", ref_id=unfinished).id == job.id)

    early = datetime.now(timezone.utc) + timedelta(minutes=5)
    check("the retry is not due yet, so a drain that arrives early leaves it alone",
          jobs.drain_for(db, id_retry, now=early) == 0)

    unconfigure()
    jobs.attempt(db, job, early)
    check("a deployment with no key does not burn an attempt it did not make",
          job.status == jobs.PENDING and job.attempts == 1 and job.detail == "disabled",
          (job.status, job.attempts, job.detail))
    configure()

    STUB.raises = False
    STUB.response = _Response(422, {"name": "validation_failed"})
    for _ in range(4):
        jobs.attempt(db, job, early + timedelta(hours=1))
    check("a mailbox that refuses the message four times is left failed, not retried",
          job.status == jobs.FAILED and job.attempts == 4, (job.status, job.attempts))
    check("…and the refusal is stored as a word, not as the provider's message",
          job.detail == "rejected", job.detail)

    # Asking again from the screen is where a queue lies most easily: a row the
    # provider has refused must report the refusal, not quietly start over.
    STUB.reset()
    again = client.post(f"/api/email/result/{unfinished}", headers=auth(token_retry))
    check("…and asking again reports the refusal instead of a second try",
          again.json()["reason"] == "rejected" and STUB.calls == [], again.json())
    check("…without pretending the row was forgotten",
          again.json()["delivered"] is False and again.json()["queued"] is False,
          again.json())

# ------------------------------------------------------------------- 5. the weekly note
section("5. the weekly summary, on a host with no clock")
now = datetime.now(timezone.utc)
monday = jobs.due_monday(now)
start, end = messages.week_bounds(monday)
# Two accounts that lived the whole week being summarised. Created today, an account
# has no finished week to report — `create_due_digests` says so on purpose — so the
# timestamp is moved back rather than the rule being worked around.
token_w, id_w = signup()
confirm_by_link(token_w, "week@example.invalid")
agree(token_w, "email_digest")
token_q, id_q = signup()
confirm_by_link(token_q, "quiet@example.invalid")
agree(token_q, "email_digest")
with SessionLocal() as db:
    for account in (id_w, id_q):
        old = db.get(User, account)
        old.created_at = start - timedelta(days=1)
    db.commit()

check("a summary is only ever about a week that has ended",
      end <= now, (monday, now))
# Asserted as a relation between two moments rather than as a date, because the suite is
# run on whatever day it happens to be: a check that named one Monday by value would pass
# for one week of the year and then fail in a way that reads like the code broke.
next_end = messages.week_bounds(monday + timedelta(days=7))[1]
check("…is a Monday", monday.weekday() == 0, monday)
check("…and the newest one, because the week after it has not ended yet",
      next_end > now, (monday, next_end, now))

with SessionLocal() as db:
    career = db.scalars(select(Career).limit(1)).first()
    db.add(SavedCareer(student_id=id_w, career_id=career.id, created_at=start + timedelta(hours=6)))
    db.commit()
    created = jobs.create_due_digests(db, now)
    check("both accounts that asked are queued for the week that ended",
          len(created) == 2, created)
    check("…and the one with something in its week is among them",
          any(job_id == db.scalars(
              select(EmailJob).where(EmailJob.user_id == id_w,
                                     EmailJob.purpose == "email_digest")
          ).first().id for job_id in created), created)
    again_created = jobs.create_due_digests(db, now)
    check("running it a second time in the same week queues nothing",
          again_created == [], again_created)
    mine = db.scalars(
        select(EmailJob).where(EmailJob.user_id == id_w, EmailJob.purpose == "email_digest")
    ).first()
    check("…and the row names the Monday it covers rather than a copy of anything",
          mine.ref_key == monday.isoformat() and mine.ref_id is None,
          (mine.ref_key, mine.ref_id))

STUB.reset()
with SessionLocal() as db:
    # The rows are due the moment they are written, so this drain runs on the live
    # clock: the frozen `now` above was captured before these two rows existed.
    report = jobs.drain(db, limit=50, now=datetime.now(timezone.utc))
    check("a drain sends it", report.sent >= 1, report.as_dict())
    body = STUB.calls[-1]["json"]["html"]
    check("…as the digest template", "week" in body.lower(), body[:200])
    check("…to the address on that account, not to anybody else's",
          STUB.addresses() == ["week@example.invalid"], STUB.addresses())
    quiet = db.scalars(
        select(EmailJob).where(EmailJob.user_id == id_q, EmailJob.purpose == "email_digest")
    ).first()
    check("an account with nothing in its week is closed rather than mailed",
          quiet is not None and quiet.status == jobs.SKIPPED
          and quiet.detail == "nothing-to-say",
          (quiet.status, quiet.detail) if quiet else "no row")

with SessionLocal() as db:
    stale = db.get(EmailJob, mine.id)
    stale.created_at = now - timedelta(hours=get_settings().email_stale_after_hours + 2)
    stale.status = jobs.PENDING
    stale.next_attempt_at = now
    db.commit()
    report = jobs.drain(db, limit=50, now=now)
    check("a row that has been waiting past the limit is closed as too old",
          report.staled >= 1 and db.get(EmailJob, mine.id).status == jobs.STALE,
          report.as_dict())

# --------------------------------------------------------------------- 6. a receipt
section("6. one payment, one receipt")
token_r, id_r = signup()
confirm_by_link(token_r, "paid@example.invalid")
STUB.reset()
with SessionLocal() as db:
    order = Payment(
        user_id=id_r, provider="razorpay", order_id="order_EmailFlow1", payment_id="pay_EmailFlow1",
        plan_code="pro_monthly", interval="monthly", amount_paise=29_900, currency="INR",
        status="created", receipt="cg-receipt-flow", adult_attested=True, test_mode=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(order)
    db.commit()
    order_id = order.id
    now = datetime.now(timezone.utc)
    first = payments._mark_captured(db, order, "pay_EmailFlow1", now)
    check("a captured payment queues a receipt", first is True, first)
    receipts = list(db.scalars(select(EmailJob).where(EmailJob.user_id == id_r)))
    check("…exactly one row, pointing at the payment rather than copying it",
          len(receipts) == 1 and receipts[0].purpose == "receipt"
          and receipts[0].ref_id == order_id, receipts)
    second = payments._mark_captured(db, order, "pay_EmailFlow1", now)
    check("the same payment captured twice produces nothing twice",
          second is False and len(list(db.scalars(
              select(EmailJob).where(EmailJob.user_id == id_r)))) == 1, second)
check("…and the receipt went to the account's confirmed address",
      STUB.addresses() == ["paid@example.invalid"], STUB.addresses())
check("…saying what was paid, in rupees",
      "299" in STUB.calls[-1]["json"]["html"] or "₹299" in STUB.calls[-1]["json"]["html"],
      STUB.calls[-1]["json"]["subject"])
check("…and, because this was a test-mode order, saying so",
      "test" in STUB.calls[-1]["json"]["html"].lower(), STUB.calls[-1]["json"]["html"][:300])

# ------------------------------------------------------------------- 7. an invitation
section("7. inviting a guardian, to an address that is never kept")
token_i, id_i = signup()
code = client.get("/api/auth/share-code", headers=auth(token_i)).json().get("code")
with SessionLocal() as db:
    holder = db.get(StudentProfile, id_i)
    holder.share_code = None
    db.commit()
STUB.reset()
no_code = client.post(
    "/api/email/invite-parent", json={"address": "guardian@example.invalid"}, headers=auth(token_i)
)
check("a student with no sharing code is told so rather than mailed a blank link",
      no_code.json()["reason"] == "no-code" and no_code.json()["delivered"] is False
      and STUB.calls == [], (no_code.json(), STUB.addresses()))
with SessionLocal() as db:
    holder = db.get(StudentProfile, id_i)
    holder.share_code = code
    db.commit()
check("…and with a code, the invitation goes out",
      client.post("/api/email/invite-parent", json={"address": "guardian@example.invalid"},
                  headers=auth(token_i)).json()["delivered"] is True, no_code.text[:200])
check("…to exactly the one address that was typed",
      STUB.addresses() == ["guardian@example.invalid"], STUB.addresses())
check("…and the code it needs is in the message",
      str(code) in STUB.calls[-1]["json"]["html"], STUB.calls[-1]["json"]["html"][:200])
check("…and it says what the adult will see before they agree to anything",
      "conversation" in STUB.calls[-1]["json"]["html"].lower()
      or "report" in STUB.calls[-1]["json"]["html"].lower())
with SessionLocal() as db:
    check("…and no account anywhere now holds that address",
          db.scalars(select(User).where(User.contact_email == "guardian@example.invalid")).first()
          is None)
check("…and a string that is not an address is refused as a bad request, not mailed",
      client.post("/api/email/invite-parent", json={"address": "nope"},
                  headers=auth(token_i)).status_code == 422)

# --------------------------------------------------------------- 8. Clerk's user.created
section("8. a Clerk sign-up can finish an address this app was waiting on")
SIGNING_SECRET = "whsec_" + base64.b64encode(secrets.token_bytes(24)).decode()
env(CLERK_WEBHOOK_SIGNING_SECRET=SIGNING_SECRET)


def deliver(event: dict) -> tuple[bytes, dict]:
    raw = json.dumps(event).encode()
    message_id = f"msg_{secrets.token_hex(8)}"
    stamp = datetime.now(timezone.utc)
    signature = Webhook(SIGNING_SECRET).sign(msg_id=message_id, timestamp=stamp, data=raw.decode())
    return raw, {
        "svix-id": message_id,
        "svix-timestamp": str(int(stamp.timestamp())),
        "svix-signature": signature,
    }


token_c, id_c = signup()
attach(token_c, "clerkperson@example.invalid")
STUB.reset()
unrelated = deliver({
    "type": "user.created",
    "data": {"id": "user_01NOBODY", "email_addresses": [
        {"id": "idn_1", "email_address": "stranger@example.invalid", "verified": True}]},
})
answer = client.post("/api/webhooks/clerk", content=unrelated[0], headers=unrelated[1])
check("a sign-up that has nothing to do with an account here mails nobody",
      answer.status_code == 200 and answer.json()["accounts"] == 0 and STUB.calls == [],
      (answer.json(), STUB.calls))

created = deliver({
    "type": "user.created",
    "data": {"id": "user_01MATCH", "email_addresses": [
        {"id": "idn_2", "email_address": "ClerkPerson@example.invalid", "verified": True}]},
})
answer = client.post("/api/webhooks/clerk", content=created[0], headers=created[1])
check("one that matches an address somebody typed here completes it",
      answer.json()["accounts"] == 1 and row(id_c).email_confirmed_at is not None,
      answer.json())
check("…and the welcome is the message that goes",
      len(STUB.calls) == 1 and STUB.addresses() == ["clerkperson@example.invalid"],
      STUB.addresses())
check("…matched without regard to capitalisation, and stored exactly as it was typed",
      row(id_c).contact_email == "clerkperson@example.invalid", row(id_c).contact_email)
check("…and the address in the payload was never copied anywhere new",
      client.get("/api/email", headers=auth(token_c)).json()["address"]
      == "clerkperson@example.invalid")

unverified = deliver({
    "type": "user.created",
    "data": {"id": "user_01UNVERIFIED", "email_addresses": [
        {"id": "idn_3", "email_address": "somebody@example.invalid", "verified": False}]},
})
token_u, id_u = signup()
attach(token_u, "somebody@example.invalid")
answer = client.post("/api/webhooks/clerk", content=unverified[0], headers=unverified[1])
check("an address Clerk has not verified confirms nothing here",
      answer.json()["accounts"] == 0 and row(id_u).email_confirmed_at is None, answer.json())

token_x, id_x = signup()
address_x = "replay@example.invalid"
attach(token_x, address_x)
replay_event = deliver({
    "type": "user.created",
    "data": {"id": "user_01TWICE", "email_addresses": [
        {"id": "idn_4", "email_address": address_x, "verified": True}]},
})
client.post("/api/webhooks/clerk", content=replay_event[0], headers=replay_event[1])
STUB.reset()
again = client.post("/api/webhooks/clerk", content=replay_event[0], headers=replay_event[1])
check("the same event delivered twice welcomes that person once",
      again.json()["accounts"] == 0 and STUB.calls == [], (again.json(), STUB.calls))

# ------------------------------------------------------------------------ 9. removal
section("9. taking the address back")
token_d, id_d = signup()
confirm_by_link(token_d, "leaving@example.invalid")
# Finished before the result agreement exists, so its copy closes as `not-agreed` and
# stays in the queue: the account can ask for it again later, which is exactly what
# happens below — after the address is gone.
result_d = finish_questionnaire(token_d)
agree(token_d, "email_result")
agree(token_d, "email_digest")
with SessionLocal() as db:
    jobs.enqueue(db, id_d, "email_digest", ref_key=monday.isoformat())
STUB.reset()
removed = client.delete("/api/email/address", headers=auth(token_d))
check("removing the address empties every column that held it",
      removed.json()["address"] is None and removed.json()["confirmed"] is False, removed.json())
check("…and switches off the agreements that could only have been used to mail it",
      removed.json()["purposes"] == {"email_result": False, "email_digest": False},
      removed.json())
check("…so nothing queued for it is left waiting",
      jobs_for(id_d) and all(j.status == jobs.SKIPPED for j in jobs_for(id_d)),
      [(j.status, j.detail) for j in jobs_for(id_d)])
with SessionLocal() as db:
    granted = list(db.scalars(
        select(ConsentRecord).where(ConsentRecord.user_id == id_d,
                                    ConsentRecord.scope == "email_result")
    ))
    check("…written as a fresh refusal rather than deleted, so the history stays true",
          granted and granted[-1].granted is False, [(g.granted) for g in granted])
    row_d = db.get(User, id_d)
    check("…including the confirmation itself", row_d.email_confirmed_at is None)
STUB.reset()
asked_after = client.post(f"/api/email/result/{result_d}", headers=auth(token_d))
check("…and a message asked for afterwards is refused in words, not silently dropped",
      asked_after.json()["reason"] == "no-address" and STUB.calls == [],
      (asked_after.json(), STUB.addresses()))

gone = client.delete("/api/email/address", headers=auth(token_d))
check("removing an address that is already gone is not an error",
      gone.status_code == 200 and gone.json()["address"] is None, gone.text[:200])

# ---------------------------------------------------------------- 10. the log lines
section("10. what leaves a trace")
printed = capture_stdout(
    lambda: transport.send("secret.person@example.invalid", "welcome.html", "hi", {"name": "x"})
)
check("a send writes a log line about itself", "[email]" in printed, printed[:200])
check("…and not one of them contains an address",
      "secret.person" not in printed and "example.invalid" not in printed, printed[:300])

LIFESPAN.close()
print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + ", ".join(FAIL))
