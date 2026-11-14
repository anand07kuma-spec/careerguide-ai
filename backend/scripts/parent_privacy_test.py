"""Privacy boundary tests for the parent dashboard.

The child's own words live in three places inside a stored career report:
`activities_enjoyed`, `themes_observed[].evidence` and
`recommendations[].supporting_statements`. The parent dashboard must never
receive any of them — not directly, not copied into a `why` sentence, not
nested under a different key.

This suite plants unique sentinel strings in all three fields, generates a real
report through the API, then checks the parent response from the outside: no
sentinel anywhere in the JSON, the UI-required fields still present, and the
student's own report still whole.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/parent_privacy_test.py
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_parent_privacy.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete, select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import InterestObservation  # noqa: E402

PASS, FAIL = [], []

# Unique enough that a match can only mean this test wrote it.
SENTINEL_ACTIVITIES = "ZQPRIVACTIVITY9F"
SENTINEL_THEME = "ZQPRIVTHEME9F"
SENTINEL_SUPPORT = "ZQPRIVSUPPORT9F"
SENTINEL_PLAN_GOAL = "ZQPRIVPLANGOAL9F"
SENTINEL_PLAN_DETAIL = "ZQPRIVPLANDETAIL9F"
# Phase 3E: live theme evidence and the two free-text profile notes.
SENTINEL_LIVE = "ZQPRIVLIVEEVID9F"
SENTINEL_STORED_THEME = "ZQPRIVSTOREDTHEME9F"
SENTINEL_EDUCATION = "ZQPRIVEDUCONTEXT9F"
SENTINEL_FINANCE = "ZQPRIVFINCONTEXT9F"

FORBIDDEN_KEYS = {
    "activities_enjoyed",
    "themes_observed",
    "supporting_statements",
    "qualifications_to_check",
    "alternatives",
    "named_ambitions",
    "suggested_experiments",
    "content",
    # Phase 3E: a theme row carries taxonomy wording, never observation evidence,
    # and the profile carries structured facts, never the free-text notes.
    "evidence",
    "education_context",
    "financial_context",
}


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + detail) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n== {title} ==")


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def walk_keys(node):
    if isinstance(node, dict):
        for key, value in node.items():
            yield key
            yield from walk_keys(value)
    elif isinstance(node, list):
        for item in node:
            yield from walk_keys(item)


def all_strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for value in node.values():
            yield from all_strings(value)
    elif isinstance(node, list):
        for item in node:
            yield from all_strings(item)


STUDENT = {
    "role": "student",
    "display_name": "Meera",
    "preferred_language": "en",
    "class_level": "class-10",
    "interest_areas": ["drawing"],
    "education_context": f"Studying at a government school {SENTINEL_EDUCATION}",
    "financial_context": f"Our family budget is tight {SENTINEL_FINANCE}",
    "consent_profile": True,
    "consent_voice": True,
    "consent_age": "11-12",
}

PARENT = {
    "role": "parent",
    "display_name": "Mr. Rao",
    "preferred_language": "en",
    "financial_context": "We can manage a government college fee.",
    "consent_profile": True,
    "consent_voice": False,
    "consent_age": "11-12",
}

client = TestClient(app)

with client:
    section("Student report with sentinel-bearing private fields")

    r = client.get("/api/careers")
    careers = r.json()
    check("career catalogue is seeded", r.status_code == 200 and len(careers) >= 40, r.text[:200])
    save_target = careers[0]

    r = client.post("/api/auth/onboarding", json=STUDENT)
    check("student onboarding succeeds", r.status_code == 200, r.text[:200])
    student_token = r.json()["token"]
    student_id = r.json()["user"]["id"]

    # Each statement is the child's own sentence. The engineer one matches a career
    # by name ("engineer" is a named ambition), so it becomes a supporting statement
    # and the stored `why` quotes it. The other two carry the theme and activity
    # sentinels through different fields.
    statements = [
        (f"I want to become an engineer and build robots {SENTINEL_SUPPORT}", "practical_building"),
        (f"I paint landscapes every Sunday {SENTINEL_THEME}", "creative_exploration"),
        (f"I write poems about clouds {SENTINEL_ACTIVITIES}", "creative_exploration"),
    ]
    db = SessionLocal()
    try:
        for evidence, theme in statements:
            db.add(
                InterestObservation(
                    student_id=student_id,
                    theme=theme,
                    evidence=evidence,
                    source="conversation",
                )
            )
        db.commit()
    finally:
        db.close()

    r = client.post("/api/reports", headers=auth(student_token))
    check("report generated for the student", r.status_code == 201, r.text[:300])
    report = r.json()
    content = report.get("content", {})

    check(
        "student report keeps activities_enjoyed verbatim",
        any(SENTINEL_ACTIVITIES in s for s in content.get("activities_enjoyed", [])),
        str(content.get("activities_enjoyed"))[:200],
    )
    check(
        "student report keeps themes_observed evidence verbatim",
        any(
            SENTINEL_THEME in evidence
            for row in content.get("themes_observed", [])
            for evidence in row.get("evidence", [])
        ),
        str(content.get("themes_observed"))[:300],
    )
    check(
        "student report keeps supporting_statements verbatim",
        any(
            SENTINEL_SUPPORT in statement
            for row in content.get("recommendations", [])
            for statement in row.get("supporting_statements", [])
        ),
        str(content.get("recommendations"))[:300],
    )
    quoted = [
        row for row in content.get("recommendations", [])
        if "“" in row.get("why", "") and SENTINEL_SUPPORT in row.get("why", "")
    ]
    check(
        "stored why proves the quote would leak if reused",
        len(quoted) >= 1,
        str([row.get("why") for row in content.get("recommendations", [])])[:300],
    )

    # Replace the sentinel observations with ordinary ones. The report is a snapshot;
    # the live dashboard is rebuilt from what is there now. This keeps the sentinels
    # exclusively in the stored report — exactly the fields under test.
    db = SessionLocal()
    try:
        db.execute(
            delete(InterestObservation).where(InterestObservation.student_id == student_id)
        )
        for evidence, theme in (
            ("I spend weekends building model bridges and fixing my cycle", "practical_building"),
            (
                f"I sketch birds in a notebook and choose colours {SENTINEL_LIVE}",
                "creative_exploration",
            ),
            ("I enjoy maths puzzles and logic questions", "analytical_problem_solving"),
            # A stored value that is not a taxonomy key: the parent DTO must skip
            # it rather than echo it as text.
            ("A neutral sentence for an unknown theme", SENTINEL_STORED_THEME),
        ):
            db.add(
                InterestObservation(
                    student_id=student_id,
                    theme=theme,
                    evidence=evidence,
                    source="conversation",
                )
            )
        db.commit()
    finally:
        db.close()

    r = client.get("/api/reports/latest", headers=auth(student_token))
    latest_student = r.json()
    check("student still retrieves the full stored report", r.status_code == 200 and latest_student)
    student_report_text = json.dumps(latest_student, ensure_ascii=False)
    for label, sentinel in (
        ("activities_enjoyed", SENTINEL_ACTIVITIES),
        ("themes_observed[].evidence", SENTINEL_THEME),
        ("recommendations[].supporting_statements", SENTINEL_SUPPORT),
    ):
        check(
            f"student API retains the {label} sentinel",
            sentinel in student_report_text,
            student_report_text[:300],
        )

    section("Parent dashboard keeps its features")

    r = client.post(
        "/api/auth/onboarding",
        json={**PARENT, "display_name": "Other Parent", "student_name": "Other Child",
              "student_class_level": "class-7", "relationship": "mother"},
    )
    check("parent onboarding succeeds", r.status_code == 200, r.text[:200])
    other_parent_token = r.json()["token"]
    other_child = client.get("/api/parent/children", headers=auth(other_parent_token)).json()[0][
        "student_id"
    ]

    r = client.post("/api/auth/onboarding", json={**PARENT, "display_name": "Ms. Iyer"})
    check("a second parent onboarded", r.status_code == 200, r.text[:200])
    parent_token = r.json()["token"]
    parent_id = r.json()["user"]["id"]

    r = client.get("/api/auth/share-code", headers=auth(student_token))
    code = r.json()["code"]
    check("student has a share code to hand over", r.status_code == 200 and bool(code), r.text[:200])
    r = client.post(
        "/api/auth/link-child",
        json={"code": code, "relationship": "father"},
        headers=auth(parent_token),
    )
    check("parent links through the student's code", r.status_code == 200, r.text[:200])

    r = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(parent_token)
    )
    check("a pending request shares nothing at all", r.status_code == 404, r.text[:200])

    guardians = client.get("/api/auth/guardians", headers=auth(student_token)).json()
    pending = next(row for row in guardians if row["status"] == "pending")
    check(
        "the student sees the request before any sharing",
        pending["can_see_summary"] is False and pending["name"] == "Ms. Iyer",
        str(pending)[:200],
    )
    r = client.post(
        f"/api/auth/guardians/{pending['guardianship_id']}/approve",
        headers=auth(student_token),
    )
    check(
        "the student's approval is what starts sharing",
        r.status_code == 200 and r.json()["status"] == "active" and r.json()["can_see_summary"],
        r.text[:200],
    )

    # Dashboard records the parent legitimately needs to see, all without child words.
    plan = client.post(
        "/api/study-plans",
        json={"title": "Weekend exploration", "goal": f"Read one chapter {SENTINEL_PLAN_GOAL}"},
        headers=auth(student_token),
    )
    check("student creates a study plan", plan.status_code == 201, plan.text[:200])
    plan_id = plan.json()["id"]
    item = client.post(
        f"/api/study-plans/{plan_id}/items",
        json={
            "title": "Read one chapter on bridges",
            "detail": f"My notes about bridges {SENTINEL_PLAN_DETAIL}",
        },
        headers=auth(student_token),
    )
    check("student adds a plan step", item.status_code == 201, item.text[:200])
    saved = client.post(f"/api/careers/{save_target['id']}/save", headers=auth(student_token))
    check("student saves a career", saved.status_code == 201, saved.text[:200])
    session = client.post(
        "/api/conversations", json={"kind": "chat"}, headers=auth(student_token)
    )
    check("student starts a conversation", session.status_code == 201, session.text[:200])

    r = client.get("/api/parent/summary", params={"student_id": student_id}, headers=auth(parent_token))
    check("parent reads the linked child", r.status_code == 200, r.text[:300])
    summary = r.json()

    section("No private field crosses the parent boundary")

    summary_text = json.dumps(summary, ensure_ascii=False)
    for label, sentinel in (
        ("activities_enjoyed", SENTINEL_ACTIVITIES),
        ("themes_observed[].evidence", SENTINEL_THEME),
        ("recommendations[].supporting_statements", SENTINEL_SUPPORT),
        ("study plan goal", SENTINEL_PLAN_GOAL),
        ("study plan item detail", SENTINEL_PLAN_DETAIL),
        ("live observation evidence", SENTINEL_LIVE),
        ("unknown stored theme key", SENTINEL_STORED_THEME),
        ("profile education note", SENTINEL_EDUCATION),
        ("profile financial note", SENTINEL_FINANCE),
    ):
        check(f"parent summary contains no {label} sentinel", sentinel not in summary_text)

    found_keys = set(walk_keys(summary)) & FORBIDDEN_KEYS
    check("parent summary has none of the private report keys", not found_keys, str(found_keys))

    latest = summary.get("latest_report")
    check("latest_report is present with the report's identity", bool(latest) and latest.get("id") == report["id"])
    check(
        "latest_report carries the parent-safe fields",
        set(latest or {}) == {
            "id", "generated_at", "note", "career_titles", "career_directions", "next_steps",
        },
        str(sorted(latest or {})),
    )
    stored_titles = [
        row["career"] for row in content.get("recommendations", []) if row.get("career")
    ]
    check(
        "latest_report keeps the career titles as navigation text",
        (latest or {}).get("career_titles") == stored_titles,
        str((latest or {}).get("career_titles")),
    )
    directions = (latest or {}).get("career_directions", [])
    check(
        "every direction has a career and a quote-free why",
        len(directions) == len(stored_titles)
        and all(d.get("career") and d.get("why") and "“" not in d["why"] for d in directions),
        str(directions)[:400],
    )
    check(
        "latest_report keeps the report's own next steps",
        (latest or {}).get("next_steps") == content.get("next_steps"),
        str((latest or {}).get("next_steps"))[:300],
    )

    recent_reports = summary.get("recent_reports", [])
    check("recent reports are still listed", recent_reports and recent_reports[0]["id"] == report["id"])
    check(
        "recent report rows expose only id, date, note and titles",
        all(set(row) == {"id", "generated_at", "note", "career_titles"} for row in recent_reports),
        str([sorted(row) for row in recent_reports]),
    )
    check(
        "the newest recent report matches latest_report",
        {
            key: recent_reports[0][key]
            for key in ("id", "generated_at", "note", "career_titles")
        }
        == {
            key: latest[key] for key in ("id", "generated_at", "note", "career_titles")
        },
    )

    section("Parent recommendations keep Phase 2 behaviour")

    recommendations = summary.get("recommendations", [])
    check("recommendations are still produced", len(recommendations) > 0, summary_text[:200])
    expected_keys = {
        "career", "why", "open_questions", "skills_to_try", "evidence_level", "next_activity",
    }
    check(
        "each recommendation carries exactly the parent-safe fields",
        all(set(row) == expected_keys for row in recommendations),
        str([sorted(row) for row in recommendations]),
    )
    check(
        "each recommendation keeps career navigation fields",
        all(
            {"id", "slug", "title", "category", "summary", "interest_themes", "min_class"}
            <= set(row.get("career", {}))
            for row in recommendations
        ),
    )
    check(
        "each why is present and never quotes a statement",
        all(row.get("why") and "“" not in row["why"] for row in recommendations),
        str([row.get("why") for row in recommendations])[:400],
    )
    check(
        "each recommendation keeps its guidance",
        all(
            isinstance(row.get("open_questions"), list)
            and isinstance(row.get("skills_to_try"), list)
            and row.get("evidence_level") in {"early", "some", "good"}
            and (row.get("next_activity") is None or isinstance(row["next_activity"], str))
            for row in recommendations
        ),
    )
    themes = summary.get("themes", [])
    check(
        "parent themes keep useful taxonomy labels",
        bool(themes) and all(item.get("label") for item in themes),
        str(themes)[:300],
    )
    check(
        "each theme row is exactly the taxonomy key and label",
        all(set(item) == {"theme", "label"} for item in themes),
        str([sorted(item) for item in themes]),
    )
    check(
        "only shared taxonomy themes cross to the parent",
        all(
            item.get("theme")
            in {
                "creative_exploration",
                "analytical_problem_solving",
                "practical_building",
                "communication_collaboration",
                "helping_others",
                "physical_activity_sports",
                "nature_scientific_curiosity",
                "organization_leadership",
            }
            for item in themes
        ),
        str(themes)[:300],
    )
    check(
        "a theme appears once even with several observations",
        len({item.get("theme") for item in themes}) == len(themes),
        str(themes)[:300],
    )
    check(
        "the child's live sentence is not any theme's label",
        not any(SENTINEL_LIVE in (item.get("label") or "") for item in themes),
        str(themes)[:300],
    )

    section("Other dashboard sections still work")

    check("saved careers still listed", any(
        row.get("career", {}).get("id") == save_target["id"] for row in summary.get("saved_careers", [])
    ))
    check(
        "study plans keep title, progress and next step without the goal",
        summary.get("study_plans")
        and summary["study_plans"][0]["title"] == "Weekend exploration"
        and summary["study_plans"][0]["total_items"] >= 1
        and summary["study_plans"][0]["completed_items"] == 0
        and bool(summary["study_plans"][0]["next_item_title"])
        and "SENTINEL" not in summary["study_plans"][0]["next_item_title"],
        str(summary.get("study_plans"))[:300],
    )
    check("recent conversations still listed", bool(summary.get("recent_sessions")))
    check(
        "journey counts are intact",
        set(summary.get("journey", {}))
        == {"events", "sessions_completed", "careers_saved", "themes_explored",
            "plans_active", "activities_completed", "activities_total"},
        str(summary.get("journey")),
    )
    profile = summary.get("profile") or {}
    check(
        "parent profile keeps the child's structured facts",
        set(profile) == {"class_level", "age", "age_range", "interest_areas"}
        and profile.get("class_level") == "class-10"
        and profile.get("age_range"),
        str(profile)[:300],
    )
    check(
        "parent profile carries no free-text context keys",
        not ({"education_context", "financial_context"} & set(walk_keys(summary))),
        str(profile)[:300],
    )

    section("Student APIs still return the child's own data")

    r = client.get("/api/auth/me", headers=auth(student_token))
    student_profile = (r.json() or {}).get("profile") or {}
    check(
        "student profile route still returns the education note",
        r.status_code == 200 and student_profile.get("education_context") == STUDENT["education_context"],
        str(student_profile)[:300],
    )
    check(
        "student profile route still returns the financial note",
        student_profile.get("financial_context") == STUDENT["financial_context"],
        str(student_profile)[:300],
    )
    r = client.get("/api/interests/observations", headers=auth(student_token))
    observations_text = json.dumps(r.json(), ensure_ascii=False)
    check(
        "student observation API still returns evidence verbatim",
        r.status_code == 200 and SENTINEL_LIVE in observations_text,
        observations_text[:300],
    )

    section("Authorization is unchanged")

    r = client.get(
        "/api/parent/summary", params={"student_id": other_child}, headers=auth(parent_token)
    )
    check("another parent's child stays out of reach", r.status_code == 404, r.text[:200])

    second_student = client.post(
        "/api/auth/onboarding", json={**STUDENT, "display_name": "Unlinked"}
    )
    unlinked_id = second_student.json()["user"]["id"]
    check("a second student exists for the unlinked case", second_student.status_code == 200)
    r = client.get(
        "/api/parent/summary", params={"student_id": unlinked_id}, headers=auth(parent_token)
    )
    check("an existing but unlinked child answers 404", r.status_code == 404, r.text[:200])
    r = client.get(
        "/api/parent/summary", params={"student_id": parent_id}, headers=auth(parent_token)
    )
    check("a parent cannot address their own id as a child", r.status_code == 404, r.text[:200])
    r = client.get(
        "/api/parent/summary", params={"student_id": 999999}, headers=auth(parent_token)
    )
    check("an unknown child id answers 404", r.status_code == 404, r.text[:200])
    r = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(student_token)
    )
    check("a student token is refused by the parent route", r.status_code == 403, r.text[:200])
    r = client.get("/api/reports/latest", headers=auth(parent_token))
    check("a parent token is refused by the student report route", r.status_code == 403, r.text[:200])
    r = client.post("/api/reports", headers=auth(parent_token))
    check("a parent cannot generate a report", r.status_code == 403, r.text[:200])
    r = client.get("/api/parent/summary", params={"student_id": student_id})
    check("an anonymous caller is refused", r.status_code in (401, 403), r.text[:200])

    section("Transcript sharing is unchanged")

    summary = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(parent_token)
    ).json()
    check("transcripts start closed", summary["share_transcripts"] is False)
    guardians = client.get("/api/auth/guardians", headers=auth(student_token)).json()
    check("student sees the linked guardian", len(guardians) == 1, str(guardians)[:200])
    gid = guardians[0]["guardianship_id"]
    r = client.patch(
        f"/api/auth/guardians/{gid}/transcripts",
        json={"share_transcripts": True},
        headers=auth(student_token),
    )
    check("student opens sharing deliberately", r.status_code == 200 and r.json()["can_see_transcripts"], r.text[:200])
    summary = client.get(
        "/api/parent/summary", params={"student_id": student_id}, headers=auth(parent_token)
    ).json()
    check("parent sees the student's choice", summary["share_transcripts"] is True)
    r = client.patch(
        f"/api/auth/guardians/{gid}/transcripts",
        json={"share_transcripts": False},
        headers=auth(parent_token),
    )
    check("parent cannot change the student's choice", r.status_code in (403, 404), r.text[:200])
    r = client.patch(
        f"/api/auth/guardians/{gid}/transcripts",
        json={"share_transcripts": False},
        headers=auth(student_token),
    )
    check("student closes sharing again", r.status_code == 200 and not r.json()["can_see_transcripts"], r.text[:200])

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("\nFAILED CHECKS:")
    for name in FAIL:
        print("  -", name)
sys.exit(1 if FAIL else 0)
