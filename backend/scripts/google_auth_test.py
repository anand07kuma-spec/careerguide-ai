"""Test signing in with Google: the flow, the refusals, and whose account it opens.

Google adds a verified identity on top of the account model this app already has: the
browser's device id and the session cookie still work. What is easy to get wrong is
exactly what a family cannot see, so each of these is checked here rather than assumed:

  * a `?role=` value, on the callback or anywhere else, never decides a role;
  * a token that is signed for someone else, expired, for another audience, or carrying
    someone else's nonce is refused before a subject is read;
  * one Google identity is one account — signing in twice does not make a second one;
  * an account that already exists keeps its own role;
  * nobody is merged by an email claim;
  * the session this ends with is a real server session, and logging out ends it.

Google itself is replaced by a locally generated RSA key and a fake token exchange. No
real credential is used or needed; the fake values below are test fixtures, not secrets.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/google_auth_test.py
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import pathlib
import sys
import tempfile
import time
from urllib.parse import parse_qs, urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

TEST_DB = pathlib.Path(tempfile.gettempdir()) / "careerguide_google_test.db"
if TEST_DB.exists():
    TEST_DB.unlink()

CLIENT_ID = "test-client.apps.googleusercontent.com"
REDIRECT_URI = "http://127.0.0.1:8000/api/auth/google/callback"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py
os.environ["DB_AUTO_SETUP"] = "false"
os.environ["AUTH_COOKIE_SECURE"] = "false"
os.environ["FRONTEND_URL"] = "http://localhost:3000"
os.environ["GOOGLE_CLIENT_ID"] = CLIENT_ID
os.environ["GOOGLE_CLIENT_SECRET"] = "test-fixture-secret-not-a-real-credential"
os.environ["GOOGLE_REDIRECT_URI"] = REDIRECT_URI

import jwt  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.config import Settings, get_settings  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ConsentRecord, StudentProfile, User, UserSettings  # noqa: E402
from app.routers import google_auth as google_auth_module  # noqa: E402
from app.security import device_hash_of  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n== {title} ==")


Base.metadata.create_all(bind=engine)

# --------------------------------------------------------------- a stand-in for Google
# One key signs the tokens; a second one proves a token signed by somebody else is refused.
SIGNING_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _FakeJwks:
    def get_signing_key_from_jwt(self, _value: str):
        class _Key:
            key = SIGNING_KEY.public_key()

        return _Key()


google_auth_module._jwks_client = lambda _url: _FakeJwks()

TOKENS: dict = {"id_token": None, "status": 200}


class _FakeResponse:
    def __init__(self, status: int) -> None:
        self.status_code = status

    def json(self):
        return {"id_token": TOKENS["id_token"]}


class _FakeHttpClient:
    """Records the form the server posted, so the exchange itself is proven too."""

    last: dict | None = None

    def __init__(self, timeout=None) -> None:
        self.timeout = timeout

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False

    def post(self, url, data=None, headers=None):
        _FakeHttpClient.last = {"url": url, "data": dict(data or {})}
        return _FakeResponse(TOKENS["status"])


google_auth_module.httpx.Client = _FakeHttpClient

client = TestClient(app, follow_redirects=False)
DEVICE_A = "7c1f9a2e-4b3d-4e1a-9c7f-2d6a8b0c1e5f"
DEVICE_B = "b2e6d8a4-1f5c-4b7e-8a3d-9c0e6f2b5a71"
DEVICE_C = "c3f7e9b5-2a6d-4c8f-9b4e-0d1f7a3c6b82"
DEVICE_D = "d4a8f0c6-3b7e-4d9a-8c5f-1e2a8b4d7c93"
DEVICE_E = "e5b9a1d7-4c8f-4eab-9d60-2f3b9c5e8d04"
COOKIE = get_settings().auth_cookie_name


def new_browser() -> TestClient:
    return TestClient(app, follow_redirects=False)


def start(browser: TestClient, *, role: str | None = "student", consent: str = "1",
          device: str | None = None):
    params = {"consent": consent}
    if role is not None:
        params["role"] = role
    if device is not None:
        params["device_id"] = device
    return browser.get("/api/auth/google/start", params=params)


def state_of(response, browser: TestClient) -> dict:
    raw = response.cookies.get(google_auth_module.STATE_COOKIE) or browser.cookies.get(
        google_auth_module.STATE_COOKIE
    )
    body, _signature = raw.rsplit(".", 1)
    return json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))


def id_token(
    *,
    nonce: str,
    sub: str | None = "google-sub-student",
    aud: str = CLIENT_ID,
    iss: str = "https://accounts.google.com",
    exp_delta: int = 300,
    key=SIGNING_KEY,
    given_name: str | None = "Aarav",
    email: str = "somebody@example.com",
    drop: tuple[str, ...] = (),
):
    now = int(time.time())
    claims = {
        "iss": iss,
        "aud": aud,
        "sub": sub,
        "iat": now,
        "exp": now + exp_delta,
        "nonce": nonce,
        "email": email,
    }
    if given_name:
        claims["given_name"] = given_name
    for name in drop:
        claims.pop(name, None)
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test-key"})


def callback(browser: TestClient, state: str, token: str | None = None, **extra):
    if token is not None:
        TOKENS["id_token"] = token
    params = {"code": "one-time-code", "state": state, **extra}
    return browser.get("/api/auth/google/callback", params=params)


def refused(response, code: str) -> bool:
    expected = f"http://localhost:3000/login?error={code}"
    return response.status_code == 303 and response.headers.get("location") == expected


with client:
    section("Configuration is reported, never faked")
    answer = client.get("/api/auth/google/status")
    check("status says Google is configured when the three values are set",
          answer.status_code == 200 and answer.json() == {"configured": True}, answer.text)

    blank = Settings(
        google_client_id="",
        google_client_secret="",
        google_redirect_uri="",
    )
    check("blank credentials report configured: false", blank.google_configured is False)
    half = Settings(
        google_client_id="abc",
        google_client_secret="def",
        google_redirect_uri="not-a-url",
    )
    check("a redirect URI that is not http(s) is not configured", half.google_configured is False)

    real_get_settings = google_auth_module.get_settings
    google_auth_module.get_settings = lambda: blank
    try:
        unavailable = client.get("/api/auth/google/start", params={"consent": "1"})
        check("start answers 503 when Google is not configured", unavailable.status_code == 503,
              unavailable.text)
        unavailable_cb = client.get("/api/auth/google/callback", params={"code": "x", "state": "y"})
        check("callback sends the browser back with google_unavailable",
              refused(unavailable_cb, "google_unavailable"), unavailable_cb.headers.get("location"))
    finally:
        google_auth_module.get_settings = real_get_settings

    section("/start refuses to begin without consent")
    no_consent = client.get("/api/auth/google/start", params={"role": "student"})
    check("no consent is a 400", no_consent.status_code == 400, no_consent.text)
    zero_consent = client.get("/api/auth/google/start", params={"consent": "0"})
    check("consent=0 is a 400", zero_consent.status_code == 400, zero_consent.text)

    section("/start builds an authorization request that cannot be tampered with")
    begun = start(client, role="student", device=DEVICE_A)
    location = begun.headers.get("location", "")
    query = parse_qs(urlparse(location).query)
    pending = state_of(begun, client)
    set_cookie = begun.headers.get("set-cookie", "").lower()

    check("start redirects to Google", begun.status_code == 303
          and location.startswith(get_settings().google_auth_url), location)
    check("asks for exactly openid, email and profile",
          query.get("scope") == ["openid email profile"], str(query.get("scope")))
    check("uses the authorization-code flow", query.get("response_type") == ["code"])
    check("sends back to the configured callback",
          query.get("redirect_uri") == [REDIRECT_URI], str(query.get("redirect_uri")))
    check("uses PKCE with S256", query.get("code_challenge_method") == ["S256"])
    check("includes a state and a nonce",
          bool(query.get("state", [""])[0]) and bool(query.get("nonce", [""])[0]))
    check("asks Google to let the person choose an account",
          query.get("prompt") == ["select_account"])
    check("state cookie is httpOnly", "httponly" in set_cookie, set_cookie)
    check("state cookie is SameSite=Lax", "samesite=lax" in set_cookie, set_cookie)
    check("state cookie is scoped to the Google routes", "path=/api/auth/google" in set_cookie,
          set_cookie)
    check("state cookie is short-lived", "max-age=600" in set_cookie, set_cookie)
    check("state cookie holds the role, not the URL",
          pending.get("r") == "student" and pending.get("d") == DEVICE_A, str(pending))

    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(pending["v"].encode("ascii")).digest()
    ).rstrip(b"=").decode("ascii")
    check("the PKCE challenge is the S256 digest of the stored verifier",
          query.get("code_challenge") == [challenge])

    junk = new_browser()
    junk_start = start(junk, role="admin", device="<script>alert(1)</script>")
    junk_state = state_of(junk_start, junk)
    check("an unknown role is not carried into the state", junk_state.get("r") is None,
          str(junk_state))
    check("a device id of the wrong shape is not carried into the state",
          junk_state.get("d") is None, str(junk_state))

    section("The callback refuses a state it did not issue")
    no_cookie = new_browser()
    check("no state cookie is refused",
          refused(callback(no_cookie, "state-value", "unused"), "google_state"))

    mismatch = new_browser()
    started = start(mismatch)
    mismatch_state = state_of(started, mismatch)
    wrong = callback(mismatch, "a-different-state", "unused")
    check("a state that does not match the cookie is refused", refused(wrong, "google_state"))

    tampered = new_browser()
    started = start(tampered)
    raw_cookie = started.cookies.get(google_auth_module.STATE_COOKIE)
    body, signature = raw_cookie.rsplit(".", 1)
    flipped = ("0" if signature[0] != "0" else "1") + signature[1:]
    tampered.cookies.set(google_auth_module.STATE_COOKIE, f"{body}.{flipped}",
                         path="/api/auth/google")
    check("a tampered signature is refused",
          refused(callback(tampered, state_of(started, tampered)["s"], "unused"), "google_state"))

    expired_body = json.dumps(
        {
            "s": "expired-state",
            "v": "verifier",
            "n": "nonce",
            "r": None,
            "d": None,
            "e": int(time.time()) - 1,
        },
        separators=(",", ":"),
    ).encode("utf-8")
    expired_cookie = (
        google_auth_module._b64(expired_body)
        + "."
        + google_auth_module._signature(expired_body, get_settings().google_client_secret)
    )
    expired = new_browser()
    expired.cookies.set(google_auth_module.STATE_COOKIE, expired_cookie, path="/api/auth/google")
    check("an expired state cookie is refused",
          refused(callback(expired, "expired-state", "unused"), "google_state"))

    section("Google choosing 'cancel' is not an error")
    cancelled = new_browser()
    started = start(cancelled)
    answer = callback(cancelled, state_of(started, cancelled)["s"], error="access_denied")
    check("access_denied means the person changed their mind",
          refused(answer, "google_cancelled"), answer.headers.get("location"))

    broken = new_browser()
    started = start(broken)
    answer = callback(broken, state_of(started, broken)["s"], error="server_error")
    check("any other provider error is a failed sign-in",
          refused(answer, "google_failed"), answer.headers.get("location"))

    section("An identity token is only believed after every check passes")
    bad_sig = new_browser()
    started = start(bad_sig)
    nonce = state_of(started, bad_sig)["n"]
    check("a token signed by another key is refused",
          refused(callback(bad_sig, state_of(started, bad_sig)["s"],
                           id_token(nonce=nonce, key=OTHER_KEY)), "google_failed"))

    for label, make in (
        ("a token for another audience",
         lambda n: id_token(nonce=n, aud="another-client.apps.googleusercontent.com")),
        ("a token from another issuer",
         lambda n: id_token(nonce=n, iss="https://evil.example")),
        ("an expired token", lambda n: id_token(nonce=n, exp_delta=-3600)),
        ("a token with another sign-in's nonce", lambda n: id_token(nonce="not-this-nonce")),
        ("a token with no subject", lambda n: id_token(nonce=n, sub=None, drop=("sub",))),
    ):
        browser = new_browser()
        started = start(browser)
        browser_nonce = state_of(started, browser)["n"]
        check(label, refused(callback(browser, state_of(started, browser)["s"],
                                      make(browser_nonce)), "google_failed"))

    section("A failed token exchange is a refusal, not a new account")
    exchange = new_browser()
    started = start(exchange)
    TOKENS["status"] = 502
    check("a non-200 exchange is refused",
          refused(callback(exchange, state_of(started, exchange)["s"], "unused"), "google_failed"))
    TOKENS["status"] = 200

    no_token = new_browser()
    started = start(no_token)
    TOKENS["id_token"] = None
    check("an exchange with no identity token is refused",
          refused(callback(no_token, state_of(started, no_token)["s"]), "google_failed"))

    section("A new student is created from a verified identity")
    student = new_browser()
    started = start(student, role="student", device=DEVICE_A)
    pending = state_of(started, student)
    token = id_token(nonce=pending["n"], sub="google-sub-student", given_name="Aarav")
    finished = callback(student, pending["s"], token)

    check("the browser is sent to the finish page",
          finished.status_code == 303
          and finished.headers.get("location") == "http://localhost:3000/auth/google/finish",
          finished.headers.get("location"))
    check("a session cookie is minted in the same hop",
          bool(finished.cookies.get(COOKIE)), str(finished.cookies))
    check("the state cookie is cleared",
          not finished.cookies.get(google_auth_module.STATE_COOKIE))
    check("the exchange sent the PKCE verifier and the client id",
          _FakeHttpClient.last is not None
          and _FakeHttpClient.last["data"].get("code_verifier") == pending["v"]
          and _FakeHttpClient.last["data"].get("client_id") == CLIENT_ID
          and _FakeHttpClient.last["data"].get("redirect_uri") == REDIRECT_URI
          and _FakeHttpClient.last["data"].get("grant_type") == "authorization_code",
          str(_FakeHttpClient.last))

    with SessionLocal() as db:
        created = db.scalars(
            select(User).where(User.google_sub == "google-sub-student")
        ).one_or_none()
        check("the account exists once, as a student", created is not None
              and created.role == "student", created)
        check("the profile name comes from Google's given name",
              created is not None and created.display_name == "Aarav")
        check("this browser is bound to the account",
              created is not None and created.device_hash == device_hash_of(DEVICE_A))
        profile = (
            db.scalars(select(StudentProfile).where(StudentProfile.user_id == created.id)).first()
            if created
            else None
        )
        check("a student gets the profile shell and a sharing code",
              profile is not None and bool(profile.share_code))
        consent = (
            db.scalars(select(ConsentRecord).where(ConsentRecord.user_id == created.id)).first()
            if created
            else None
        )
        check("the login page's notice becomes a stored profile consent",
              consent is not None and consent.scope == "profile" and consent.granted is True)
        settings_row = db.get(UserSettings, created.id) if created else None
        check("settings are created so the app has its usual defaults",
              settings_row is not None)
        student_id = created.id if created else 0

    me = student.get("/api/auth/me")
    check("the cookie alone opens the dashboard session",
          me.status_code == 200 and me.json()["user"]["role"] == "student", me.text[:200])
    check("the session reports Google as a way in",
          student.get("/api/auth/methods").json().get("google") is True)
    check("a student reaches student-only endpoints",
          student.get("/api/assessments").status_code == 200)

    section("A new parent is created with the parent role")
    parent = new_browser()
    started = start(parent, role="parent", device=DEVICE_B)
    pending = state_of(started, parent)
    finished = callback(parent, pending["s"], id_token(nonce=pending["n"],
                                                       sub="google-sub-parent",
                                                       given_name="Meera"))
    with SessionLocal() as db:
        parent_row = db.scalars(
            select(User).where(User.google_sub == "google-sub-parent")
        ).one_or_none()
        parent_profile = (
            db.scalars(select(StudentProfile).where(StudentProfile.user_id == parent_row.id)).first()
            if parent_row
            else None
        )
    check("the account is a parent", parent_row is not None and parent_row.role == "parent")
    check("a parent does not get a student profile", parent_profile is None)
    check("a parent is refused on a student-only endpoint",
          parent.get("/api/assessments").status_code == 403,
          parent.get("/api/assessments").text)
    check("the parent's dashboard is decided by the server's role",
          parent.get("/api/auth/me").json()["user"]["role"] == "parent")

    section("A role in a URL changes nothing")
    sneaky = new_browser()
    started = start(sneaky, role="student")
    pending = state_of(started, sneaky)
    callback(sneaky, pending["s"], id_token(nonce=pending["n"], sub="google-sub-sneaky"),
             role="parent")
    with SessionLocal() as db:
        sneaky_row = db.scalars(
            select(User).where(User.google_sub == "google-sub-sneaky")
        ).one_or_none()
    check("?role=parent on the callback is ignored",
          sneaky_row is not None and sneaky_row.role == "student")

    unknown = new_browser()
    started = start(unknown, role="admin")
    pending = state_of(started, unknown)
    callback(unknown, pending["s"], id_token(nonce=pending["n"], sub="google-sub-unknown-role"))
    with SessionLocal() as db:
        unknown_row = db.scalars(
            select(User).where(User.google_sub == "google-sub-unknown-role")
        ).one_or_none()
    check("an unknown role falls back to student", unknown_row is not None
          and unknown_row.role == "student")

    section("An existing Google account keeps its role and is not duplicated")
    with SessionLocal() as db:
        db.add(User(role="parent", display_name="Existing parent",
                    preferred_language="hinglish", google_sub="google-sub-returning"))
        db.commit()
        before = len(db.scalars(select(User)).all())

    returning = new_browser()
    started = start(returning, role="student", device=DEVICE_C)
    pending = state_of(started, returning)
    finished = callback(returning, pending["s"],
                        id_token(nonce=pending["n"], sub="google-sub-returning"))
    with SessionLocal() as db:
        rows = db.scalars(select(User).where(User.google_sub == "google-sub-returning")).all()
        after = len(db.scalars(select(User)).all())
    check("signing in again does not make a second account",
          len(rows) == 1 and after == before, f"{len(rows)} rows, {before}->{after}")
    check("the existing role is kept even though student was requested",
          rows and rows[0].role == "parent")

    with SessionLocal() as db:
        again_before = len(db.scalars(select(User)).all())
    again = new_browser()
    started = start(again, role="student")
    pending = state_of(started, again)
    callback(again, pending["s"], id_token(nonce=pending["n"], sub="google-sub-returning"))
    with SessionLocal() as db:
        again_after = len(db.scalars(select(User)).all())
    check("a second browser signing in does not duplicate the account",
          again_after == again_before)

    section("Linking needs a credential this browser already has")
    linked = new_browser()
    onboarded = linked.post("/api/auth/onboarding", json={
        "role": "student",
        "display_name": "Linked learner",
        "preferred_language": "hinglish",
        "consent_profile": True,
        "consent_voice": False,
        "consent_age": "6-8",
        "device_id": DEVICE_D,
    })
    check("the device account exists", onboarded.status_code == 200, onboarded.text[:200])
    linked_id = onboarded.json()["user"]["id"]

    started = start(linked, role="parent")
    pending = state_of(started, linked)
    finished = callback(linked, pending["s"], id_token(nonce=pending["n"],
                                                       sub="google-sub-linked"))
    with SessionLocal() as db:
        same = db.get(User, linked_id)
        check("the session's own account is the one Google is attached to",
              same is not None and same.google_sub == "google-sub-linked")
        check("its role is untouched by the role on the login page",
              same is not None and same.role == "student")
    check("the linked account can still open its session",
          linked.get("/api/auth/me").status_code == 200)

    section("A different Google identity never takes over an account")
    conflict_browser = new_browser()
    conflict_browser.post("/api/auth/onboarding", json={
        "role": "student",
        "display_name": "Conflicted learner",
        "preferred_language": "hinglish",
        "consent_profile": True,
        "consent_voice": False,
        "consent_age": "6-8",
        "device_id": DEVICE_E,
    })
    with SessionLocal() as db:
        conflict_row = db.scalars(select(User).where(User.device_hash == device_hash_of(DEVICE_E))).one()
        conflict_row.google_sub = "google-sub-original"
        db.commit()
        conflict_id = conflict_row.id

    started = start(conflict_browser, role="student")
    pending = state_of(started, conflict_browser)
    answer = callback(conflict_browser, pending["s"],
                      id_token(nonce=pending["n"], sub="google-sub-attacker"))
    with SessionLocal() as db:
        unchanged = db.get(User, conflict_id)
    check("a second Google identity is refused", refused(answer, "google_conflict"),
          answer.headers.get("location"))
    check("the original Google identity is unchanged",
          unchanged is not None and unchanged.google_sub == "google-sub-original")

    section("An unverified email claim merges nothing")
    with SessionLocal() as db:
        db.add(User(role="student", display_name="Email holder",
                    preferred_language="hinglish", contact_email="shared@example.com"))
        db.commit()
        before = len(db.scalars(select(User)).all())
    email_browser = new_browser()
    started = start(email_browser, role="student")
    pending = state_of(started, email_browser)
    callback(email_browser, pending["s"],
             id_token(nonce=pending["n"], sub="google-sub-email-different",
                      email="shared@example.com"))
    with SessionLocal() as db:
        after = len(db.scalars(select(User)).all())
        email_holder = db.scalars(
            select(User).where(User.contact_email == "shared@example.com")
        ).one()
    check("a matching email does not merge accounts", after == before + 1,
          f"{before}->{after}")
    check("the email-holding account is not given a Google identity",
          email_holder.google_sub is None)

    section("The device id alone finds the account on the next visit")
    device_browser = new_browser()
    started = start(device_browser, role="student", device=DEVICE_A)
    pending = state_of(started, device_browser)
    callback(device_browser, pending["s"], id_token(nonce=pending["n"], sub="google-sub-student"))
    visitor = new_browser()
    guest_answer = visitor.post("/api/auth/guest", json={"device_id": DEVICE_A})
    check("that browser finds the same student account",
          guest_answer.status_code == 200
          and guest_answer.json().get("known") is True
          and guest_answer.json()["session"]["user"]["id"] == student_id,
          guest_answer.text[:200])

    section("Signing out ends the session on the server")
    check("the Google session works before signing out",
          student.get("/api/auth/me").status_code == 200)
    check("logout answers 204", student.post("/api/auth/logout").status_code == 204)
    check("the cookie no longer opens the account",
          student.get("/api/auth/me").status_code == 401)

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("\nFailed checks:")
    for label in FAIL:
        print(f"  - {label}")
    sys.exit(1)
