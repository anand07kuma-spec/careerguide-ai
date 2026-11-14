"""Test the email-and-password door: sign-up, sign-in, lockout and reset.

The other auth tests prove the device handshake and Google. This one covers the third
way in, and the things that are easy to get quietly wrong:

  * a password reaching the database, a log or a response in readable form;
  * a sign-up that quietly attaches itself to somebody else's Google or Clerk account
    because the typed address happens to match;
  * a wrong password and an unknown address answering differently;
  * a lockout that a restart or a reset does not lift, or one that never lifts;
  * a reset link that works twice, never expires, or leaves an old session signed in;
  * a reset that erases the account's other ways in instead of only its sessions.

Runs against a throwaway database, never `careerguide.db`.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/email_auth_test.py
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

TEST_DB = pathlib.Path(tempfile.gettempdir()) / "careerguide_email_auth_test.db"
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
# Lockout is per account and is proved below; the per-address throttle is proved in
# security_test.py. Ten deliberate failures would otherwise be cut off by the limiter
# before the lockout could be reached.
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["DB_AUTO_SETUP"] = "false"

from sqlalchemy import select  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import AuthToken, StudentProfile, User  # noqa: E402
from app.services import email as transport  # noqa: E402
from app.services import email_messages, passwords  # noqa: E402

Base.metadata.create_all(bind=engine)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


def fresh() -> TestClient:
    """A browser with its own empty cookie jar."""
    return TestClient(app)


client = fresh()

PASSWORD = "MangoTree42"
STUDENT_EMAIL = "Aarav.Sen@Example.com"
STUDENT_NORMAL = "aarav.sen@example.com"
DEVICE = "7c9e6679-7425-40de-944b-e07fc1f90ae7"


def register(**values) -> dict:
    payload = {
        "role": "student",
        "display_name": "Aarav Sen",
        "email": STUDENT_EMAIL,
        "password": PASSWORD,
        "device_id": DEVICE,
    }
    payload.update(values)
    response = client.post("/api/auth/email/register", json=payload)
    return response


def login(email: str, password: str, *, device_id: str | None = None, browser: TestClient | None = None):
    body: dict = {"email": email, "password": password}
    if device_id:
        body["device_id"] = device_id
    return (browser or fresh()).post("/api/auth/email/login", json=body)


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


print("\n=== 1. a student can create an account and is signed in at once")
created = register()
check("register answers 201", created.status_code == 201, created.text[:300])
student = created.json() if created.status_code == 201 else {}
check("a session token comes back", bool(student.get("token")))
check("the account has the role that was asked for", student.get("user", {}).get("role") == "student")
check("and the name that was typed", student.get("user", {}).get("display_name") == "Aarav Sen")
check("settings are created with it", bool(student.get("settings")))
check("the response carries no password or digest",
      PASSWORD not in created.text and "argon2" not in created.text)
check("registering also puts the session in a cookie the page cannot read",
      "cg_session" in created.headers.get("set-cookie", "").lower()
      and "httponly" in created.headers.get("set-cookie", "").lower(),
      created.headers.get("set-cookie"))

with SessionLocal() as db:
    row = db.scalar(select(User).where(User.id == student["user"]["id"]))
    stored_email = row.login_email
    stored_hash = row.password_hash
    profile = db.get(StudentProfile, student["user"]["id"])
    check("a student gets the profile shell, including a sharing code",
          profile is not None and bool(profile.share_code),
          profile and profile.share_code)
    check("the address is stored trimmed and in one case, so two spellings are one account",
          stored_email == STUDENT_NORMAL, stored_email)
    check("the password is stored as an Argon2id digest", (stored_hash or "").startswith("$argon2id$"), (stored_hash or "")[:16])
    check("…which is not the password", stored_hash != PASSWORD and PASSWORD not in (stored_hash or ""))
    check("the digest has its own salt and work factors inside it", "m=19456" in (stored_hash or "") and "t=2" in (stored_hash or ""))

me = client.get("/api/auth/me")
check("the cookie session is accepted by /me", me.status_code == 200, me.text[:200])
check("/me never returns the digest", "argon2" not in me.text and PASSWORD not in me.text)

print("\n=== 2. signing in from another browser")
other = fresh()
signed_in = login(STUDENT_EMAIL.upper(), PASSWORD, browser=other)
check("the right password signs in", signed_in.status_code == 200, signed_in.text[:300])
body = signed_in.json() if signed_in.status_code == 200 else {}
check("…and returns the same account", body.get("user", {}).get("id") == student["user"]["id"])
check("…with its profile", body.get("profile") is not None, body.get("profile"))
check("the new session works on /me",
      other.get("/api/auth/me", headers=bearer(body.get("token", ""))).status_code == 200)

print("\n=== 3. a parent can do the same, and gets no student profile")
parent = fresh()
parent_email = "Meera.Rao@Example.com"
made = parent.post("/api/auth/email/register", json={
    "role": "parent",
    "display_name": "Meera Rao",
    "email": parent_email,
    "password": "NeemLeaf77",
})
check("a parent account is created", made.status_code == 201, made.text[:300])
parent_body = made.json() if made.status_code == 201 else {}
check("with the parent role", parent_body.get("user", {}).get("role") == "parent")
check("and no student profile", parent_body.get("profile") is None, parent_body.get("profile"))
check("but settings, so the app shell renders",
      parent_body.get("settings", {}).get("language") == "hinglish")
check("a parent can sign in again",
      login(parent_email, "NeemLeaf77").status_code == 200)

print("\n=== 4. one address, one account")
duplicate = register(email="AARAV.SEN@example.com")
check("a second sign-up for the same address is refused with 409", duplicate.status_code == 409, duplicate.text[:300])
check("…and the answer says to sign in instead", "sign in" in duplicate.text.lower(), duplicate.text[:300])

# An address already used for notifications is still an existing account's address.
with SessionLocal() as db:
    notice = User(role="parent", display_name="Notice Owner", preferred_language="en")
    db.add(notice)
    db.flush()
    notice.contact_email = "taken@example.com"
    db.commit()
conflict = fresh().post("/api/auth/email/register", json={
    "role": "student",
    "display_name": "Someone Else",
    "email": "taken@example.com",
    "password": "PepperMint99",
})
check("an address already stored on another account is refused too", conflict.status_code == 409, conflict.text[:300])

print("\n=== 5. validation happens before anything is stored")
for label, payload, expected in [
    ("too short", {"password": "Mango7"}, "at least 10"),
    ("no digit", {"password": "MangoTreeOnly"}, "letter and one digit"),
    ("no letter", {"password": "1234567890"}, "letter and one digit"),
    ("a common password", {"password": "password123"}, "easy to guess"),
    ("the address itself", {"email": "aarav42@example.com", "password": "Aarav42@example.com"},
     "not your email address"),
    ("empty name", {"display_name": "   "}, "name"),
    ("an invalid address", {"email": "not-an-address"}, ""),
    ("a role that is not a role", {"role": "teacher"}, ""),
]:
    values = {
        "role": "student",
        "display_name": "Test Person",
        "email": "validation@example.com",
        "password": PASSWORD,
    }
    values.update(payload)
    response = fresh().post("/api/auth/email/register", json=values)
    check(f"{label} is refused", response.status_code == 422, response.text[:200])
    if expected:
        check(f"…and says why: {expected}", expected in response.text.lower(), response.text[:200])

extra = fresh().post("/api/auth/email/register", json={
    "role": "student",
    "display_name": "Test Person",
    "email": "extra@example.com",
    "password": PASSWORD,
    "is_admin": True,
})
check("a field the API does not document is refused, not ignored", extra.status_code == 422, extra.text[:200])
with SessionLocal() as db:
    check("no account was created by any refused sign-up",
          db.scalar(select(User).where(User.login_email == "validation@example.com")) is None)

print("\n=== 6. a wrong password and an unknown address answer the same way")
wrong = login(STUDENT_EMAIL, "WrongPassword9")
unknown = login("nobody@example.com", "WrongPassword9")
check("a wrong password is refused", wrong.status_code == 401, wrong.text[:200])
check("an unknown address is refused", unknown.status_code == 401, unknown.text[:200])
check("with exactly the same sentence",
      wrong.json().get("detail") == unknown.json().get("detail"),
      (wrong.text, unknown.text))
with SessionLocal() as db:
    row = db.scalar(select(User).where(User.login_email == STUDENT_NORMAL))
    check("a failed sign-in is counted on the account", (row.failed_login_count or 0) == 1, row.failed_login_count)

print("\n=== 7. ten failures lock the account for a quarter of an hour")
lock_email = "lock@example.com"
lock_account = fresh().post("/api/auth/email/register", json={
    "role": "student",
    "display_name": "Lock Test",
    "email": lock_email,
    "password": "CedarWood31",
})
check("the lockout fixture is created", lock_account.status_code == 201, lock_account.text[:200])
for attempt in range(10):
    answer = login(lock_email, "NotThePassword1")
    if attempt < 9:
        check(f"failure {attempt + 1} is an ordinary 401", answer.status_code == 401, answer.status_code)
locked = login(lock_email, "CedarWood31")
check("the correct password is refused while the lockout holds", locked.status_code == 429, locked.text[:200])
check("…with a Retry-After the browser can read", bool(locked.headers.get("retry-after")), locked.headers)
check("…and a sentence about waiting", "wait" in locked.text.lower(), locked.text[:200])
with SessionLocal() as db:
    row = db.scalar(select(User).where(User.login_email == lock_email))
    check("the lockout is stored on the account, not only in this process",
          row.locked_until is not None and row.locked_until > datetime.now(timezone.utc))
    # A lockout that never lifts would be a permanent denial of the account.
    row.locked_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()
check("once the lockout has passed, the right password works again",
      login(lock_email, "CedarWood31").status_code == 200)
with SessionLocal() as db:
    row = db.scalar(select(User).where(User.login_email == lock_email))
    check("…and the failure count starts over", (row.failed_login_count or 0) == 0, row.failed_login_count)
    check("…with no lock recorded", row.locked_until is None, row.locked_until)

print("\n=== 8. a reset needs a working mail service, and says so honestly")
disabled = fresh().post("/api/auth/password/forgot", json={"email": STUDENT_EMAIL})
check("with no mail configuration the request is refused with 503", disabled.status_code == 503, disabled.text[:200])
check("…naming what is missing rather than pretending",
      "RESEND_API_KEY" in disabled.text and "FROM_EMAIL" in disabled.text, disabled.text[:300])

# Capture the mail instead of sending it. Both halves of the transport are replaced:
# `enabled` decides whether the route may proceed, `send` is where the link leaves.
sent: list[dict] = []
real_enabled, real_send = transport.enabled, transport.send


def fake_enabled() -> bool:
    return True


def fake_send(to, template_name, subject, context=None):
    sent.append({"to": to, "template": template_name, "subject": subject, "context": dict(context or {})})
    return transport.Dispatch(True, transport.SENT)


email_messages.transport.enabled = fake_enabled
email_messages.transport.send = fake_send

print("\n=== 9. forgot answers the same for every address, and mails only a real one")
known = fresh().post("/api/auth/password/forgot", json={"email": STUDENT_EMAIL})
unknown_mail = fresh().post("/api/auth/password/forgot", json={"email": "not-registered@example.com"})
check("a registered address gets an ordinary 200", known.status_code == 200, known.text[:200])
check("an unknown address gets a 200 too", unknown_mail.status_code == 200, unknown_mail.text[:200])
check("…and exactly the same sentence",
      known.json().get("message") == unknown_mail.json().get("message"), known.text)
check("only the real address caused a message", len(sent) == 1, sent)
check("the message is the reset template", sent and sent[0]["template"] == "password_reset.html", sent)
check("…sent to the sign-in address, not a notification one",
      sent and sent[0]["to"] == STUDENT_NORMAL, sent)

context = sent[0]["context"] if sent else {}
reset_url = context.get("reset_url", "")
token = (parse_qs(urlparse(reset_url).query).get("token") or [""])[0]
check("the link carries a token", bool(token), reset_url)
check("…and names the page a browser can open", reset_url.startswith("http") and "/reset-password" in reset_url, reset_url)
rendered = transport.render("password_reset.html", context)
rendered_hi = transport.render("password_reset.html", {**context, "lang": "hi"})
check("the template renders the link and the expiry in English and in Hindi",
      token in rendered and "30" in rendered and token in rendered_hi and "पासवर्ड" in rendered_hi)
with SessionLocal() as db:
    row = db.scalar(select(User).where(User.login_email == STUDENT_NORMAL))
    check("only the digest of the token is stored",
          row.password_reset_hash == passwords.reset_token_hash(token) and token not in (row.password_reset_hash or ""))
    check("the token expires soon rather than lasting as long as a session",
          row.password_reset_expires_at is not None
          and row.password_reset_expires_at <= datetime.now(timezone.utc) + timedelta(minutes=31))
    check("the reset response never carried the token",
          token not in known.text and token not in unknown_mail.text)

print("\n=== 10. the reset link sets a password, once, and ends every session")
# Two live sessions, the way a phone and a laptop would hold them.
phone = fresh()
laptop = fresh()
phone_login = login(STUDENT_EMAIL, PASSWORD, device_id="phone-device-0001", browser=phone)
laptop_login = login(STUDENT_EMAIL, PASSWORD, device_id="laptop-device-0002", browser=laptop)
phone_token = phone_login.json().get("token", "")
laptop_token = laptop_login.json().get("token", "")
check("two sessions exist before the reset", bool(phone_token) and bool(laptop_token))

bad_policy = fresh().post("/api/auth/password/reset", json={"token": token, "password": "short"})
check("a weak new password is refused with a reason", bad_policy.status_code == 422, bad_policy.text[:200])
still_valid = fresh().post("/api/auth/password/reset", json={"token": token, "password": "BambooGrove58"})
check("…and the link is not spent by that refusal", still_valid.status_code == 204, still_valid.text[:200])

check("the old password stops working", login(STUDENT_EMAIL, PASSWORD).status_code == 401)
new_login = login(STUDENT_EMAIL, "BambooGrove58")
check("the new password works", new_login.status_code == 200)
check("the phone's old session is revoked",
      fresh().get("/api/auth/me", headers=bearer(phone_token)).status_code == 401)
check("the laptop's old session is revoked too",
      fresh().get("/api/auth/me", headers=bearer(laptop_token)).status_code == 401)
reused = fresh().post("/api/auth/password/reset", json={"token": token, "password": "WillowBranch63"})
check("the same link cannot be used twice", reused.status_code == 400, reused.text[:200])
with SessionLocal() as db:
    row = db.scalar(select(User).where(User.login_email == STUDENT_NORMAL))
    check("the token is cleared from the row", row.password_reset_hash is None)
    check("…and the day it was used is kept", row.password_reset_used_at is not None)
    remaining = list(db.scalars(select(AuthToken).where(AuthToken.user_id == row.id)))
    check("every session from before the reset is gone, leaving only the new sign-in",
          len(remaining) == 1, len(remaining))

print("\n=== 11. a link that has expired is refused the same way as one that never existed")
second = fresh().post("/api/auth/password/forgot", json={"email": STUDENT_EMAIL})
second_token = (parse_qs(urlparse(sent[-1]["context"]["reset_url"]).query).get("token") or [""])[0]
check("a fresh request mails a fresh link", second.status_code == 200 and bool(second_token), second.text[:200])
check("…which switches the previous one off",
      fresh().post("/api/auth/password/reset", json={"token": token, "password": "MapleShade74"}).status_code == 400)
with SessionLocal() as db:
    row = db.scalar(select(User).where(User.login_email == STUDENT_NORMAL))
    row.password_reset_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
expired = fresh().post("/api/auth/password/reset", json={"token": second_token, "password": "MapleShade74"})
check("an expired link is refused", expired.status_code == 400, expired.text[:200])
check("nothing readable is returned for a bad link", second_token not in expired.text)

print("\n=== 12. an address no password account uses gets the same answer and no mail")
before_sends = len(sent)
unknown_again = fresh().post("/api/auth/password/forgot", json={"email": "google-only@example.com"})
check("the address still gets the ordinary answer", unknown_again.status_code == 200, unknown_again.text[:200])
check("…and nothing is sent", len(sent) == before_sends, sent[before_sends:])

print("\n=== 13. signing up never merges into an existing identity")
with SessionLocal() as db:
    google_user = User(
        role="student",
        display_name="Google Person",
        preferred_language="en",
        google_sub="google-subject-123",
    )
    db.add(google_user)
    db.commit()
    google_id = google_user.id
merged = fresh().post("/api/auth/email/register", json={
    "role": "student",
    "display_name": "Google Person",
    "email": "shared-address@example.com",
    "password": "CactusFlower41",
})
check("a new sign-up is created", merged.status_code == 201, merged.text[:200])
with SessionLocal() as db:
    row = db.get(User, google_id)
    check("the Google account keeps its identity", row.google_sub == "google-subject-123")
    check("…and gains no address or password", row.login_email is None and row.password_hash is None)
    check("…while the new sign-up is a different row",
          merged.json().get("user", {}).get("id") != google_id)

    clerk_user = User(
        role="parent",
        display_name="Clerk Person",
        preferred_language="en",
        clerk_user_id="user_clerk123",
        contact_email="clerk-address@example.com",
    )
    db.add(clerk_user)
    db.commit()
    clerk_id = clerk_user.id
clerk_conflict = fresh().post("/api/auth/email/register", json={
    "role": "parent",
    "display_name": "Clerk Person",
    "email": "clerk-address@example.com",
    "password": "CactusFlower41",
})
check("an address a Clerk account uses is refused rather than merged", clerk_conflict.status_code == 409, clerk_conflict.text[:200])
with SessionLocal() as db:
    row = db.get(User, clerk_id)
    check("…and the Clerk pointer is untouched", row.clerk_user_id == "user_clerk123" and row.password_hash is None)

print("\n=== 14. the other ways in still work for accounts that never used this one")
guest_browser = fresh()
guest_device = "8d9e6679-7425-40de-944b-e07fc1f90ae7"
guest = guest_browser.post("/api/auth/onboarding", json={
    "role": "student",
    "display_name": "Guest Person",
    "preferred_language": "en",
    "consent_profile": True,
    "consent_age": "6-8",
    "device_id": guest_device,
})
check("a device account still signs itself up", guest.status_code == 200, guest.text[:200])
guest_id = guest.json().get("user", {}).get("id")
guest_token = guest.json().get("token", "")
register_on_same_device = fresh().post("/api/auth/email/register", json={
    "role": "parent",
    "display_name": "Second Person",
    "email": "second@example.com",
    "password": "BirchForest29",
    "device_id": guest_device,
})
check("registering on a browser that already has an account works",
      register_on_same_device.status_code == 201, register_on_same_device.text[:200])
check("…but does not take the device over from the account it belongs to",
      guest_browser.post("/api/auth/guest", json={"device_id": guest_device}).json().get("session", {}).get("user", {}).get("id") == guest_id)
check("the guest session still authenticates",
      guest_browser.get("/api/auth/me", headers=bearer(guest_token)).status_code == 200)
with SessionLocal() as db:
    row = db.scalar(select(User).where(User.login_email == "second@example.com"))
    check("the new account records no device binding",
          row is not None and row.device_hash is None)

methods = fresh()
methods_token = login("second@example.com", "BirchForest29").json().get("token", "")
answer = methods.get("/api/auth/methods", headers=bearer(methods_token))
check("settings can see the email door on this account",
      answer.status_code == 200 and answer.json().get("email") is True, answer.text[:200])
check("…and does not claim Google", answer.json().get("google") is False)

print("\n=== 15. a closed account cannot be opened with an old password")
with SessionLocal() as db:
    row = db.scalar(select(User).where(User.login_email == "second@example.com"))
    row.is_active = False
    db.commit()
closed = login("second@example.com", "BirchForest29")
check("a closed account answers the generic 401", closed.status_code == 401, closed.text[:200])
check("…which is the same sentence a wrong password gets",
      closed.json().get("detail") == wrong.json().get("detail"), closed.text[:200])

# Restore the transport for anything that runs after this script in the same process.
email_messages.transport.enabled = real_enabled
email_messages.transport.send = real_send

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("\nFAILED:")
    for label in FAIL:
        print(f"  - {label}")
    sys.exit(1)
