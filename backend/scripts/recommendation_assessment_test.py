"""Assessment results inside career recommendations.

The recommender used to read only conversations, interest observations and the
profile. Phase 4 makes it read the latest *submitted* result of each instrument,
with two promises this file exists to keep:

* a sitting still in progress, or a result too thin to score, changes nothing;
* a real result adds evidence on top of what the student already said, and the
  recommendation says in so many words which dimension pointed where.

Scores are read from `Result.score_json`, never recomputed from saved answers.
The last section changes the raw answers after Submit and proves the wording does
not move: stored scores are what the recommendation used.

Runs against a throwaway database.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/recommendation_assessment_test.py
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_recommendation_assessment_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"

from sqlalchemy import select  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import InterestObservation, Response, Result  # noqa: E402
from app.services import assessment_bank  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)[:220]) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n=== {title}")


BANK = assessment_bank.bank()
INTEREST = [entry for entry in BANK["items"] if entry["type"] == "interest"]
APTITUDE = [entry for entry in BANK["items"] if entry["type"] == "aptitude"]

# The themes each RIASEC area is allowed to point at, mirrored from scoring.py so
# the test can say what a career must carry to count as a match.
R_THEMES = {"practical_building", "physical_activity_sports"}
I_THEMES = {"analytical_problem_solving", "nature_scientific_curiosity"}
A_THEMES = {"creative_exploration"}
S_THEMES = {"helping_others", "communication_collaboration"}


def make_student(client: TestClient, device: str) -> tuple[dict, int]:
    created = client.post(
        "/api/auth/onboarding",
        json={
            "role": "student",
            "display_name": "Recommendation Kid",
            "preferred_language": "en",
            "class_level": "class-8",
            "consent_profile": True,
            "consent_age": "11-12",
            "device_id": device,
        },
    )
    assert created.status_code == 200, created.text
    body = created.json()
    return {"Authorization": f"Bearer {body['token']}"}, body["user"]["id"]


def take_interest(client: TestClient, headers: dict, high: set[str], low_value: str = "2") -> dict:
    """Start, answer every item and submit one interest sitting."""
    started = client.post("/api/assessments/interest/start", headers=headers, json={"language": "en"})
    assert started.status_code == 200, started.text
    assessment_id = started.json()["assessment_id"]
    for entry in INTEREST:
        saved = client.post(
            f"/api/assessments/session/{assessment_id}/answer",
            headers=headers,
            json={"code": entry["code"], "value": "5" if entry["dimension"] in high else low_value},
        )
        assert saved.status_code == 200, saved.text
    submitted = client.post(
        f"/api/assessments/session/{assessment_id}/submit", headers=headers, json={"language": "en"}
    )
    assert submitted.status_code == 200, submitted.text
    return submitted.json()


def take_aptitude(client: TestClient, headers: dict) -> dict:
    """Start, answer every puzzle correctly and submit one aptitude sitting."""
    started = client.post("/api/assessments/aptitude/start", headers=headers, json={"language": "en"})
    assert started.status_code == 200, started.text
    assessment_id = started.json()["assessment_id"]
    for entry in APTITUDE:
        saved = client.post(
            f"/api/assessments/session/{assessment_id}/answer",
            headers=headers,
            json={"code": entry["code"], "value": entry["answer"]},
        )
        assert saved.status_code == 200, saved.text
    submitted = client.post(
        f"/api/assessments/session/{assessment_id}/submit", headers=headers, json={"language": "en"}
    )
    assert submitted.status_code == 200, submitted.text
    return submitted.json()


def recommendations(client: TestClient, headers: dict) -> dict:
    response = client.get("/api/recommendations", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def whys(payload: dict) -> str:
    return " ".join(item["why"] for item in payload["recommendations"])


def careers(client: TestClient, headers: dict) -> dict[str, set[str]]:
    rows = client.get("/api/careers", headers=headers).json()
    return {row["slug"]: set(row["interest_themes"]) for row in rows}


with TestClient(app) as client:
    section("1. no assessment results at all")

    no_assessment, _ = make_student(client, "assess0000no0000result0000device")
    baseline = recommendations(client, no_assessment)
    check("recommendations still come back for a student with no results",
          len(baseline["recommendations"]) >= 1, baseline["recommendations"])
    check("no questionnaire is mentioned when none was submitted",
          "questionnaire" not in whys(baseline).lower(), whys(baseline))
    check("every recommendation still explains itself",
          all(item["why"] for item in baseline["recommendations"]))
    check("the note does not claim questionnaires that do not exist",
          "questionnaire" not in baseline["note"].lower(), baseline["note"])

    section("2. a sitting in progress is not evidence")

    progressing, _ = make_student(client, "assess1111in0000progress0000dev")
    before_start = recommendations(client, progressing)
    start = client.post("/api/assessments/interest/start", headers=progressing, json={"language": "en"})
    sitting = start.json()["assessment_id"]
    for entry in INTEREST:
        client.post(
            f"/api/assessments/session/{sitting}/answer",
            headers=progressing,
            json={"code": entry["code"], "value": "5" if entry["dimension"] in {"R", "I"} else "2"},
        )
    in_progress = recommendations(client, progressing)
    check("answering without submitting changes no recommendation wording",
          whys(in_progress) == whys(before_start), whys(in_progress))
    check("…and nothing claims a finished questionnaire",
          "questionnaire" not in whys(in_progress).lower())
    catalogue_now = client.get("/api/assessments", headers=progressing).json()["instruments"]
    interest_row = next(row for row in catalogue_now if row["type"] == "interest")
    check("…and no Result row exists for an unfinished sitting",
          interest_row["latest"]["result_id"] is None, interest_row)

    submitted = client.post(
        f"/api/assessments/session/{sitting}/submit", headers=progressing, json={"language": "en"}
    )
    check("the sitting submits", submitted.status_code == 200, submitted.text)

    section("3. a submitted result contributes, and says why")

    after = recommendations(client, progressing)
    text = whys(after)
    catalogue = careers(client, progressing)
    check("a finished questionnaire is named in the explanation",
          "interest questionnaire" in text.lower(), text)
    check("the explanation names the dimension and the stored score",
          ("investigating and figuring out" in text.lower() or "building and doing" in text.lower())
          and "out of 100" in text.lower(), text)
    top_themes = catalogue.get(after["recommendations"][0]["career"]["slug"], set())
    check("the strongest recommendation is one the assessment themes point at",
          bool(top_themes & (R_THEMES | I_THEMES)), (top_themes, R_THEMES | I_THEMES))
    check("the set's note admits the suggestions came from questionnaires",
          "questionnaire" in after["note"].lower(), after["note"])
    check("the recommendation count and order still respect the limit",
          len(after["recommendations"]) == 5, len(after["recommendations"]))
    check("the assessment did not put itself into the conversation theme list",
          after["themes"] == [] and after["statement_count"] == 0,
          (after["themes"], after["statement_count"]))

    again = recommendations(client, progressing)
    check("reading twice gives the same explanation, so nothing is re-scored on read",
          whys(again) == text, whys(again))

    persisted = client.post("/api/recommendations/persist", headers=progressing)
    expected_keys = {
        "career", "why", "supporting_statements", "open_questions", "skills_to_try",
        "qualifications_to_check", "alternatives", "evidence_level", "next_activity",
    }
    check("persist keeps the existing recommendation shape",
          persisted.status_code == 200
          and all(set(row) == expected_keys for row in persisted.json()),
          str(persisted.json())[:300])
    check("the stored explanation keeps the questionnaire reason",
          "interest questionnaire" in " ".join(row["why"] for row in persisted.json()).lower())

    section("3b. the puzzle set contributes through its own mapping")

    puzzle, _ = make_student(client, "assess3333puzzle0000dev000")
    take_aptitude(client, puzzle)
    puzzle_set = recommendations(client, puzzle)
    puzzle_text = whys(puzzle_set).lower()
    check("aptitude evidence is named as the aptitude set, not a questionnaire",
          "aptitude puzzles" in puzzle_text, puzzle_text)
    check("the puzzle dimension and stored score are quoted",
          ("numbers" in puzzle_text or "reasoning" in puzzle_text) and "out of 100" in puzzle_text,
          puzzle_text)
    puzzle_catalogue = careers(client, puzzle)
    puzzle_top = puzzle_catalogue.get(puzzle_set["recommendations"][0]["career"]["slug"], set())
    check("the top direction is one the puzzle dimensions point at",
          bool(puzzle_top & {"analytical_problem_solving", "practical_building",
                             "creative_exploration", "communication_collaboration"}),
          puzzle_top)

    section("4. an incomplete result is handled safely")

    incomplete, _ = make_student(client, "assess2222incomplete0000dev0")
    thin_before = recommendations(client, incomplete)
    thin_start = client.post("/api/assessments/interest/start", headers=incomplete, json={"language": "en"})
    thin_id = thin_start.json()["assessment_id"]
    client.post(
        f"/api/assessments/session/{thin_id}/answer",
        headers=incomplete,
        json={"code": INTEREST[0]["code"], "value": "5"},
    )
    thin_submit = client.post(
        f"/api/assessments/session/{thin_id}/submit", headers=incomplete, json={"language": "en"}
    )
    check("one answer is enough to finish, as the app already allowed",
          thin_submit.status_code == 200, thin_submit.text)
    thin_scores = thin_submit.json()["scores"]
    check("…but every dimension is left unscored",
          all(entry["score"] is None for entry in thin_scores.values()), thin_scores)
    thin_after = recommendations(client, incomplete)
    check("an unscored result adds no recommendation evidence",
          whys(thin_after) == whys(thin_before) and "questionnaire" not in whys(thin_after).lower(),
          whys(thin_after))

    section("5. assessment and conversation evidence combine")

    combined, combined_id = make_student(client, "assess3333combined0000dev00")
    with SessionLocal() as db:
        db.add(
            InterestObservation(
                student_id=combined_id,
                theme="creative_exploration",
                evidence="I want to be a designer one day.",
                source="conversation",
            )
        )
        db.commit()

    talk_first = recommendations(client, combined)
    check("conversation evidence still drives the first set",
          "creative_exploration" in talk_first["themes"], talk_first["themes"])
    check("a named ambition is still quoted in the reason",
          "designer" in whys(talk_first).lower(), whys(talk_first))

    take_interest(client, combined, {"R", "I"})
    talk_and_scores = recommendations(client, combined)
    combined_text = whys(talk_and_scores)
    check("the conversation theme survives the assessment",
          "creative_exploration" in talk_and_scores["themes"], talk_and_scores["themes"])
    check("a recommendation still quotes what the student said",
          any("designer" in item["why"].lower() for item in talk_and_scores["recommendations"]),
          combined_text)
    check("the assessment evidence appears alongside it",
          "interest questionnaire" in combined_text.lower(), combined_text)
    check("both kinds of evidence reach the same set",
          len(talk_and_scores["recommendations"]) >= 2, talk_and_scores["recommendations"])

    section("6. only the latest submitted sitting of each instrument counts")

    latest, _ = make_student(client, "assess4444latest0000dev00000")
    take_interest(client, latest, {"A", "S"})
    old_set = recommendations(client, latest)
    check("the first sitting points at creating and helping",
          "creating and expressing" in whys(old_set).lower()
          or "helping and teaching" in whys(old_set).lower(),
          whys(old_set))

    take_interest(client, latest, {"R", "I"})
    new_set = recommendations(client, latest)
    new_text = whys(new_set).lower()
    check("the newer sitting's dimensions are the ones explained",
          "building and doing" in new_text or "investigating and figuring out" in new_text,
          new_text)
    check("the older sitting's dimensions are gone",
          "creating and expressing" not in new_text and "helping and teaching" not in new_text,
          new_text)
    latest_catalogue = careers(client, latest)
    top = latest_catalogue.get(new_set["recommendations"][0]["career"]["slug"], set())
    check("the top direction follows the newer result",
          bool(top & (R_THEMES | I_THEMES)) and not bool(top & (A_THEMES | S_THEMES)),
          top)

    section("7. recommendations read stored scores, not re-scored answers")

    with SessionLocal() as db:
        stored = db.scalars(
            select(Result).where(Result.user_id == combined_id).order_by(Result.id.desc())
        ).first()
        check("the submitted result is on disk", stored is not None)
        if stored is not None:
            dimensions = (stored.score_json or {}).get("dimensions", {})
            check("stored dimensions carry the scored 100s",
                  any(entry["score"] == 100 for entry in dimensions.values()), dimensions)
            db.execute(
                Response.__table__.update()
                .where(Response.assessment_id == stored.assessment_id)
                .values(value="1")
            )
            db.commit()

    after_tamper = recommendations(client, combined)
    check("changing raw answers afterwards does not move the explanation",
          whys(after_tamper) == combined_text, whys(after_tamper))
    check("…because the stored score is still what is quoted",
          "100 out of 100" in whys(after_tamper).lower(), whys(after_tamper))

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
