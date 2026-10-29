"""Test signing back in to an account that already exists.

Before this, an account was reachable only from the browser that created it: the session
token lived in a store that browser could read but no other device could, so signing out —
or clearing site data, or switching to a phone — left a child's profile on the server with
no way back in. The fix is a come-back code, and the things most likely to be wrong are
exactly the ones a person cannot see:

  * the code stored as readable text, so a database dump is a list of accounts;
  * the old code still working after a replacement;
  * an error message that reveals whether a code belongs to somebody;
  * a legacy account with no code at all getting a dead end instead of a clear
    "create one" path.

Runs against a throwaway database, never `careerguide.db`.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/login_test.py
"""

from __future__ import annotations

import os
import pathlib
import re
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import _console  # noqa: E402,F401 -- utf-8 stdout, see _console.py

TEST_DB = pathlib.Path(tempfile.gettempdir()) / "careerguide_login_test.db"
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py
os.environ["DB_AUTO_SETUP"] = "false"

from sqlalchemy import inspect, text  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import User  # noqa: E402
from app.schema_sync import add_missing_columns  # noqa: E402
from app.security import (  # noqa: E402
    CODE_ALPHABET,
    CODE_LENGTH,
    _hash_code,
    format_code,
    issue_token,
    new_code,
    normalize_code,
    verify_code,
)

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


Base.metadata.create_all(bind=engine)
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)
# A second client, with its own empty cookie jar. Every minting response now sets a
# session cookie and `TestClient` keeps whatever it is given, so a request that means to
# present *no* credential has to be sent by a client that holds none — otherwise the check
# passes for the wrong reason and the unauthenticated path is never proved.
jarless = TestClient(app)

# The shape `crypto.randomUUID()` gives a browser, and the value a second device would
# send alongside a come-back code so that the code only has to be typed once.
NEW_DEVICE = "7c9e6679-7425-40de-944b-e07fc1f90ae7"


def onboard(**values) -> dict:
    payload = {
        "role": "student",
        "display_name": "Aarav",
        "preferred_language": "hinglish",
        "consent_profile": True,
        "consent_age": "11-12",
    }
    payload.update(values)
    response = client.post("/api/auth/onboarding", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def mint(bearer: str) -> str:
    """Ask for a code the way Settings does, since onboarding no longer offers one."""
    response = client.post(
        "/api/auth/comeback-code", headers={"Authorization": f"Bearer {bearer}"}
    )
    assert response.status_code == 200, response.text
    return response.json()["code"]


print("\n--- the code an account is handed ---")
student = onboard(class_level="class-8")
check(
    "a guest account is created without a code",
    student.get("comeback_code") is None,
    sorted(student.keys()),
)
code = mint(student["token"])
check("Settings can still mint one when it is asked for", bool(code), code)
check("it is five characters, three groups", bool(re.fullmatch(r"[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}", code)), code)
check("no look-alike characters in it", not set(code.replace("-", "")) & set("IO01"), code)
check("that is 15 characters of code", len(normalize_code(code)) == CODE_LENGTH, code)
alphabet_ok = set(new_code()) <= set(CODE_ALPHABET) and len(CODE_ALPHABET) == 32
check("the alphabet has 32 symbols, so 15 characters is ~75 bits", alphabet_ok, CODE_ALPHABET)

print("\n--- what the database actually holds ---")
with engine.connect() as conn:
    row = conn.execute(
        text('select comeback_index, comeback_hash from users where id = :i'), {"i": student["user"]["id"]}
    ).one()
index_value, hash_value = row[0], row[1]
check("no readable copy of the code is stored", code.replace("-", "") not in f"{index_value}{hash_value}")
check("an index is stored to find the row", bool(index_value) and index_value != code)
check("the check is a salted PBKDF2 digest", hash_value.startswith("pbkdf2_sha256$"), hash_value[:32])
check("the digest is not just the index again", index_value not in hash_value)
columns = {c["name"] for c in inspect(engine).get_columns("users")}
check(
    "no email, phone or password column was added",
    not columns & {"email", "phone", "password", "username", "password_hash"},
    sorted(columns),
)

print("\n--- signing in with it ---")
signed_in = client.post("/api/auth/login", json={"code": code})
check("the code logs the account in", signed_in.status_code == 200, signed_in.text)
body = signed_in.json() if signed_in.status_code == 200 else {}
check("a fresh token comes back", bool(body.get("token")))
check("the same account is returned", body.get("user", {}).get("id") == student["user"]["id"])
check("the profile comes with it", (body.get("profile") or {}).get("class_level") == "class-8")
check("settings come with it", bool(body.get("settings")))
check("login does not hand out another code", body.get("comeback_code") is None)

me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body.get('token', '')}"})
check("the new token is accepted by the API", me.status_code == 200, me.text)
check("and the code is never readable through /me", code not in me.text)
check("the original device token still works too", client.get("/api/auth/me", headers={"Authorization": f"Bearer {student['token']}"}).status_code == 200)

print("\n--- typing it by hand ---")
check("lowercase works", client.post("/api/auth/login", json={"code": code.lower()}).status_code == 200)
check("dashes optional", client.post("/api/auth/login", json={"code": code.replace("-", "")}).status_code == 200)
check("stray spaces ignored", client.post("/api/auth/login", json={"code": f" {code} "}).status_code == 200)
check("grouping is only for reading", normalize_code(format_code(normalize_code(code))) == normalize_code(code))

print("\n--- a wrong code, and what it says ---")
wrong = client.post("/api/auth/login", json={"code": "ABCDE-FGHIJ-KLMNP"})
unknown = client.post("/api/auth/login", json={"code": "QQQQQ-QQQQQ-QQQQ2"})
check("a wrong code is refused", wrong.status_code == 401, wrong.text)
check("a code that matches nobody is refused", unknown.status_code == 401, unknown.text)
check(
    "both answers are identical, so nothing reveals which codes exist",
    wrong.json().get("detail") == unknown.json().get("detail"),
)
check("the refusal does not repeat the code back", normalize_code(code) not in wrong.text)
short = client.post("/api/auth/login", json={"code": "ABCDEF"})
check("a code of the wrong length is refused the same way", short.status_code == 401, short.text)
check("login never needs a token first", client.post("/api/auth/login", json={"code": "ABC"}).status_code in (401, 422))

print("\n--- replacing a code ---")
status = client.get("/api/auth/comeback-code", headers={"Authorization": f"Bearer {student['token']}"})
check("the account reports having a code", status.json().get("has_code") is True, status.text)
check("and says it cannot be shown again", "cannot be displayed again" in status.text)
rotated = client.post("/api/auth/comeback-code", headers={"Authorization": f"Bearer {student['token']}"})
check("a new code can be minted", rotated.status_code == 200, rotated.text)
newer = rotated.json().get("code", "")
check("it differs from the old one", newer != code, newer)
check("the old code no longer opens the account", client.post("/api/auth/login", json={"code": code}).status_code == 401)
check("the new code does", client.post("/api/auth/login", json={"code": newer}).status_code == 200)
check("the warning says the old one is dead", "stopped working" in rotated.json().get("note", ""))
check("and warns that the code grants access", "anyone who has it" in rotated.json().get("note", "").lower())
unauthorized = jarless.post("/api/auth/comeback-code")
check("nobody can mint a code without signing in", unauthorized.status_code == 401, unauthorized.text)

print("\n--- an account from before this existed ---")
with SessionLocal() as db:
    legacy = User(role="student", display_name="Legacy", preferred_language="en")
    db.add(legacy)
    db.commit()
    legacy_token = issue_token(db, legacy.id)
legacy_status = client.get("/api/auth/comeback-code", headers={"Authorization": f"Bearer {legacy_token}"})
check("it is told it has no code", legacy_status.json().get("has_code") is False, legacy_status.text)
check("and pointed at creating one", "no come-back code yet" in legacy_status.text)
first_mint = client.post("/api/auth/comeback-code", headers={"Authorization": f"Bearer {legacy_token}"})
check("creating one works", first_mint.status_code == 200, first_mint.text)
legacy_code = first_mint.json().get("code", "")
check("and it really signs the account in", client.post("/api/auth/login", json={"code": legacy_code}).status_code == 200)

print("\n--- one code opens one account ---")
parent = onboard(role="parent", display_name="Mrs Sharma", student_name="Rohan", student_class_level="class-6")
parent_code = mint(parent["token"])
as_parent = client.post("/api/auth/login", json={"code": parent_code})
check("a parent account signs in", as_parent.status_code == 200, as_parent.text)
check("as the parent, not the child", as_parent.json().get("user", {}).get("role") == "parent")
check("child code and parent code are different", parent_code != newer)
again = client.post("/api/auth/login", json={"code": newer})
check(
    "the student's code does not grant the parent account",
    again.json().get("user", {}).get("role") == "student",
    f"{again.status_code} {again.text}",
)
# A code typed on a phone is worth less if that phone has to type it again every time it
# opens the app, so the sign-in binds the device that made it. Binding only happens for a
# device that has no account of its own: a shared laptop must not be able to move a
# stranger's browser onto a child's profile by typing a code over it.
bound = client.post("/api/auth/login", json={"code": newer, "device_id": NEW_DEVICE})
check("a code signs a new device in", bound.status_code == 200, bound.text)
check(
    "…and the next visit from that device is a return, not a second typing-out",
    client.post("/api/auth/guest", json={"device_id": NEW_DEVICE}).json()["session"]["user"][
        "id"
    ]
    == bound.json()["user"]["id"],
)

print("\n--- a stale schema gets its new columns ---")
with engine.connect() as conn:
    # SQLite refuses to drop a column an index still points at.
    conn.execute(text("drop index if exists ix_users_comeback_index"))
    conn.execute(text("alter table users drop column comeback_hash"))
    conn.execute(text("alter table users drop column comeback_index"))
    conn.commit()
added = add_missing_columns(engine)
after = {c["name"] for c in inspect(engine).get_columns("users")}
check("the missing columns are added back", {"comeback_index", "comeback_hash"} <= after, sorted(after))
check("and reported as added", len(added) == 2, added)
check(
    "the lookup index comes back too",
    "ix_users_comeback_index" in {i["name"] for i in inspect(engine).get_indexes("users")},
    inspect(engine).get_indexes("users"),
)
with engine.connect() as conn:
    # 1 student + 1 legacy + a parent and the child created with them.
    check("nothing else was touched", conn.execute(text("select count(*) from users")).scalar() == 4)
check("running it again adds nothing", add_missing_columns(engine) == [])

print("\n--- the digest check itself ---")
check("a correct digest passes", verify_code("ABCDE23456FGHIJ", _hash_code("ABCDE23456FGHIJ")))
check("a wrong code fails against it", not verify_code("ABCDE23456FGHIK", _hash_code("ABCDE23456FGHIJ")))
check("two digests of the same code differ (fresh salt)", _hash_code("ABCDE23456FGHIJ") != _hash_code("ABCDE23456FGHIJ"))
check("and both still verify", verify_code("ABCDE23456FGHIJ", _hash_code("ABCDE23456FGHIJ")))
check("an empty stored value fails", not verify_code("anything", ""))
check("a missing stored value fails", not verify_code("anything", None))
check("a damaged stored value fails", not verify_code("anything", "garbage"))
check("a foreign scheme fails", not verify_code("anything", "md5$1$salt$digest"))

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("Failed checks: " + ", ".join(FAIL))
    sys.exit(1)
