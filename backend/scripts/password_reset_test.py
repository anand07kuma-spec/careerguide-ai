"""The password-reset path, end to end, with every refusal it promises.

`email_auth_test.py` already walks the reset flow as one section of the wider
email-and-password suite. This file exists for the cases a recovery link has to get
right on its own, and for the two it never covered:

* the six outcomes in order — unknown address, invalid token, expired token, a used
  token, a token switched off by a newer mail, and the one success;
* the throttle in front of both routes, checked in its own process because a
  rate-limit counter is per process and the functional half of this file runs with
  the limits off;
* the guarantees a recovery mail must keep: the same sentence for every address, no
  token in any response, one session-per-reset revocation, and an unchanged password
  when a link is refused.

The transport is stubbed exactly as the other email suites stub it: no request leaves
this machine, and the "message" is the record of what would have been mailed.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/password_reset_test.py
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_password_reset_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
# The throttles have their own process below; in this one they would count the
# functional requests and turn a correct 400 into a 429 part-way through.
os.environ["RATE_LIMIT_ENABLED"] = "false"
for _key in ("RESEND_API_KEY", "FROM_EMAIL"):
    os.environ.pop(_key, None)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import AuthToken, User  # noqa: E402
from app.services import email as transport  # noqa: E402
from app.services import email_messages, passwords  # noqa: E402

PASS, FAIL = [], []

# A failed assertion prints its diagnostic, and CI keeps that output. The diagnostic
# must never carry a recovery link, the token inside it, an address, or the captured
# message — all of which this file handles on purpose. Redaction happens in one place
# so a new check cannot reintroduce the leak by passing a richer detail.
_LINK_RE = re.compile(r"https?://\S+")
_ADDRESS_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_SECRET_RE = re.compile(r"[A-Za-z0-9_-]{32,}")


def redact(value: object) -> str:
    """The printable form of a diagnostic: no link, no address, no token."""
    text = _LINK_RE.sub("<link>", str(value))
    text = _ADDRESS_RE.sub("<address>", text)
    text = _SECRET_RE.sub("<token>", text)
    return text[:200]


def report(label: str, condition, detail: object = "") -> str:
    """One result line. Split from `check` so a test can prove the redaction."""
    mark = "PASS" if condition else "FAIL"
    suffix = f" - {redact(detail)}" if detail != "" and not condition else ""
    return f"  [{mark}] {label}{suffix}"


def check(label: str, condition, detail: object = "") -> None:
    (PASS if condition else FAIL).append(label)
    print(report(label, condition, detail))


def section(title: str) -> None:
    print(f"\n=== {title}")


EMAIL = "reset.owner@example.com"
PASSWORD = "HarbourLight42"
NEW_PASSWORD = "QuietMeadow77"

sent: list[dict] = []
real_enabled, real_send = transport.enabled, transport.send


def fake_enabled() -> bool:
    return True


def fake_send(to, template_name, subject, context=None):
    sent.append(
        {
            "to": to,
            "template": template_name,
            "subject": subject,
            "context": dict(context or {}),
        }
    )
    return transport.Dispatch(True, transport.SENT)


def fresh() -> TestClient:
    return TestClient(app)


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def forgot(client: TestClient, address: str):
    return client.post("/api/auth/password/forgot", json={"email": address})


def reset(client: TestClient, token: str, password: str):
    return client.post("/api/auth/password/reset", json={"token": token, "password": password})


def token_from_last_mail() -> str:
    link = sent[-1]["context"]["reset_url"]
    return (parse_qs(urlparse(link).query).get("token") or [""])[0]


def login(client: TestClient, password: str):
    return client.post("/api/auth/email/login", json={"email": EMAIL, "password": password})


with TestClient(app) as client:
    section("1. an account that signs in with an address and a password")
    created = client.post(
        "/api/auth/email/register",
        json={
            "role": "student",
            "display_name": "Reset Owner",
            "email": EMAIL,
            "password": PASSWORD,
        },
    )
    check("registration succeeds", created.status_code == 201, created.text[:200])

    email_messages.transport.enabled = fake_enabled
    email_messages.transport.send = fake_send

    section("2. no mail configuration refuses honestly and reveals no account")
    email_messages.transport.enabled = real_enabled
    disabled = forgot(fresh(), EMAIL)
    check("with no key the request is refused with 503", disabled.status_code == 503, disabled.status_code)
    check("...naming the variables instead of pretending",
          "RESEND_API_KEY" in disabled.text and "FROM_EMAIL" in disabled.text, disabled.text[:200])
    check("...and nothing was queued or sent", len(sent) == 0, len(sent))
    email_messages.transport.enabled = fake_enabled

    section("3. every address gets one sentence; only a real one gets a mail")
    known = forgot(fresh(), EMAIL)
    unknown = forgot(fresh(), "nobody.here@example.com")
    check("a registered address is answered 200", known.status_code == 200, known.status_code)
    check("an unknown address is answered 200 too", unknown.status_code == 200, unknown.status_code)
    check("...with exactly the same body",
          known.json() == unknown.json(), (known.text, unknown.text))
    check("...and only the registered one produced a message",
          len(sent) == 1 and sent[0]["to"] == EMAIL, f"{len(sent)} captured")
    check("the message is the reset template", sent[0]["template"] == "password_reset.html", sent[0]["template"])

    first_token = token_from_last_mail()
    link = sent[0]["context"]["reset_url"]
    check("the mailed link names the site and the page a browser opens",
          link.startswith("https://") and "/reset-password?token=" in link,
          {"https": link.startswith("https://"), "reset page": "/reset-password?token=" in link})
    check("...and carries a token long enough to be unguessable", len(first_token) >= 40, len(first_token))
    check("no response ever carried the token",
          first_token not in known.text and first_token not in unknown.text)
    with SessionLocal() as db:
        row = db.scalar(select(User).where(User.login_email == EMAIL))
        check("only the digest is stored",
              row.password_reset_hash == passwords.reset_token_hash(first_token)
              and first_token not in (row.password_reset_hash or ""))
        check("the link expires within the configured window",
              row.password_reset_expires_at is not None
              and row.password_reset_expires_at <= datetime.now(timezone.utc) + timedelta(minutes=31))

    section("4. a token that never existed is refused and changes nothing")
    before = login(fresh(), PASSWORD).status_code
    bogus = reset(fresh(), "z" * 43, "WillowShade31")
    check("an invented token is refused", bogus.status_code == 400, bogus.text[:200])
    check("...with the same sentence an expired one gets",
          bogus.json().get("detail") == "This reset link is invalid or has expired. Ask for a new one.",
          bogus.text[:200])
    check("...and the current password still signs in", before == 200 and login(fresh(), PASSWORD).status_code == 200)

    section("5. an expired token is refused")
    with SessionLocal() as db:
        row = db.scalar(select(User).where(User.login_email == EMAIL))
        row.password_reset_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    expired = reset(fresh(), first_token, "WillowShade31")
    check("a link past its expiry is refused", expired.status_code == 400, expired.text[:200])
    check("...and the password is unchanged", login(fresh(), PASSWORD).status_code == 200)

    section("6. a newer mail switches the older link off")
    again = forgot(fresh(), EMAIL)
    second_token = token_from_last_mail()
    check("a second request is answered 200", again.status_code == 200, again.status_code)
    check("...and mails a different token", second_token and second_token != first_token)
    stale = reset(fresh(), first_token, "WillowShade31")
    check("the replaced link is refused", stale.status_code == 400, stale.text[:200])
    check("...and the newest one still works only once it is redeemed",
          login(fresh(), PASSWORD).status_code == 200)

    section("7. a successful reset changes the password and ends every old session")
    phone = fresh()
    laptop = fresh()
    phone_token = login(phone, PASSWORD).json().get("token", "")
    laptop_token = login(laptop, PASSWORD).json().get("token", "")
    check("two sessions exist before the reset", bool(phone_token) and bool(laptop_token))

    weak = reset(fresh(), second_token, "short")
    check("a weak password is refused with a reason", weak.status_code == 422, weak.text[:200])
    check("...and that refusal does not spend the link", login(fresh(), PASSWORD).status_code == 200)

    done = reset(fresh(), second_token, NEW_PASSWORD)
    check("the reset is accepted", done.status_code == 204, done.text[:200])
    check("...with no body that could echo the token", done.content == b"", done.content[:60])
    check("the old password stops working", login(fresh(), PASSWORD).status_code == 401)
    check("the new password signs in", login(fresh(), NEW_PASSWORD).status_code == 200)
    check("the phone's old session is gone",
          fresh().get("/api/auth/me", headers=bearer(phone_token)).status_code == 401)
    check("the laptop's old session is gone",
          fresh().get("/api/auth/me", headers=bearer(laptop_token)).status_code == 401)
    with SessionLocal() as db:
        row = db.scalar(select(User).where(User.login_email == EMAIL))
        check("the digest is cleared from the row", row.password_reset_hash is None)
        check("...the redemption is dated", row.password_reset_used_at is not None)
        check("...and the failed-sign-in counter is reset",
              (row.failed_login_count or 0) == 0 and row.locked_until is None)
        remaining = list(db.scalars(select(AuthToken).where(AuthToken.user_id == row.id)))
        check("only the session created after the reset remains", len(remaining) == 1, len(remaining))

    section("8. a used token cannot be used a second time")
    reused = reset(fresh(), second_token, "WillowShade31")
    check("the redeemed link is refused", reused.status_code == 400, reused.text[:200])
    check("...and the password it set is untouched",
          login(fresh(), NEW_PASSWORD).status_code == 200
          and login(fresh(), "WillowShade31").status_code == 401)

    section("9. the same answer for an address with no password account")
    google_only = fresh()
    with SessionLocal() as db:
        db.add(User(role="student", display_name="Google Only", preferred_language="en",
                    google_sub="google-subject-reset-test"))
        db.commit()
    before_sends = len(sent)
    google_answer = forgot(google_only, "google.only@example.com")
    check("an address no password account uses is answered 200", google_answer.status_code == 200)
    check("...with the same sentence", google_answer.json() == known.json())
    check("...and no mail", len(sent) == before_sends)

# Restore the transport for anything that imports this module later.
email_messages.transport.enabled = real_enabled
email_messages.transport.send = real_send

# ---------------------------------------------------------------- throttles
#
# A rate-limit counter lives in the process that holds it, so the limits are proven
# in a child process of their own with `RATE_LIMIT_ENABLED=true`. The default
# `auth_limit` is five a minute and `email_limit` ten, both keyed on the caller.
RATE_CHILD = r"""
import json, os, pathlib, sys, tempfile
ROOT = sys.argv[1]
sys.path.insert(0, ROOT)
db = pathlib.Path(tempfile.gettempdir()) / ("careerguide_rate_child_" + str(os.getpid()) + ".db")
if db.exists():
    db.unlink()
os.environ["DATABASE_URL"] = "sqlite:///" + db.as_posix()
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "true"
for key in ("RESEND_API_KEY", "FROM_EMAIL"):
    os.environ.pop(key, None)
from fastapi.testclient import TestClient
from app.database import engine
from app.main import app

result = {}
with TestClient(app) as client:
    reset_codes = []
    for _ in range(6):
        answer = client.post("/api/auth/password/reset",
                            json={"token": "z" * 43, "password": "WillowShade31"})
        reset_codes.append({"status": answer.status_code,
                            "retry_after": answer.headers.get("retry-after"),
                            "detail": (answer.json() or {}).get("detail", "")})
    result["reset"] = reset_codes

    forgot_codes = []
    for _ in range(11):
        answer = client.post("/api/auth/password/forgot",
                            json={"email": "somebody@example.com"})
        forgot_codes.append({"status": answer.status_code,
                            "retry_after": answer.headers.get("retry-after"),
                            "detail": (answer.json() or {}).get("detail", "")})
    result["forgot"] = forgot_codes

    unknown_after = client.post("/api/auth/password/forgot",
                                json={"email": "nobody.at.all@example.com"})
    result["unknown_after"] = {"status": unknown_after.status_code,
                               "detail": (unknown_after.json() or {}).get("detail", "")}
print("RESULT " + json.dumps(result))
engine.dispose()
db.unlink(missing_ok=True)
"""


def run_rate_child() -> dict:
    child_env = {
        key: value for key, value in os.environ.items() if key != "RATE_LIMIT_ENABLED"
    }
    child = subprocess.run(
        [sys.executable, "-c", RATE_CHILD, str(ROOT)],
        capture_output=True,
        text=True,
        env=child_env,
        cwd=str(ROOT),
    )
    for line in child.stdout.splitlines():
        if line.startswith("RESULT "):
            return json.loads(line[len("RESULT "):])
    detail = (child.stderr or child.stdout or "").strip()[-500:]
    raise RuntimeError(f"rate child did not report: {redact(detail)}")


section("10. both routes are throttled, and the answer is a sentence")
rates = run_rate_child()

reset_codes = rates["reset"]
check("the first five reset attempts are judged, not throttled",
      [entry["status"] for entry in reset_codes[:5]] == [400] * 5, reset_codes[:5])
check("the sixth reset attempt in the same minute is throttled",
      reset_codes[5]["status"] == 429, reset_codes[5])
check("...the refusal says a minute and carries Retry-After",
      reset_codes[5]["retry_after"] == "60"
      and "Too many attempts in a minute" in reset_codes[5]["detail"], reset_codes[5])

forgot_codes = rates["forgot"]
check("the first ten forgot requests are judged, not throttled",
      [entry["status"] for entry in forgot_codes[:10]] == [503] * 10, forgot_codes[:3])
check("the eleventh forgot request in the same minute is throttled",
      forgot_codes[10]["status"] == 429, forgot_codes[10])
check("...with Retry-After and the email sentence",
      forgot_codes[10]["retry_after"] == "60"
      and "too many email requests" in forgot_codes[10]["detail"].lower(), forgot_codes[10])
check("a throttled caller learns nothing about an address",
      "example.com" not in forgot_codes[10]["detail"])

section("11. a failed assertion cannot leak a link, a token or an address")
SENTINEL_TOKEN = "SentinelTokenNotReal0000000000000000abc"
SENTINEL_ADDRESS = "sentinel.reader@example.org"
SENTINEL_LINK = f"https://careerguide-web.vercel.app/reset-password?token={SENTINEL_TOKEN}"
captured = {
    "to": SENTINEL_ADDRESS,
    "template": "password_reset.html",
    "subject": "Choose a new password",
    "context": {"reset_url": SENTINEL_LINK},
}

line = report("a deliberately failing assertion", False, captured)
check("the failure still names what failed",
      "[FAIL]" in line and "deliberately failing assertion" in line)
check("...carries no link", "https://" not in line and "reset-password" not in line)
check("...carries no token", SENTINEL_TOKEN not in line and "SentinelToken" not in line)
check("...carries no address", SENTINEL_ADDRESS not in line and "example.org" not in line)
check("...while a harmless diagnostic survives",
      "[FAIL] round trip" in report("round trip", False, "status=204 count=2"))
mixed = redact(f"mailed {SENTINEL_ADDRESS} via {SENTINEL_LINK}")
check("a bare string is redacted before it is truncated",
      SENTINEL_ADDRESS not in mixed and SENTINEL_TOKEN not in mixed and "https://" not in mixed)

# The real printer, not only the formatter: a failing check() must emit the same
# redacted line. Its label is taken back out of the tally before anything else runs.
emitted = io.StringIO()
with contextlib.redirect_stdout(emitted):
    check("sentinel failure", False, captured)
printed = emitted.getvalue()
if FAIL and FAIL[-1] == "sentinel failure":
    FAIL.pop()
check("check() prints a redacted line",
      SENTINEL_TOKEN not in printed and SENTINEL_ADDRESS not in printed
      and "https://" not in printed and "[FAIL] sentinel failure" in printed)

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("\nFAILED:")
    for label in FAIL:
        print(f"  - {label}")
if DB_PATH.exists():
    engine.dispose()
    DB_PATH.unlink(missing_ok=True)
sys.exit(1 if FAIL else 0)
