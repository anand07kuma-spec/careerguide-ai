"""Test the optional email sign-in, and the two ways it could quietly go wrong.

Clerk is an upgrade here, not the account: a student's work still belongs to the
device account the browser made for itself. That leaves exactly two failure modes
that a person using the site cannot see, and both are about trust rather than about
widgets:

  * a request that *names* a Clerk user id, so anyone could bind their own identity
    to a stranger's child record — which is why the id may only come from Clerk's
    own answer about a session token, and attaching still requires this app's bearer
    token;
  * a webhook URL that accepts unsigned JSON, which would be a door anyone can walk
    through and say "disconnect that account".

A third, quieter one: an unconfigured deployment pretending to work. Every route
here answers 503 and names the missing variable instead of returning a success that
linked nothing.

Nothing touches the network. `services/clerk.py` is handed a stand-in for `httpx`
that replies the way Clerk could — accepted, refused, half-formed, unreachable — and
the webhook is signed locally with a throwaway secret using the same library the
server uses to check it.

Runs against a throwaway database, never `careerguide.db`.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/clerk_auth_test.py
"""

from __future__ import annotations

import base64
import json
import os
import pathlib
import secrets
import sys
import tempfile
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

TEST_DB = pathlib.Path(tempfile.gettempdir()) / "careerguide_clerk_test.db"
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py
os.environ["DB_AUTO_SETUP"] = "false"
# The whole first section is "this deployment has no Clerk keys", and a key left
# over in a real .env would make that untestable.
for _var in ("CLERK_SECRET_KEY", "CLERK_WEBHOOK_SIGNING_SECRET"):
    os.environ.pop(_var, None)

import httpx  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import inspect, select  # noqa: E402
from svix import Webhook  # noqa: E402

from app import models  # noqa: E401,F401
from app.config import get_settings  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Assessment, Result, User  # noqa: E402
from app.services import assessment_bank  # noqa: E402
from app.services import clerk as clerk_service  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


def configure(secret_key: str = "", signing_secret: str = "") -> None:
    """Set Clerk's keys the way a deployment would, then make the app re-read them."""
    if secret_key:
        os.environ["CLERK_SECRET_KEY"] = secret_key
    else:
        os.environ.pop("CLERK_SECRET_KEY", None)
    if signing_secret:
        os.environ["CLERK_WEBHOOK_SIGNING_SECRET"] = signing_secret
    else:
        os.environ.pop("CLERK_WEBHOOK_SIGNING_SECRET", None)
    get_settings.cache_clear()


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def token_of(length: int) -> str:
    """A session token of a given size; Clerk's are long strings nobody reads."""
    return "ey." + "A" * max(0, length - 3)


class Reply:
    def __init__(self, status_code: int = 200, body: object = None) -> None:
        self.status_code = status_code
        self._body = body

    def json(self):
        if self._body is None:
            raise ValueError("Clerk answered with something that was not JSON")
        return self._body


class FakeHttpx:
    """A stand-in for the `httpx` module inside `services/clerk.py`.

    It records every call so the suite can prove what was sent and — just as
    importantly — that a request rejected before verification never reached Clerk
    at all.
    """

    HTTPError = httpx.HTTPError

    def __init__(self, reply: Reply | None = None, error: Exception | None = None) -> None:
        self.reply = reply
        self.error = error
        self.calls: list[dict] = []

    def post(self, url, headers=None, json=None, timeout=None):  # noqa: A002
        self.calls.append(
            {"url": url, "headers": dict(headers or {}), "json": dict(json or {}), "timeout": timeout}
        )
        if self.error is not None:
            raise self.error
        assert self.reply is not None, "the suite asked Clerk something it did not script"
        return self.reply


REAL_HTTPX = clerk_service.httpx


def use_clerk_api(user_id: str | None = None, reply: Reply | None = None,
                  error: Exception | None = None) -> FakeHttpx:
    """Make Clerk answer the way `user_id` says, and hand back the call log."""
    fake = FakeHttpx(reply or Reply(200, {"status": True, "user_id": user_id}), error)
    clerk_service.httpx = fake
    return fake


def service_call(session: str) -> tuple:
    try:
        return (200, clerk_service.verify_session_token(session))
    except HTTPException as exc:
        return (exc.status_code, exc.detail)


SECRET_KEY = "sk_test_" + secrets.token_hex(12)
SESSION = token_of(60)


def onboard(**values) -> dict:
    payload = {
        "role": "student",
        "display_name": "Asha",
        "preferred_language": "en",
        "consent_profile": True,
        "consent_age": "11-12",
    }
    payload.update(values)
    response = client.post("/api/auth/onboarding", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


Base.metadata.create_all(bind=engine)
client = TestClient(app)

print("\n=== 1. A deployment with no Clerk keys says so, in every direction")
asha = onboard()
token_a = asha["token"]
id_a = asha["user"]["id"]

status_response = client.get("/api/auth/clerk", headers=bearer(token_a))
check("an account can still ask whether email sign-in is offered",
      status_response.status_code == 200, status_response.text)
check("…and is told honestly that it is not",
      status_response.json()["linked"] is False and status_response.json()["available"] is False,
      status_response.text)
check("…in a sentence that promises nothing was lost",
      "lives in this browser" in status_response.json()["note"], status_response.json()["note"])

link_refused = client.post("/api/auth/clerk/link", headers=bearer(token_a),
                           json={"session": SESSION})
enter_refused = client.post("/api/auth/clerk/enter", json={"session": SESSION})
for label, refused in (("link", link_refused), ("enter", enter_refused)):
    check(f"/{label} answers 503 rather than a fake success",
          refused.status_code == 503, refused.text)
    check("…naming the variable the site owner has to set",
          "CLERK_SECRET_KEY" in refused.json()["detail"], refused.json())
    check("…and promising that this browser is still the account",
          "still the account" in refused.json()["detail"], refused.json()["detail"])

unsigned = client.post(
    "/api/webhooks/clerk",
    content=json.dumps({"type": "user.deleted", "data": {"id": "user_any"}}).encode(),
)
check("an unsigned webhook is refused while no signing secret exists",
      unsigned.status_code == 400, unsigned.text)
check("…and the answer never repeats the payload back",
      "user_any" not in unsigned.text, unsigned.text)

# Anonymous has to be arranged now that a session is a cookie: this client was handed one
# by the onboarding above and keeps it like a browser does, so the jar goes empty first.
client.cookies.clear()
check("disconnecting is allowed even with no keys set, because it promises nothing",
      client.delete("/api/auth/clerk/link", headers=bearer(token_a)).status_code == 200)
check("…while reading the status without a token is still refused",
      client.get("/api/auth/clerk").status_code == 401)

print("\n=== 2. How a session token becomes an identity (Clerk's answer, never the caller's)")
configure(secret_key=SECRET_KEY)
check("the same status call now reports that email sign-in is offered",
      client.get("/api/auth/clerk", headers=bearer(token_a)).json()["available"] is True)

verified = use_clerk_api("user_01ABC")
check("a real session yields Clerk's user id", service_call(SESSION) == (200, "user_01ABC"))
call = verified.calls[-1]
check("…asked of Clerk's own verify endpoint, not a URL a caller controls",
      call["url"] == "https://api.clerk.com/v1/tokens/verify", call["url"])
check("…with the server-side key, which never appears in a browser bundle",
      call["headers"].get("Authorization") == f"Bearer {SECRET_KEY}", call["headers"])
check("…and the session token itself, in the field Clerk asks for",
      call["json"] == {"session": SESSION}, call["json"])
check("…with a timeout, so a slow Clerk cannot hold a worker open forever",
      isinstance(call["timeout"], (int, float)) and call["timeout"] > 0, call["timeout"])

use_clerk_api("user_01ABC")
check("whitespace is trimmed rather than sent as part of the credential",
      service_call("  " + SESSION + " ") == (200, "user_01ABC")
      and clerk_service.httpx.calls[-1]["json"] == {"session": SESSION},
      clerk_service.httpx.calls[-1])

for label, reply, expect in (
    ("Clerk refuses a dead session", Reply(401, {"clerk_error": {"type": "invalid_session"}}), 401),
    ("Clerk says the session is not valid", Reply(200, {"status": False}), 401),
    ("Clerk agrees without naming a user", Reply(200, {"status": True}), 401),
    ("Clerk names a user that is not a string", Reply(200, {"status": True, "user_id": 7}), 401),
    ("Clerk answers in something that is not JSON", Reply(200, None), 502),
):
    use_clerk_api(reply=reply)
    code, message = service_call(SESSION)
    check(f"{label} → {expect}, and no identity is invented", code == expect, message)
    if expect == 401:
        check("…with a sentence a family can act on, not Clerk's error vocabulary",
              "sign in again" in str(message).lower(), message)

use_clerk_api(error=httpx.ConnectError("connection reset"))
code, message = service_call(SESSION)
check("Clerk being unreachable is a 502, never a silent pass", code == 502, message)
check("…and it says nothing was changed, so a retry is safe", "Nothing was changed" in message, message)

oversized = use_clerk_api("user_x")
for label, junk in (
    ("an empty token", ""),
    ("a token of blanks", "     "),
    ("a token larger than a session cookie", "A" * (clerk_service.MAX_SESSION_TOKEN + 1)),
):
    code, _ = service_call(junk)
    check(f"{label} is refused without asking Clerk", code == 401, code)
check("…and none of those requests left the process", oversized.calls == [], oversized.calls)
clerk_service.httpx = REAL_HTTPX

print("\n=== 3. Linking: a Clerk identity can only be attached by someone already signed in")
calls = use_clerk_api("user_01ABC")

client.cookies.clear()
naked = client.post("/api/auth/clerk/link", json={"session": SESSION})
check("linking without this app's bearer token is refused",
      naked.status_code == 401, naked.text)
check("…before Clerk is ever consulted, so a stolen Clerk session grabs nothing",
      calls.calls == [], calls.calls)

linked = client.post("/api/auth/clerk/link", headers=bearer(token_a), json={"session": SESSION})
check("the signed-in owner can attach the email sign-in",
      linked.status_code == 200 and linked.json()["linked"] is True, linked.text)
check("…recording the moment, so the account screen can say when",
      linked.json()["linked_at"] is not None, linked.json())
check("…without letting the server key into any response",
      SECRET_KEY not in linked.text, linked.text)

again = client.post("/api/auth/clerk/link", headers=bearer(token_a), json={"session": SESSION})
check("attaching the same identity twice changes nothing",
      again.status_code == 200 and again.json()["linked_at"] == linked.json()["linked_at"],
      again.text)

bilal = onboard(display_name="Bilal", age_range="9-10")
wrong = client.post("/api/auth/clerk/link", headers=bearer(bilal["token"]), json={"session": SESSION})
check("a second account cannot attach the same email", wrong.status_code == 409, wrong.text)
check("…and is told which screen fixes it", "Settings" in wrong.json()["detail"], wrong.json()["detail"])

use_clerk_api("user_999ZZZ")
other = client.post("/api/auth/clerk/link", headers=bearer(token_a), json={"session": token_of(40)})
check("an already-linked account is not silently re-pointed at another email",
      other.status_code == 409 and "another email" in other.json()["detail"], other.text)

with SessionLocal() as db:
    row = db.get(User, id_a)
    check("the pointer is the only thing written",
          row is not None and row.clerk_user_id == "user_01ABC" and row.clerk_linked_at is not None)
    check("…and the student's own name is untouched", row is not None and row.display_name == "Asha")
columns = {column["name"] for column in inspect(engine).get_columns("users")}
check("Clerk owns exactly two columns: a pointer and a timestamp",
      sorted(name for name in columns if name.startswith("clerk_"))
      == ["clerk_linked_at", "clerk_user_id"], sorted(columns))
check("…and no picture, phone number or avatar column exists to be filled",
      not [name for name in columns
           if any(word in name for word in ("avatar", "image", "phone"))],
      sorted(columns))
# The address columns that do exist hold only what an account typed into this app's own
# settings screen: `user.created` matches a Clerk address against them and never writes
# one, so the set is pinned here rather than left to grow quietly.
check("…and the only email columns are the four this app's own consent flow writes",
      {name for name in columns if "email" in name}
      == {"contact_email", "email_confirmed_at", "email_confirm_hash",
          "email_confirm_expires_at"}, sorted(columns))

print("\n=== 4. Entering from a new device")
use_clerk_api("user_01ABC")
entered = client.post("/api/auth/clerk/enter", json={"session": token_of(44)})
check("signing in elsewhere needs no bearer token — that is the whole point",
      entered.status_code == 200, entered.text)
body = entered.json()
check("…and it opens the same account, not a new one",
      body["user"]["id"] == id_a and body["user"]["display_name"] == "Asha", entered.text)
check("…carrying the profile and settings a dashboard needs",
      body["profile"] is not None and body["settings"] is not None, list(body))
new_token = body["token"]
check("…with a freshly issued token, not a copy of the old one",
      bool(new_token) and new_token != token_a)
check("…which reaches the child's own data",
      client.get("/api/auth/me", headers=bearer(new_token)).json()["user"]["id"] == id_a)
check("…while the original browser keeps working exactly as before",
      client.get("/api/auth/me", headers=bearer(token_a)).status_code == 200)
check("…and asking again from the same session issues another token rather than reusing one",
      client.post("/api/auth/clerk/enter", json={"session": token_of(44)}).json()["token"] != new_token)

use_clerk_api("user_never_linked")
nobody = client.post("/api/auth/clerk/enter", json={"session": token_of(44)})
check("an email that was never attached finds no account", nobody.status_code == 404, nobody.text)
check("…with instructions instead of a bare error",
      "connect the email" in nobody.json()["detail"], nobody.json()["detail"])
with SessionLocal() as db:
    check("…and no account was quietly created for it",
          len(list(db.scalars(select(User)))) == 2,
          [user.display_name for user in db.scalars(select(User))])

with SessionLocal() as db:
    dormant = db.get(User, id_a)
    assert dormant is not None
    dormant.is_active = False
    db.add(dormant)
    db.commit()
use_clerk_api("user_01ABC")
closed = client.post("/api/auth/clerk/enter", json={"session": token_of(44)})
check("a closed account is not reopened through Clerk", closed.status_code == 404, closed.text)
with SessionLocal() as db:
    revived = db.get(User, id_a)
    assert revived is not None
    revived.is_active = True
    db.add(revived)
    db.commit()
check("…and the account is fine once switched back",
      client.get("/api/auth/me", headers=bearer(token_a)).status_code == 200)

junk = client.post("/api/auth/clerk/enter", json={"session": "short"})
check("a string too short to be a session token is rejected at the door",
      junk.status_code == 422, junk.text)

print("\n=== 5. Disconnecting takes nothing away")
with SessionLocal() as db:
    finished = Assessment(user_id=id_a, assessment_type="interest", language="en",
                          status="completed")
    db.add(finished)
    db.flush()
    db.add(Result(assessment_id=finished.id, user_id=id_a, assessment_type="interest",
                  score_json={"totals": {"items": 30, "answered": 24}},
                  traits_json=[], detail_json={},
                  completed_at=datetime(2026, 10, 17, 10, 0, tzinfo=timezone.utc)))
    db.commit()

cut = client.delete("/api/auth/clerk/link", headers=bearer(token_a))
check("disconnecting reports the account as device-only again",
      cut.status_code == 200 and cut.json()["linked"] is False and cut.json()["linked_at"] is None,
      cut.text)
check("…and states plainly that nothing was deleted",
      "nothing was deleted" in cut.json()["note"].lower(), cut.json()["note"])
use_clerk_api("user_01ABC")
check("…while the email now finds no account elsewhere",
      client.post("/api/auth/clerk/enter", json={"session": token_of(44)}).status_code == 404)
check("…but the original browser still opens everything",
      client.get("/api/auth/me", headers=bearer(token_a)).json()["user"]["id"] == id_a)
with SessionLocal() as db:
    check("…and the finished questionnaire is still there",
          len(list(db.scalars(select(Result).where(Result.user_id == id_a)))) == 1)
check("…and the deployment still advertises that it offers email sign-in",
      client.get("/api/auth/clerk", headers=bearer(token_a)).json()["available"] is True)

print("\n=== 6. The webhook: signature first, every field after")
SIGNING_SECRET = "whsec_" + base64.b64encode(secrets.token_bytes(24)).decode()
configure(secret_key=SECRET_KEY, signing_secret=SIGNING_SECRET)


def sign(event: dict, secret: str = SIGNING_SECRET, msg_id: str | None = None,
         when: datetime | None = None) -> tuple[bytes, dict[str, str]]:
    """The bytes on the wire plus the headers Clerk would send. No network involved."""
    raw = json.dumps(event).encode()
    message_id = msg_id or f"msg_{secrets.token_hex(8)}"
    stamp = when or datetime.now(timezone.utc)
    signature = Webhook(secret).sign(msg_id=message_id, timestamp=stamp, data=raw.decode())
    return raw, {
        "svix-id": message_id,
        "svix-timestamp": str(int(stamp.timestamp())),
        "svix-signature": signature,
    }


def deliver(event: dict, **kwargs):
    raw, headers = sign(event, **kwargs)
    return client.post("/api/webhooks/clerk", content=raw, headers=headers)


with SessionLocal() as db:
    holder = db.get(User, id_a)
    assert holder is not None
    holder.clerk_user_id = "user_01ABC"
    holder.clerk_linked_at = datetime.now(timezone.utc)
    db.add(holder)
    db.commit()

deletion = {"type": "user.deleted", "data": {"id": "user_01ABC"}}
unsigned_deletion = client.post(
    "/api/webhooks/clerk", content=json.dumps(deletion).encode(),
    headers={"svix-id": "msg_x",
             "svix-timestamp": str(int(datetime.now(timezone.utc).timestamp()))},
)
check("a delivery with an id and a timestamp but no signature is refused",
      unsigned_deletion.status_code == 400, unsigned_deletion.text)
check("…signed with somebody else's secret too",
      deliver(deletion, secret="whsec_" + base64.b64encode(b"0" * 24).decode()).status_code == 400)
check("…and neither of them disconnected anything",
      client.get("/api/auth/clerk", headers=bearer(token_a)).json()["linked"] is True)

replayed = deliver(deletion, when=datetime.now(timezone.utc) - timedelta(minutes=30))
check("a correctly signed delivery from half an hour ago is refused as a replay",
      replayed.status_code == 400, replayed.text)
check("…and the link survived it",
      client.get("/api/auth/clerk", headers=bearer(token_a)).json()["linked"] is True)

_body, headers = sign(deletion)
swapped = client.post(
    "/api/webhooks/clerk",
    content=json.dumps({"type": "user.deleted", "data": {"id": "user_9999"}}).encode(),
    headers=headers,
)
check("a body rewritten after signing does not pass", swapped.status_code == 400, swapped.text)
check("…and the account it tried to disconnect still holds its pointer",
      client.get("/api/auth/clerk", headers=bearer(token_a)).json()["linked"] is True)

for kind, expected in (
    ("user.created", "nothing-to-sync"),
    ("user.updated", "nothing-to-sync"),
    ("user.updated_image_url", "nothing-to-sync"),
    ("session.created", "nothing-to-sync"),
    ("email.delivered", "ignored"),
):
    answer = deliver({"type": kind, "data": {"id": "user_01ABC", "email_address": "a@b.c"}})
    check(f"{kind} is answered honestly as {expected}",
          answer.status_code == 200 and answer.json()["handled"] == expected, answer.text)
with SessionLocal() as db:
    still = db.get(User, id_a)
    check("none of that copied a Clerk profile field into this database",
          still is not None and still.clerk_user_id == "user_01ABC"
          and "a@b.c" not in str([row[0] for row in db.execute(select(User.display_name)).all()]))

headless = deliver({"type": "user.deleted", "data": {}})
check("a deletion with no user id in it does nothing, and says so",
      headless.status_code == 200 and headless.json()["handled"] == "ignored", headless.text)
check("…rather than clearing every pointer it can see",
      client.get("/api/auth/clerk", headers=bearer(token_a)).json()["linked"] is True)

gone = deliver(deletion)
check("a genuine deletion is accepted",
      gone.status_code == 200 and gone.json()["handled"] == "disconnected", gone.text)
check("…reporting how many accounts it touched", gone.json()["accounts"] == 1, gone.text)
with SessionLocal() as db:
    freed = db.get(User, id_a)
    check("…by clearing the pointer, and only the pointer",
          freed is not None and freed.clerk_user_id is None and freed.clerk_linked_at is None
          and freed.display_name == "Asha" and freed.is_active is True)
check("…while the student keeps signing in from this browser",
      client.get("/api/auth/me", headers=bearer(token_a)).json()["user"]["id"] == id_a)
with SessionLocal() as db:
    check("…and their questionnaire is untouched",
          len(list(db.scalars(select(Result).where(Result.user_id == id_a)))) == 1)
use_clerk_api("user_01ABC")
reconnected = client.post("/api/auth/clerk/link", headers=bearer(token_a), json={"session": token_of(44)})
check("…so the same Clerk id can be attached again if it ever exists anew",
      reconnected.status_code == 200 and reconnected.json()["linked"] is True, reconnected.text)

configure(secret_key=SECRET_KEY)
afterwards = deliver(deletion)
check("switching the signing secret off stops every delivery, correctly signed or not",
      afterwards.status_code == 400, afterwards.text)
with SessionLocal() as db:
    left = db.get(User, id_a)
    check("…leaving the link it could not verify in place",
          left is not None and left.clerk_user_id == "user_01ABC")

print("\n=== 7. The profile page's list of finished questionnaires")
with SessionLocal() as db:
    older = Assessment(user_id=id_a, assessment_type="personality", language="hi",
                       status="completed")
    db.add(older)
    db.flush()
    own_personality = Result(
        assessment_id=older.id, user_id=id_a, assessment_type="personality",
        score_json={"totals": {"items": 24, "answered": 24}}, traits_json=[], detail_json={},
        completed_at=datetime(2026, 10, 15, 8, 30, tzinfo=timezone.utc))
    db.add(own_personality)
    db.add(Assessment(user_id=id_a, assessment_type="aptitude", language="en",
                      status="in_progress"))
    neighbour = User(role="student", display_name="Neel", preferred_language="en", is_active=True)
    db.add(neighbour)
    db.commit()
    foreign = Assessment(user_id=neighbour.id, assessment_type="interest", language="en",
                         status="completed")
    db.add(foreign)
    db.flush()
    db.add(Result(assessment_id=foreign.id, user_id=neighbour.id, assessment_type="interest",
                  score_json={}, traits_json=[], detail_json={},
                  completed_at=datetime(2026, 10, 18, 6, 0, tzinfo=timezone.utc)))
    db.commit()
    foreign_sitting = foreign.id

listing = client.get("/api/assessments/history", headers=bearer(token_a))
check("a student can list their own finished sittings", listing.status_code == 200, listing.text)
rows = listing.json()
check("…newest first",
      [row["completed_at"] for row in rows] == sorted((r["completed_at"] for r in rows), reverse=True),
      rows)
check("…one entry per finished questionnaire, so two here", len(rows) == 2, rows)
check("…a sitting still in progress is not on it",
      all(row["assessment_type"] != "aptitude" for row in rows), rows)
check("…and another student's sitting never appears",
      all(row["assessment_id"] != foreign_sitting for row in rows), rows)
interest_name = assessment_bank.instrument("interest")["name"]
check("…named in the language the page is read in",
      {row["assessment_type"]: row["name"] for row in rows}["interest"] == interest_name["en"], rows)
check("…carrying the counts the profile shows as '24 of 30 answered'",
      [(row["answered"], row["total"]) for row in rows] == [(24, 30), (24, 24)], rows)
check("…and the result id the report screen opens",
      all(isinstance(row["result_id"], int) and row["result_id"] > 0 for row in rows), rows)

hindi = client.get("/api/assessments/history?language=hi", headers=bearer(token_a))
hindi_names = {row["assessment_type"]: row["name"] for row in hindi.json()}
check("…or in Hindi when the interface is Hindi",
      hindi.status_code == 200
      and hindi_names["interest"] == (interest_name.get("hi") or interest_name["en"]), hindi.text)
check("…while each sitting keeps the language it was actually asked in",
      {row["assessment_type"]: row["language"] for row in rows}["personality"] == "hi", rows)
check("…and an unknown interface language falls back to English names",
      {row["assessment_type"]: row["name"]
       for row in client.get("/api/assessments/history?language=ta",
                             headers=bearer(token_a)).json()}["interest"] == interest_name["en"])

client.cookies.clear()
check("an anonymous request reaches nothing",
      client.get("/api/assessments/history").status_code == 401)
guardian = onboard(role="parent", display_name="Rina", relationship="mother",
                   student_name="Asha", consent_age="adult")
as_parent = client.get("/api/assessments/history", headers=bearer(guardian["token"]))
check("a parent cannot list a stranger's child by guessing an id",
      as_parent.status_code == 403, as_parent.text)
check("…and is pointed at their own dashboard instead",
      "parent dashboard" in as_parent.json()["detail"], as_parent.json())
check("…whose account carries no email sign-in of its own",
      client.get("/api/auth/clerk", headers=bearer(guardian["token"])).json()["linked"] is False)

clerk_service.httpx = REAL_HTTPX
configure()

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
