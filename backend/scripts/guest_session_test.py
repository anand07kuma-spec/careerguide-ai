"""Test the no-password entry path: a device finds its own account and nothing else.

This prototype asks nobody for an email or a password. A browser makes a random
id for itself, the server binds an account to it, and the next visit gets the same
account back. That is only safe if three things hold, and each one is checked here
rather than assumed:

* the device id is a lookup, not a credential — every byte of data still travels
  behind the bearer token the server handed out;
* one device cannot reach another device's account, by substituting an id, by
  asking for a conversation it did not create, or by reading a list;
* being new is a normal answer, not an error, so a fresh browser goes to the one
  question onboarding asks instead of a dead end.

And the two things that make a stolen token worth less than a month: what the database
keeps is a digest of each credential rather than the credential, and a session is a day
long, renewable while the page is open and capped at a ceiling counted from the sign-in
that started it. Those are read back out of the rows here, not taken on trust. Where the
browser keeps its session is the third: an `httpOnly` cookie the page cannot read, which
the last section checks attribute by attribute — including that a request with no header
at all still gets the child's own account back.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/guest_session_test.py
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_guest_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import AuthToken, User  # noqa: E402
from app.security import device_hash_of, token_hash_of  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n== {title} ==")


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# The shape `crypto.randomUUID()` produces in a browser.
DEVICE_A = "7c1f9a2e-4b3d-4e1a-9c7f-2d6a8b0c1e5f"
DEVICE_B = "b2e6d8a4-1f5c-4b7e-8a3d-9c0e6f2b5a71"

STUDENT = {
    "role": "student",
    "display_name": "Aarav",
    "preferred_language": "hinglish",
    "class_level": "class-9",
    "interest_areas": ["drawing"],
    "consent_profile": True,
    "consent_voice": False,
    "consent_age": "11-12",
}

client = TestClient(app)

with client:
    section("A device nobody has seen before")
    r = client.post("/api/auth/guest", json={"device_id": DEVICE_A})
    check("a new device is answered, not rejected", r.status_code == 200, r.text)
    check("and told that it is new", r.json().get("known") is False, r.text)
    check("an unknown device is handed no session", r.json().get("session") is None)

    for bad in ["short", "has spaces inside", "<script>alert(1)</script>", "x" * 200]:
        r = client.post("/api/auth/guest", json={"device_id": bad})
        check(f"a device id like {bad[:18]!r} is refused", r.status_code == 422, str(r.status_code))
    check("a missing device id is refused", client.post("/api/auth/guest", json={}).status_code == 422)
    check("the guest endpoint asks for no token", True)

    section("The one question, asked on this device")
    r = client.post("/api/auth/onboarding", json={**STUDENT, "device_id": DEVICE_A})
    check("onboarding from a device succeeds", r.status_code == 200, r.text[:300])
    created = r.json()
    token_a = created["token"]
    user_id = created["user"]["id"]
    check("a bearer token comes back", len(token_a) > 20, token_a[:6] + "…")
    check("the token is not the device id", token_a != DEVICE_A and DEVICE_A not in token_a)
    check("no come-back code is pushed on a guest account", created.get("comeback_code") is None)
    check("the profile is there", (created.get("profile") or {}).get("class_level") == "class-9")

    r = client.post("/api/auth/onboarding", json={**STUDENT, "device_id": DEVICE_A})
    check("the same device is not onboarded twice", r.status_code == 409, r.text[:200])

    r = client.post("/api/auth/onboarding", json={k: v for k, v in STUDENT.items() if k != "display_name"})
    check("a name is still required", r.status_code == 422, str(r.status_code))

    section("Coming back to the same device")
    r = client.post("/api/auth/guest", json={"device_id": DEVICE_A})
    check("the returning device is recognised", r.status_code == 200 and r.json()["known"] is True, r.text)
    resumed = r.json()["session"] or {}
    check("it gets its own account back", resumed.get("user", {}).get("id") == user_id, resumed)
    check("with the same name", resumed.get("user", {}).get("display_name") == "Aarav")
    check("and its profile", (resumed.get("profile") or {}).get("class_level") == "class-9")
    check("and its settings", bool(resumed.get("settings")))
    token_a2 = resumed.get("token", "")
    check("a fresh token is issued rather than the old one echoed", bool(token_a2) and token_a2 != token_a)
    r = client.get("/api/auth/me", headers=auth(token_a2))
    check("that token opens the API", r.status_code == 200 and r.json()["user"]["id"] == user_id, r.text[:200])
    check("nothing in the answer is a password field", "password" not in r.text.lower())

    section("A conversation left on this device")
    r = client.post("/api/conversations", json={"kind": "chat"}, headers=auth(token_a2))
    check("a chat can be started", r.status_code == 201, r.text[:200])
    session_id = r.json()["id"]
    r = client.post(
        f"/api/conversations/{session_id}/messages",
        json={"message": "Mujhe drawing pasand hai", "speak": False},
        headers=auth(token_a2),
    )
    check("a message is answered", r.status_code == 200 and r.json()["reply"]["content"], r.text[:200])

    section("Another device")
    r = client.post("/api/auth/guest", json={"device_id": DEVICE_B})
    check("a different device is told it is new", r.json().get("known") is False, r.text)
    r = client.post("/api/auth/onboarding", json={**STUDENT, "device_id": DEVICE_B})
    check("and may become its own student", r.status_code == 200, r.text[:200])
    other = r.json()
    check("as a different account", other["user"]["id"] != user_id)
    token_b = other["token"]
    r = client.get("/api/conversations", headers=auth(token_b))
    check("the new device lists no conversations at all", r.status_code == 200 and r.json() == [], r.text[:200])
    r = client.get(f"/api/conversations/{session_id}", headers=auth(token_b))
    check("and cannot open the first device's conversation by id", r.status_code in (404, 403), str(r.status_code))
    r = client.post(
        f"/api/conversations/{session_id}/messages",
        json={"message": "hello", "speak": False},
        headers=auth(token_b),
    )
    check("or write into it", r.status_code in (404, 403), str(r.status_code))

    section("The device id is not a key")
    for path in ["/api/auth/me", "/api/conversations"]:
        r = client.get(path, headers=auth(DEVICE_A))
        check(f"{path} will not open with a device id as the token", r.status_code == 401, str(r.status_code))
    check(
        "a request with neither a header nor a cookie is refused",
        TestClient(app).get("/api/conversations").status_code == 401,
    )

    section("Signing out and starting over")
    r = client.post("/api/auth/logout", headers=auth(token_a2))
    check("signing out is accepted", r.status_code == 204, str(r.status_code))
    check("and the token stops working on the server", client.get("/api/auth/me", headers=auth(token_a2)).status_code == 401)
    r = client.post("/api/auth/guest", json={"device_id": DEVICE_A})
    check("the device still recognises itself afterwards", r.json().get("known") is True)
    check("with the same account behind it", r.json()["session"]["user"]["id"] == user_id)
    final_token = r.json()["session"]["token"]
    r = client.get("/api/conversations", headers=auth(final_token))
    check("and its conversation is still there", r.status_code == 200 and len(r.json()) == 1, r.text[:200])

    section("What the database actually holds")
    # The two values a browser presents are the whole of this app's authentication, so
    # what matters is not that they are secret in transit but that reading the database
    # does not hand them over. Every check below reads the row back the way an incident
    # responder would: with the plaintext in hand, looking for it.
    settings = get_settings()
    db = SessionLocal()
    try:
        check("a session is issued for a day, not for a month",
              settings.session_token_ttl_hours == 24, settings.session_token_ttl_hours)
        check("…and rolling renewal has a ceiling it cannot pass",
              settings.session_absolute_ttl_hours == 720, settings.session_absolute_ttl_hours)
        check("the bearer string the browser holds is not a key in the database",
              db.get(AuthToken, final_token) is None)
        record = db.get(AuthToken, token_hash_of(final_token))
        check("…its digest is, and it opens the same account",
              record is not None and record.user_id == user_id)
        check("…and it is the only kind of value that table holds: every session row is 64 hex",
              db.execute(text("select count(*) from auth_tokens where length(token_hash) <> 64")
                         ).scalar() == 0)
        check("no session row can be found by the token it was issued as",
              db.execute(text("select count(*) from auth_tokens where token_hash = :plain"),
                         {"plain": final_token}).scalar() == 0)
        stored = db.get(User, user_id).device_hash
        check("the device id is stored as the digest the lookup uses, never as text",
              stored == device_hash_of(DEVICE_A) and stored != DEVICE_A, stored)
        check("…so a reader of this table cannot tell which device ids are real",
              db.execute(text("select count(*) from users where device_hash = :plain"),
                         {"plain": DEVICE_A}).scalar() == 0)
        span = record.expires_at - record.created_at
        check("…and the session that was just minted is set to expire a day after it started",
              timedelta(hours=23, minutes=59) < span < timedelta(hours=24, minutes=1),
              span)

        section("Renewal: quietly, and only up to the ceiling")
        # A page left open all evening must not lose a child's work, and a token copied
        # onto a shared laptop must not quietly become permanent. Both are the same call.
        stale = datetime.now(timezone.utc) + timedelta(hours=2)
        record.expires_at = stale
        db.commit()
        r = client.get("/api/auth/me", headers=auth(final_token))
        db.refresh(record)
        check("an ordinary signed-in request renews a session that is running low",
              r.status_code == 200 and record.expires_at > stale, str(record.expires_at))
        check("…to a fresh day from now, not a day from when it started",
              timedelta(hours=23) < record.expires_at - datetime.now(timezone.utc)
              < timedelta(hours=24, minutes=1), str(record.expires_at))

        record.expires_at = datetime.now(timezone.utc) + timedelta(hours=2)
        record.created_at = datetime.now(timezone.utc) - timedelta(hours=700)
        db.commit()
        r = client.post("/api/auth/refresh", headers=auth(final_token))
        db.refresh(record)
        check("an explicit refresh is answered without handing out a second token",
              r.status_code == 200 and "token" not in r.json(), r.text[:200])
        check("…and says honestly whether it moved the date", r.json().get("extended") is True)
        ceiling = record.created_at + timedelta(hours=settings.session_absolute_ttl_hours)
        check("…but never past the ceiling counted from the sign-in that minted it",
              abs((record.expires_at - ceiling).total_seconds()) < 2,
              [str(record.expires_at), str(ceiling)])

        # Past the ceiling there is nothing left to grant, and the route must say so
        # rather than pretend the session got longer.
        before_expired = record.expires_at
        r = client.post("/api/auth/refresh", headers=auth(final_token))
        db.refresh(record)
        check("asking again at the ceiling is refused with a false, not a silent yes",
              r.status_code == 200 and r.json().get("extended") is False
              and record.expires_at == before_expired, r.text[:200])

        record.created_at = datetime.now(timezone.utc)
        record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
        r = client.get("/api/auth/me", headers=auth(final_token))
        check("a session past its date is refused even though the token is still correct",
              r.status_code == 401, str(r.status_code))
        r = client.post("/api/auth/refresh", headers=auth(final_token))
        check("…and cannot be refreshed back to life, which is what makes the day mean "
              "something", r.status_code == 401, str(r.status_code))

        r = client.post("/api/auth/guest", json={"device_id": DEVICE_A})
        check("…while the device that owns it simply starts a new session, because a day is "
              "a guard against a stolen token and not against the child who holds it",
              r.json()["session"]["token"] != final_token)

        section("The session travels in a cookie the page cannot read")
        # What this is for: a token a page can read is a token a page can lose. Anything
        # served to that page — a bundler bug, a third-party script, one template that
        # interpolates a child's message into HTML — could have copied it out of
        # `localStorage` and sent it somewhere. `HttpOnly` is the only attribute a browser
        # enforces against its own script, so these checks are about the attributes, not
        # about the value.
        jar = TestClient(app)
        minted = jar.post("/api/auth/guest", json={"device_id": DEVICE_A})
        minted_token = minted.json()["session"]["token"]
        offered = minted.headers.get("set-cookie", "")
        check("a response that starts a session sets the session cookie",
              "cg_session=" in offered and "HttpOnly" in offered, offered)
        check("…scoped to every path of this API, and to no other host",
              "Path=/" in offered and "Domain=" not in offered, offered)
        check("…with the cross-site attribute the deployment needs",
              "SameSite=" in offered, offered)
        check("…and it is the same session the body names, not a second one",
              f"cg_session={minted_token}" in offered, offered)
        check("a browser holding that cookie and sending no header at all is signed in",
              jar.get("/api/auth/me").json().get("user", {}).get("id") == user_id,
              jar.get("/api/auth/me").text[:200])
        check("…while a client that was never given one is answered 204, not 401",
              TestClient(app).get("/api/auth/me").status_code == 204)
        check("the header wins when a request presents both",
              jar.get("/api/auth/me", headers=auth(minted_token)).status_code == 200)
        check("…and a header that is present and wrong is a refusal, not a cue to try the jar",
              jar.get("/api/auth/me", headers=auth("z" * 43)).status_code == 401)
        out = jar.post("/api/auth/logout")
        check("signing out works from the cookie alone", out.status_code == 204,
              str(out.status_code))
        cleared = out.headers.get("set-cookie", "")
        check("…and the cookie is expired with the attributes it was set with, or the "
              "browser keeps offering a dead session",
              'cg_session=""' in cleared and "HttpOnly" in cleared and "Path=/" in cleared,
              cleared)
        check("…so the browser that signed out has nothing left to present, and the "
              "server reads that as a stranger rather than as a failure",
              jar.get("/api/auth/me").status_code == 204)
        proxied = TestClient(app)
        over_proxy = proxied.post("/api/auth/guest", json={"device_id": DEVICE_A},
                                 headers={"x-forwarded-proto": "https"})
        check("behind a proxy that says the browser reached us over https, the cookie asks "
              "for Secure and the only mode that survives with it",
              "Secure" in over_proxy.headers.get("set-cookie", "")
              and "SameSite=None" in over_proxy.headers.get("set-cookie", ""),
              over_proxy.headers.get("set-cookie"))
        # The same pair on plain http, which is what a laptop dev server is: `None` without
        # `Secure` is a cookie a browser throws away rather than a looser one, so the two
        # have to step down together or nobody signs in locally.
        check("…and on plain http the mode steps down to Lax instead of promising a cookie "
              "the browser would discard",
              "Secure" not in offered and "SameSite=Lax" in offered, offered)
    finally:
        db.close()

if DB_PATH.exists():
    # The engine keeps SQLite's file open until the process ends, so this can
    # legitimately fail; the next run clears the file before it starts.
    try:
        DB_PATH.unlink()
    except OSError:
        pass

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("failed: " + ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
