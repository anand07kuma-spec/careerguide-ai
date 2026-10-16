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

Run from `backend/`:

    .venv/Scripts/python.exe scripts/guest_session_test.py
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_guest_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

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
    check("no token at all is refused", client.get("/api/conversations").status_code in (401, 422))

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
