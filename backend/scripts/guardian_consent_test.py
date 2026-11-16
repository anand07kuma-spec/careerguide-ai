"""The guardian relationship as a request, an approval and a withdrawal.

The parent dashboard is only half the privacy story. The other half is *how a parent
gets there at all*, and these checks follow that path end to end:

* A sharing code creates a request. Before the student approves it, every parent route
  answers 404 — `/children`, `/summary`, `/guidance` — and the parent's own `/me` carries
  no child profile. Knowledge of a name, an address or an account id is never enough.
* The student's approval is the only thing that starts sharing, and it is recorded as a
  consent row the student can see.
* Redeeming the same code again cannot make a second row, and a revoked pair reuses its
  one row rather than slipping past the database's unique rule.
* Withdrawing the `history_sharing` consent — the switch the privacy screen already
  offers — revokes every link at once, clears transcript sharing, and a parent's next
  request reaches nothing. Approving again is a new decision, not a restoration.
* A parent who was never linked, or whose link was declined, reaches nothing; another
  family's approved child stays out of reach by id.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/guardian_consent_test.py
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_guardian_consent.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Guardianship  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + detail) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n== {title} ==")


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def onboard(payload: dict) -> tuple[str, int]:
    response = client.post("/api/auth/onboarding", json=payload)
    assert response.status_code == 200, response.text[:400]
    body = response.json()
    return body["token"], body["user"]["id"]


STUDENT = {
    "role": "student",
    "display_name": "Meera",
    "preferred_language": "en",
    "class_level": "class-10",
    "interest_areas": ["drawing"],
    "consent_profile": True,
    "consent_voice": False,
    "consent_age": "11-12",
}
PARENT = {
    "role": "parent",
    "display_name": "Ms. Iyer",
    "preferred_language": "en",
    "consent_profile": True,
    "consent_voice": False,
    "consent_age": "11-12",
}

client = TestClient(app)
# No shared cookie jar: a caller who never signed in must be refused by the dependency,
# not judged by whichever session the previous request left behind.
stranger = TestClient(app)

with client:
    section("A code is a request, not access")

    student_token, student_id = onboard(STUDENT)
    other_student_token, other_student_id = onboard({**STUDENT, "display_name": "Kabir"})
    parent_token, parent_id = onboard(PARENT)
    other_parent_token, other_parent_id = onboard({**PARENT, "display_name": "Mr. Rao"})

    r = client.get("/api/auth/share-code", headers=auth(student_token))
    code = r.json()["code"]
    check("the student has a code to hand over", r.status_code == 200 and bool(code), r.text[:200])

    r = client.post(
        "/api/auth/link-child",
        json={"code": "ZZZZZZ", "relationship": "father"},
        headers=auth(parent_token),
    )
    check("a wrong code matches nothing", r.status_code == 404, r.text[:200])
    with SessionLocal() as db:
        check(
            "and no row was written by the attempt",
            int(db.scalar(select(func.count()).select_from(Guardianship)) or 0) == 0,
        )

    r = client.post(
        "/api/auth/link-child",
        json={"code": code, "relationship": "mother"},
        headers=auth(parent_token),
    )
    check("the code creates a request", r.status_code == 200, r.text[:200])
    requested = r.json()[0]
    check(
        "the request is pending and shares nothing",
        requested["status"] == "pending"
        and requested["can_see_summary"] is False
        and requested["consented_at"] is None,
        str(requested)[:300],
    )

    r = client.get("/api/parent/children", headers=auth(parent_token))
    check("a pending child is not in the parent's list", r.status_code == 200 and r.json() == [], r.text[:200])
    r = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(parent_token)
    )
    check("a pending request reaches no summary", r.status_code == 404, r.text[:200])
    check("and the answer carries no child data", "Meera" not in r.text, r.text[:200])
    r = client.get(
        "/api/parent/guidance",
        params={"student_id": student_id, "concern": "fees"},
        headers=auth(parent_token),
    )
    check("a pending request reaches no guidance either", r.status_code == 404, r.text[:200])
    r = client.get("/api/auth/me", headers=auth(parent_token))
    check(
        "the parent's own session carries no child profile yet",
        r.status_code == 200 and r.json().get("profile") is None,
        r.text[:300],
    )
    r = client.patch(
        "/api/auth/profile", json={"display_name": "Changed by parent"}, headers=auth(parent_token)
    )
    check("a pending request cannot edit the child's profile", r.status_code == 404, r.text[:200])

    r = client.get("/api/auth/guardians", headers=auth(student_token))
    guardians = r.json()
    check(
        "the student sees who asked and that nothing is shared",
        len(guardians) == 1
        and guardians[0]["status"] == "pending"
        and guardians[0]["can_see_summary"] is False
        and guardians[0]["name"] == "Ms. Iyer",
        str(guardians)[:300],
    )
    gid = guardians[0]["guardianship_id"]

    r = client.post(f"/api/auth/guardians/{gid}/approve", headers=auth(parent_token))
    check("a parent cannot approve their own request", r.status_code == 404, r.text[:200])
    r = client.post(f"/api/auth/guardians/{gid}/approve", headers=auth(other_student_token))
    check("another student cannot approve it", r.status_code == 404, r.text[:200])
    r = stranger.post(f"/api/auth/guardians/{gid}/approve")
    check("an anonymous caller cannot approve it", r.status_code in (401, 403), r.text[:200])

    section("Approval is the student's own decision")

    r = client.post(f"/api/auth/guardians/{gid}/approve", headers=auth(student_token))
    approved = r.json()
    check(
        "the student approves and the link becomes active",
        r.status_code == 200
        and approved["status"] == "active"
        and approved["can_see_summary"] is True
        and approved["consented_at"] is not None,
        r.text[:300],
    )
    r = client.get("/api/parent/children", headers=auth(parent_token))
    check(
        "the child now appears in the parent's list",
        r.status_code == 200 and [row["student_id"] for row in r.json()] == [student_id],
        r.text[:300],
    )
    r = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(parent_token)
    )
    check("the approved parent can read the summary", r.status_code == 200, r.text[:300])
    r = client.get("/api/auth/me", headers=auth(parent_token))
    check(
        "and the parent's session carries the child's profile",
        r.status_code == 200 and r.json().get("profile") is not None,
        r.text[:300],
    )
    r = client.get("/api/auth/consent", headers=auth(student_token))
    history = [row for row in r.json() if row["scope"] == "history_sharing"]
    check(
        "the approval is recorded as the student's consent",
        history and history[-1]["granted"] is True,
        str(r.json())[:300],
    )

    section("Duplicates, other families and other students")

    r = client.post(
        "/api/auth/link-child", json={"code": code, "relationship": "mother"}, headers=auth(parent_token)
    )
    check("redeeming the same code again is harmless", r.status_code == 200, r.text[:200])
    with SessionLocal() as db:
        count = int(
            db.scalar(
                select(func.count())
                .select_from(Guardianship)
                .where(
                    Guardianship.parent_id == parent_id,
                    Guardianship.student_id == student_id,
                )
            )
            or 0
        )
    check("and the database holds exactly one row for the pair", count == 1, str(count))

    r = client.get(
        "/api/parent/summary", params={"student_id": other_student_id}, headers=auth(parent_token)
    )
    check("an unlinked child stays out of reach by id", r.status_code == 404, r.text[:200])
    r = client.get(
        "/api/parent/summary", params={"student_id": 999999}, headers=auth(parent_token)
    )
    check("an unknown id answers the same way", r.status_code == 404, r.text[:200])
    r = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(other_parent_token)
    )
    check("a parent who never had a code reaches nothing", r.status_code == 404, r.text[:200])

    # Two approved families exist at the same time: each must see only its own child.
    other_code = client.get("/api/auth/share-code", headers=auth(other_student_token)).json()["code"]
    r = client.post(
        "/api/auth/link-child", json={"code": other_code}, headers=auth(other_parent_token)
    )
    other_gid = r.json()[0]["guardianship_id"]
    client.post(f"/api/auth/guardians/{other_gid}/approve", headers=auth(other_student_token))
    r = client.get(
        "/api/parent/summary", params={"student_id": other_student_id}, headers=auth(parent_token)
    )
    check("one family's approval does not open another family's child", r.status_code == 404, r.text[:200])
    r = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(other_parent_token)
    )
    check("and the reverse is true too", r.status_code == 404, r.text[:200])

    section("Conversation text stays the student's separate choice")

    r = client.patch(
        f"/api/auth/guardians/{gid}/transcripts",
        json={"share_transcripts": True},
        headers=auth(parent_token),
    )
    check("a parent cannot open transcript sharing", r.status_code in (403, 404), r.text[:200])
    r = client.patch(
        f"/api/auth/guardians/{gid}/transcripts",
        json={"share_transcripts": True},
        headers=auth(student_token),
    )
    check("the student can, on an approved link", r.status_code == 200 and r.json()["can_see_transcripts"], r.text[:200])
    r = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(parent_token)
    )
    check("the parent sees the student's choice", r.json()["share_transcripts"] is True)

    section("Withdrawing consent ends every link at once")

    r = client.post(
        "/api/auth/consent",
        json={"scope": "history_sharing", "granted": False},
        headers=auth(student_token),
    )
    check("the existing privacy switch records the withdrawal", r.status_code == 200 and r.json()["granted"] is False, r.text[:200])

    r = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(parent_token)
    )
    check("the parent's very next request reaches nothing", r.status_code == 404, r.text[:200])
    r = client.get("/api/parent/children", headers=auth(parent_token))
    check("and their child list is empty", r.status_code == 200 and r.json() == [], r.text[:200])
    r = client.get("/api/auth/me", headers=auth(parent_token))
    check("and their session no longer carries the profile", r.json().get("profile") is None, r.text[:200])
    r = client.get("/api/auth/guardians", headers=auth(student_token))
    guardians = r.json()
    check(
        "the student sees the link as withdrawn",
        guardians[0]["status"] == "revoked"
        and guardians[0]["can_see_summary"] is False
        and guardians[0]["can_see_transcripts"] is False
        and guardians[0]["withdrawn_at"] is not None,
        str(guardians)[:300],
    )
    r = client.patch(
        f"/api/auth/guardians/{gid}/transcripts",
        json={"share_transcripts": True},
        headers=auth(student_token),
    )
    check("a revoked link cannot have transcripts switched on", r.status_code == 409, r.text[:200])

    section("Withdrawing is not a permanent lock — asking again is a new decision")

    r = client.post(
        "/api/auth/link-child", json={"code": code, "relationship": "mother"}, headers=auth(parent_token)
    )
    check("the same code creates a fresh request", r.status_code == 200, r.text[:200])
    with SessionLocal() as db:
        count = int(
            db.scalar(
                select(func.count())
                .select_from(Guardianship)
                .where(
                    Guardianship.parent_id == parent_id,
                    Guardianship.student_id == student_id,
                )
            )
            or 0
        )
    check("still one row, reset to pending rather than duplicated", count == 1, str(count))
    r = client.get("/api/auth/guardians", headers=auth(student_token))
    check("and the student sees a pending request again", r.json()[0]["status"] == "pending", str(r.json())[:200])
    r = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(parent_token)
    )
    check("the fresh request still shares nothing", r.status_code == 404, r.text[:200])

    r = client.post(f"/api/auth/guardians/{gid}/approve", headers=auth(student_token))
    check("the student can approve it again deliberately", r.status_code == 200 and r.json()["status"] == "active", r.text[:200])
    r = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(parent_token)
    )
    check("and access returns without any transcript sharing", r.status_code == 200 and r.json()["share_transcripts"] is False, r.text[:200])

    section("Declining and removing")

    decline_token, decline_id = onboard({**PARENT, "display_name": "Mr. Declined"})
    r = client.post(
        "/api/auth/link-child", json={"code": code}, headers=auth(decline_token)
    )
    decline_gid = r.json()[0]["guardianship_id"]
    check("a third adult's request waits like any other", r.json()[0]["status"] == "pending", r.text[:200])
    r = client.delete(f"/api/auth/guardians/{decline_gid}", headers=auth(student_token))
    check("the student declines by deleting the request", r.status_code == 204, r.text[:200])
    r = client.get("/api/parent/children", headers=auth(decline_token))
    check("the declined adult sees no child", r.json() == [], r.text[:200])
    r = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(decline_token)
    )
    check("and no summary", r.status_code == 404, r.text[:200])

    r = client.post(
        "/api/auth/link-child", json={"code": code}, headers=auth(decline_token)
    )
    decline_gid = r.json()[0]["guardianship_id"]
    r = client.delete(f"/api/auth/guardians/{decline_gid}", headers=auth(decline_token))
    check("an adult can withdraw their own pending request", r.status_code == 204, r.text[:200])
    r = client.get("/api/auth/guardians", headers=auth(student_token))
    check(
        "and the student's approved parent is untouched",
        len(r.json()) == 1 and r.json()[0]["status"] == "active",
        str(r.json())[:200],
    )

    section("A child account created during a parent's own onboarding")

    creator_token, creator_id = onboard(
        {**PARENT, "display_name": "Ms. Creator", "student_name": "Riya",
         "student_class_level": "class-8", "relationship": "mother"}
    )
    r = client.get("/api/parent/children", headers=auth(creator_token))
    check(
        "the account the guardian created is linked from the start",
        r.status_code == 200 and len(r.json()) == 1 and r.json()[0]["label"] == "Riya",
        r.text[:200],
    )
    r = client.get(
        "/api/parent/summary",
        params={"student_id": r.json()[0]["student_id"]},
        headers=auth(creator_token),
    )
    check("because there was no other person's account to join", r.status_code == 200, r.text[:200])
    r = client.get("/api/auth/guardians", headers=auth(creator_token))
    check(
        "and it is reported as approved, not pending",
        r.json()[0]["status"] == "active" and r.json()[0]["consented_at"] is not None,
        str(r.json())[:200],
    )

    section("The parent dashboard's own fields do not widen")

    summary = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(parent_token)
    ).json()
    forbidden = {
        "education_context", "financial_context", "evidence", "content",
        "supporting_statements", "activities_enjoyed", "themes_observed",
    }

    def walk_keys(node):
        if isinstance(node, dict):
            for key, value in node.items():
                yield key
                yield from walk_keys(value)
        elif isinstance(node, list):
            for item in node:
                yield from walk_keys(item)

    check(
        "an approved summary still omits the child's free-text notes",
        not (forbidden & set(walk_keys(summary))),
        str(forbidden & set(walk_keys(summary))),
    )
    check(
        "and the response still contains no conversation content",
        "A private sentence" not in json.dumps(summary),
    )

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("\nFAILED CHECKS:")
    for name in FAIL:
        print("  -", name)
sys.exit(1 if FAIL else 0)
