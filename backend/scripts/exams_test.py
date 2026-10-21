"""Test the exam catalogue: what it publishes, what it refuses, and who may change it.

The exams page used to be sentences typed into the frontend bundle. It is now rows behind
an API, which moves one risk rather than removing it: a page can no longer invent a date at
build time, but a database can now hold one that nobody read off a source. These checks are
arranged around the rules that keep that from happening.

* **A figure needs the page it came from.** A date or a fee sent without `source_url` is
  refused, `verified: true` without a source is refused, and clearing the source under a
  verified row is refused. All three are asserted as refusals carrying the server's own
  sentence, because a refusal a caller cannot read is a bug report waiting to happen.
* **Withholding is the publish-side rule.** A row that is not verified answers `exam_date`
  and `fee_note` as `null` on `/api/exams` while the operator's read still shows the text.
  Checked before verification, after it, and after it is withdrawn again — the withhold has
  to be reversible or an operator could never correct a mistake.
* **Nobody can sign themselves into the catalogue.** Every admin route is walked without a
  credential, as an ordinary student, and as the operator.
* **Both throttles are real.** Admin writes share the per-minute bucket, `/api/exams` is
  exempt from the read bucket, and `/api/exams/admin` is deliberately put back into it. The
  exempt route is proven exempt by out-reading the limit rather than by trusting the list.
* **The seed carries no invented numbers.** Any row that holds a figure must also hold a
  source, which is the invariant the seed file has to keep satisfying.

Every functional call below goes through `op()`, which empties the counters first: a 429 in
a section that is not about throttling would be a failure of this file, not of the guard.
Section 7 calls the client directly, on a bucket it has deliberately just filled.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/exams_test.py
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_exams_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["CLERK_SECRET_KEY"] = ""
# On, unlike most suites: two of the five things below are claims about a throttle, and a
# throttle that is switched off passes them by accident.
os.environ["RATE_LIMIT_ENABLED"] = "true"
# Small enough that section 7 can fill them in a handful of requests. The rules are read at
# import time, which is why they are set above rather than with `env()` in the middle.
os.environ["RATE_LIMIT_AUTH"] = "500 per minute"
os.environ["RATE_LIMIT_GUEST"] = "500 per minute"
os.environ["RATE_LIMIT_ADMIN"] = "6 per minute"
os.environ["RATE_LIMIT_READ"] = "8 per minute"

from contextlib import ExitStack  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.middleware import rate_limit  # noqa: E402
from app.models import AuditEvent, Exam, ExamGroup, User  # noqa: E402

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


def fresh_counters() -> None:
    """Empty every bucket, so a 429 below names the guard section 7 means to test."""
    rate_limit.limiter._storage.reset()


STUDENT = {
    "role": "student",
    "display_name": "Exams Tester",
    "preferred_language": "en",
    "class_level": "class-12",
    "interest_areas": ["drawing"],
    "consent_profile": True,
    "consent_voice": False,
    "consent_age": "11-12",
    "device_id": "exams-suite-device",
}

GROUP = {"title": "Become something", "description": "A door written by the test suite."}
EXAM = {
    "name": "ZZ Suite Exam",
    "authority": "ZZBoard of Testing",
    "description": "A row created by the exam suite so the write rules have something to act on.",
    "careers": "Nothing real opens from it; it is deleted before the suite finishes.",
    "timeline": "It exists only while this suite is running.",
    "preparation": "There is nothing to prepare, which is the point of the row.",
}
SOURCE = "https://example.gov.in/zz-suite-notification"

client = TestClient(app)
LIFESPAN = ExitStack()
LIFESPAN.enter_context(client)
# A second client, because the first one holds the session cookie its own sign-ins set:
# a request through it is never anonymous, and a guard tested with a credential that
# happens to be present is a guard that was never tested.
bare = TestClient(app)

signup = client.post("/api/auth/onboarding", json=STUDENT)
assert signup.status_code == 200, signup.text[:300]
token = signup.json()["token"]

# This app has no password to hand a test account, so the operator is made the way the
# README says an operator is made: an account exists first, and the flag goes onto its row.
operator_signup = client.post(
    "/api/auth/onboarding",
    json={**STUDENT, "display_name": "Suite Operator", "device_id": "suite-operator-device"},
)
assert operator_signup.status_code == 200, operator_signup.text[:300]
op_token = operator_signup.json()["token"]
operator_id = operator_signup.json()["user"]["id"]
with SessionLocal() as db:
    db.get(User, operator_id).is_admin = True
    db.commit()


def op(method: str, path: str, body: dict | None = None, credentials: str | None = None):
    """One operator request, with the counters cleared so the bucket cannot answer for it."""
    fresh_counters()
    headers = auth(credentials or op_token)
    if method == "DELETE":
        return client.request(method, path, headers=headers)
    return client.request(method, path, headers=headers, json=body)


def admin_read():
    fresh_counters()
    return client.get("/api/exams/admin", headers=auth(op_token))


def public_read():
    fresh_counters()
    return client.get("/api/exams")


# ---------------------------------------------------------------- 1. what boots with the app
section("1. what the app seeds, and what it refuses to publish")

body = public_read().json()
check("the exam map reads as a list of doors", isinstance(body, list) and len(body) > 0, str(type(body)))
check(
    "every door lists at least one exam",
    all(len(group["exams"]) > 0 for group in body),
    str([g["title"] for g in body if not g["exams"]]),
)
flat = [exam for group in body for exam in group["exams"]]
check("and the map carries the seeded exams", len(flat) >= 10, str(len(flat)))
check(
    "a door never lists an exam belonging to another door",
    all(exam["group_id"] == group["id"] for group in body for exam in group["exams"]),
)
check(
    "the doors arrive in the order the operator set",
    [group["sort_order"] for group in admin_read().json()] == sorted(group["sort_order"] for group in admin_read().json()),
)
check(
    "every card has the four sentences a student reads",
    all(
        exam["description"] and exam["careers"] and exam["timeline"] and exam["preparation"]
        for exam in flat
    ),
)
check(
    "no seeded card publishes a date or a fee, because the seed verified nothing",
    all(exam["exam_date"] is None and exam["fee_note"] is None for exam in flat),
    str([exam["name"] for exam in flat if exam["exam_date"] or exam["fee_note"]]),
)
check("and none of them claims to be verified", all(exam["verified"] is False for exam in flat))
with SessionLocal() as db:
    seeded = list(db.scalars(select(Exam)))
    invented = [
        row.name
        for row in seeded
        if (row.exam_date or row.fee_note) and not (row.source_url and row.verified)
    ]
check("in the database itself, a figure without a source does not exist", not invented, str(invented))
check("every seeded row names a conducting body", all(row.authority.strip() for row in seeded))

# ---------------------------------------------------------------- 2. who may read what
section("2. the student's map and the operator's table")

anonymous = bare.get("/api/exams/admin")
check("an unknown credential cannot open the operator's table", anonymous.status_code == 401, anonymous.status_code)
as_student = client.get("/api/exams/admin", headers=auth(token))
check("a signed-in student is not an operator", as_student.status_code == 403, as_student.status_code)
check(
    "and is told who does run it, rather than being blamed",
    "whoever runs the site" in as_student.json()["detail"],
    as_student.text[:200],
)
check("the same refusal has to be true of a write", client.post("/api/exams/admin/groups", headers={"Cookie": ""}, json=GROUP).status_code == 401)
write_as_student = client.post("/api/exams/admin/groups", headers=auth(token), json=GROUP)
check("nor may a student add a door", write_as_student.status_code == 403, write_as_student.status_code)
check("the operator does open it", admin_read().status_code == 200)
check(
    "the operator's table is a superset of the student's map",
    {group["id"] for group in public_read().json()} <= {group["id"] for group in admin_read().json()},
)
check(
    "and carries what an editor needs: hidden flags and order",
    all("is_active" in exam and "sort_order" in exam for group in admin_read().json() for exam in group["exams"]),
)

# ---------------------------------------------------------------- 3. the withhold, both ways
section("3. a figure is stored, and published only when it is verified")

created_group = op("POST", "/api/exams/admin/groups", GROUP)
check("a new door is created", created_group.status_code == 201, created_group.text[:200])
group_id = created_group.json()["id"]
check("a new door starts empty", created_group.json()["exams"] == [])
check(
    "and an empty door is not put on the student's map",
    group_id not in {g["id"] for g in public_read().json()},
)

short = op("POST", "/api/exams/admin/exams", {**EXAM, "group_id": group_id, "description": "too short"})
check("a stub sentence is refused", short.status_code == 422, short.status_code)
check("with a message naming the field", "description" in short.text, short.text[:200])

created = op("POST", "/api/exams/admin/exams", {**EXAM, "group_id": group_id})
check("the full card is created", created.status_code == 201, created.text[:300])
exam_id = created.json()["id"]
check("a new row starts unverified", created.json()["verified"] is False)
check("with no date", created.json()["exam_date"] is None)
check("and no fee", created.json()["fee_note"] is None)
check(
    "a new row cannot be created with a date at all",
    op("POST", "/api/exams/admin/exams", {**EXAM, "group_id": group_id, "exam_date": "1 January 2027"}).status_code == 422,
)

duplicate = op("POST", "/api/exams/admin/exams", {**EXAM, "group_id": group_id})
check("the same name twice in one door is refused", duplicate.status_code == 422, duplicate.status_code)
check(
    "and the refusal explains the two answers a child would see",
    "two different answers" in duplicate.json()["detail"],
    duplicate.text[:200],
)

no_source = op("PATCH", f"/api/exams/admin/exams/{exam_id}", {"exam_date": "15 January 2027"})
check("a date with nowhere it came from is refused", no_source.status_code == 422, no_source.status_code)
check("the refusal says what to do about it", "source_url" in no_source.json()["detail"], no_source.text[:250])
fee_no_source = op("PATCH", f"/api/exams/admin/exams/{exam_id}", {"fee_note": "One thousand rupees"})
check("the same guard covers the fee", fee_no_source.status_code == 422, fee_no_source.status_code)
verify_no_source = op("PATCH", f"/api/exams/admin/exams/{exam_id}", {"verified": True})
check("marking a row verified with no source is refused", verify_no_source.status_code == 422, verify_no_source.status_code)
with SessionLocal() as db:
    untouched = db.get(Exam, exam_id)
    check("the refused requests stored nothing: still no date", untouched.exam_date is None, str(untouched.exam_date))
    check("still no fee", untouched.fee_note is None, str(untouched.fee_note))
    check("and still unverified", untouched.verified is False)

half = op("PATCH", f"/api/exams/admin/exams/{exam_id}", {"exam_date": "15 January 2027", "source_url": SOURCE})
check("a date sent with its source is stored", half.status_code == 200, half.text[:250])
check("and saying where it came from is not yet the same as reading it", half.json()["verified"] is False, half.text[:250])
with SessionLocal() as db:
    check("the date is in the database", db.get(Exam, exam_id).exam_date == "15 January 2027")
withheld = [g for g in public_read().json() if g["id"] == group_id]
check("a door with an exam under it reaches the student's map", len(withheld) == 1)
check(
    "while the figure nobody has verified stays off the card",
    withheld[0]["exams"][0]["exam_date"] is None,
    str(withheld[0]["exams"][0]["exam_date"]),
)

verified = op("PATCH", f"/api/exams/admin/exams/{exam_id}", {"verified": True})
check("verification is what the operator ticks", verified.json()["verified"] is True, verified.text[:250])
check("stamped with the day, not with a date the caller typed", verified.json()["verified_at"] is not None)
published = [g for g in public_read().json() if g["id"] == group_id]
card = published[0]["exams"][0]
check("publishing the figure is what verification bought", card["exam_date"] == "15 January 2027", card["exam_date"])
check("and the card names the page it came from", card["source_url"] == SOURCE, str(card["source_url"]))
check("the card says it was verified", card["verified"] is True)

unverify = op("PATCH", f"/api/exams/admin/exams/{exam_id}", {"verified": False})
check("verification can be withdrawn", unverify.status_code == 200, unverify.text[:200])
check("and its date goes with it", unverify.json()["verified_at"] is None)
after = [g for g in public_read().json() if g["id"] == group_id]
check(
    "the withheld figure is off the student's page again",
    not after or after[0]["exams"][0]["exam_date"] is None,
    str(after)[:200],
)
stored_row = [exam for group in admin_read().json() if group["id"] == group_id for exam in group["exams"]][0]
check("while the operator still sees what is stored", stored_row["exam_date"] == "15 January 2027", str(stored_row["exam_date"]))

reverify = op("PATCH", f"/api/exams/admin/exams/{exam_id}", {"verified": True})
check("a row whose source is still on it can be re-verified", reverify.status_code == 200, reverify.text[:200])
clear_source = op("PATCH", f"/api/exams/admin/exams/{exam_id}", {"source_url": ""})
check("clearing that source under a verified row is refused", clear_source.status_code == 422, clear_source.status_code)
check(
    "with a sentence about the source, not about typing a date",
    "part of the record" in clear_source.json()["detail"],
    clear_source.text[:250],
)
bad_source = op("PATCH", f"/api/exams/admin/exams/{exam_id}", {"source_url": "not a url"})
check("a source that is not an address is refused", bad_source.status_code == 422, bad_source.status_code)

# ---------------------------------------------------------------- 4. only what was sent changes
section("4. an edit changes only the fields it names")

renamed = op("PATCH", f"/api/exams/admin/exams/{exam_id}", {"name": "ZZ Suite Exam Renamed", "is_active": False})
check("the name changed", renamed.json()["name"] == "ZZ Suite Exam Renamed", renamed.text[:200])
check("and the row is hidden", renamed.json()["is_active"] is False)
check(
    "the sentences nobody touched are the ones they were",
    renamed.json()["description"] == EXAM["description"],
    renamed.json()["description"][:80],
)
check("the date nobody touched is still stored", renamed.json()["exam_date"] == "15 January 2027")
check("a hidden row leaves the student's map", group_id not in {g["id"] for g in public_read().json()})
check(
    "and stays on the operator's table",
    any(exam["id"] == exam_id for group in admin_read().json() for exam in group["exams"]),
)
group_edit = op("PATCH", f"/api/exams/admin/groups/{group_id}", {"is_active": False})
check("a door can be closed without rewriting its description", group_edit.json()["description"] == GROUP["description"])
check("and a closed door disappears from the map", group_id not in {g["id"] for g in public_read().json()})
check("a door that is not in the catalogue cannot be edited", op("PATCH", "/api/exams/admin/groups/999999", {"title": "Nothing here"}).status_code == 404)
op("PATCH", f"/api/exams/admin/groups/{group_id}", {"is_active": True})

# ---------------------------------------------------------------- 5. the log
section("5. every change leaves a trace with a name on it")

with SessionLocal() as db:
    events = list(db.scalars(select(AuditEvent).where(AuditEvent.subject_type == "exam").order_by(AuditEvent.id)))
actions = [event.action for event in events]
check("the additions are logged", "exam.create" in actions, str(actions))
check("the edits are logged", "exam.update" in actions, str(actions))
check("verification gets its own action", "exam.verify" in actions, str(actions))
check(
    "and a verification is logged as a source being read, not a value being typed",
    any("source" in (event.detail or "") for event in events if event.action == "exam.verify"),
    str([event.detail for event in events if event.action == "exam.verify"]),
)
check("the entries name the operator who made them", all(event.actor_name for event in events), str([event.actor_name for event in events]))
check("the entries point at the row", all(str(event.subject_id) == str(exam_id) for event in events))
check("the log says what changed", any("changed:" in (event.detail or "") for event in events), str([event.detail for event in events][:3]))

# ---------------------------------------------------------------- 6. deleting
section("6. deleting a row, and the door that would take others with it")

not_empty = op("DELETE", f"/api/exams/admin/groups/{group_id}")
check("a door with an exam under it refuses to go", not_empty.status_code == 422, not_empty.status_code)
check(
    "and says what would have been taken off a page somebody is reading",
    "still has exams" in not_empty.json()["detail"],
    not_empty.text[:250],
)
removed = op("DELETE", f"/api/exams/admin/exams/{exam_id}")
check("the exam itself deletes", removed.status_code == 204, removed.text[:200])
with SessionLocal() as db:
    check("and the row is gone", db.get(Exam, exam_id) is None)
check(
    "the deleted row is not on the operator's table",
    not any(exam["id"] == exam_id for group in admin_read().json() for exam in group["exams"]),
)
check("an edit to a row that is not there is refused", op("PATCH", "/api/exams/admin/exams/999999", {"name": "No such row"}).status_code == 404)
check("twice over, deleting it again says so", op("DELETE", f"/api/exams/admin/exams/{exam_id}").status_code == 404)
empty_group = op("DELETE", f"/api/exams/admin/groups/{group_id}")
check("once empty, the door can go", empty_group.status_code == 204, empty_group.text[:200])
check(
    "and the suite leaves the catalogue as it found it",
    not any(group["title"] == GROUP["title"] for group in admin_read().json()),
)

# ---------------------------------------------------------------- 7. the throttles
section("7. the two throttles this page depends on")

fresh_counters()
gate = op("POST", "/api/exams/admin/groups", GROUP).json()["id"]
statuses = [
    client.request(
        "PATCH",
        f"/api/exams/admin/groups/{gate}",
        headers=auth(op_token),
        json={"description": GROUP["description"] + f" {index}"},
    ).status_code
    for index in range(12)
]
check("the first writes go through", statuses[0] == 200, str(statuses))
check("admin writes run out at the minute limit", 429 in statuses, str(statuses))
check("no more than the limit got through", statuses.count(200) == 6, str(statuses))
blocked = client.request(
    "PATCH",
    f"/api/exams/admin/groups/{gate}",
    headers=auth(op_token),
    json={"description": "one past the limit"},
)
check("the blocked request never half-applied", blocked.status_code == 429, blocked.status_code)
check(
    "and the refusal tells the operator the earlier change is saved",
    "already made is saved" in blocked.json()["detail"],
    blocked.text[:250],
)
check("it says how long to wait", blocked.headers.get("retry-after") not in (None, ""), str(dict(blocked.headers)))

fresh_counters()
exempt = [client.get("/api/exams").status_code for _ in range(30)]
check("the student's map is exempt from the read bucket", 429 not in exempt, str(sorted(set(exempt))))
kept = [client.get("/api/exams/admin", headers=auth(op_token)).status_code for _ in range(30)]
check("the operator's table is put back into it", 429 in kept, str(sorted(set(kept))))
throttled = client.get("/api/exams/admin", headers=auth(op_token))
check(
    "the read refusal says nothing was lost",
    throttled.status_code == 429 and "nothing you are reading has changed" in throttled.json()["detail"],
    throttled.text[:250],
)
check("a throttled operator table still leaves the student's page working", client.get("/api/exams").status_code == 200)
fresh_counters()
client.delete(f"/api/exams/admin/groups/{gate}", headers=auth(op_token))
check(
    "the seeded map is the whole map again",
    {g["title"] for g in client.get("/api/exams").json()} == {g["title"] for g in body},
)

LIFESPAN.close()

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + "; ".join(FAIL))
    sys.exit(1)
