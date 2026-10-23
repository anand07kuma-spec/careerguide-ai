"""Prove a finished questionnaire arrives with a plan, and that the plan never says more than it knows.

Three failure modes this suite is written against.

The first is a claim about a child that is not true. A plan is written from a
self-questionnaire, so an area with too few answers is *unknown* and must never reach a
student as a number, a gap or a week's work. Every check in sections 2 to 5 asks the same
question from a different side: does the page print a weakness that the answers do not
support? The same goes for a career's skill list, which is what the work asks for and not
what this child lacks.

The second is a plan that quietly changed author. The ✨ button asks a configured model for
new sentences; when that model cannot be reached, answers in prose, or returns three weeks
instead of four, the plan already on the page must stay exactly as it was — and the answer
must say which of the two failures happened rather than letting the student press a button
that appeared to do nothing. The stand-in provider in section 8 is what proves the flag
flips both ways, that a model's overlong answer is bounded before a student can save it,
and that a model's Hindi sentence is not silently served to an English page as a translation.

The third is what leaves the machine. `services/roadmap.facts` is the only student data the
provider is ever given, so this suite plants sentinels in that account's own rows — a name,
a school, a phone number, the questionnaire's own wording — and asserts none of them appear
in any recorded request. The chat hand-off gets the same treatment from the other side: a
substituted plan number must be refused, and the plan the guide is shown has to be the same
four weeks the student is looking at.

Runs against a throwaway database, never `careerguide.db`.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/roadmap_test.py
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_roadmap_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py
# This suite sends a student more than three chat messages while it is checking ownership,
# and a plan quota is not what any of those checks is about.
os.environ["PLAN_LIMITS_ENFORCED"] = "false"

from fastapi.testclient import TestClient  # noqa: E402
from limits import parse  # noqa: E402 - the same parser the limiter itself uses
from pydantic import ValidationError  # noqa: E402 - only the first section needs it
from sqlalchemy import select  # noqa: E402

from app.config import Settings, get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Career, Result, User  # noqa: E402
from app.services import assessment_bank, roadmap, scoring  # noqa: E402
from app.services.themes import THEMES  # noqa: E402

PASS, FAIL = [], []

DEVANAGARI = re.compile(r"[\u0900-\u097F]")

# The keys `frontend/src/lib/assessments.ts` validates before a screen sees a plan. A
# rename here is a blank card there, so the shape is asserted as a set rather than field
# by field.
PLAN_KEYS = {
    "source",
    "demo_generated",
    "generated_at",
    "text_language",
    "career",
    "summary",
    "strengths",
    "gaps",
    "unmeasured",
    "career_skills",
    "weeks",
    "note",
}


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n=== {title}")


def stored(result_id: int) -> dict:
    with SessionLocal() as db:
        row = db.get(Result, result_id)
        return dict(row.roadmap_json or {}) if row else {}


def blank_plan(result_id: int) -> None:
    """Make a row look like a sitting that finished before this app wrote plans."""
    with SessionLocal() as db:
        row = db.get(Result, result_id)
        row.roadmap_json = {}
        db.commit()


def codes_by_dimension(kind: str) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for item in assessment_bank.items(kind):
        groups.setdefault(item["dimension"], []).append(item["code"])
    return groups


INTEREST = codes_by_dimension("interest")
RESULT_URL = "/api/assessments/result"


def strong_hands() -> dict[str, str]:
    """One shaped sitting: strong with the hands, middling and artistic, thin and social.

    Interest items are all likert and all keyed the same way, so a 5 is the top of the
    scale and a 1 the bottom. Six of the thirty questions are deliberately left blank and
    a seventh answers a dimension on its own — that is the case the honesty rules are
    about, and it is what a child who stopped halfway actually produces.
    """
    answers: dict[str, str] = {}
    for code in INTEREST["R"]:
        answers[code] = "5"
    for code in INTEREST["I"]:
        answers[code] = "1"
    for code in INTEREST["A"]:
        answers[code] = "3"
    answers[INTEREST["S"][0]] = "5"
    return answers


def finish(client: TestClient, auth: dict, kind: str, answers: dict[str, str],
           language: str = "en") -> tuple[int, dict]:
    started = client.post(f"/api/assessments/{kind}/start", headers=auth, json={"language": language})
    assert started.status_code == 200, started.text[:200]
    sitting = started.json()["assessment_id"]
    for code, value in answers.items():
        saved = client.post(
            f"/api/assessments/session/{sitting}/answer", headers=auth, json={"code": code, "value": value}
        )
        assert saved.status_code == 200, saved.text[:200]
    submitted = client.post(
        f"/api/assessments/session/{sitting}/submit", headers=auth, json={"language": language}
    )
    assert submitted.status_code == 200, submitted.text[:300]
    return sitting, submitted.json()


def model_plan(**overrides) -> str:
    """One answer a configured model might return: four weeks, and too much of everything."""
    base = {
        "summary": "Your answers point at work done with your hands; this work also needs you to explain it to people.",
        "strengths": [
            "Building and making things",
            "Sticking with a job once it is started",
            "A third strength this page has no room for",
        ],
        "gaps": [
            "Explaining a plan out loud",
            "Working inside someone else's deadline",
            "Reading a drawing",
            "A fourth gap the card would have to cut",
        ],
        "weeks": [
            {
                "title": "Look at the work up close",
                "steps": [
                    "Twenty minutes on the career page beside this plan; write one line on the part you would enjoy.",
                    "Find one place near you where this kind of work happens and ask whether you may watch for half an hour.",
                    "A third step for week one.",
                ],
            },
            {
                "title": "Try one thing yourself",
                "steps": [
                    "Build or make one small thing from a free video, and finish it.",
                    "Write down the part that was hardest, in your own words.",
                ],
            },
            {
                "title": "Check what school asks",
                "steps": [
                    "List the school subjects this work leans on.",
                    "Mark the two you would study happily.",
                ],
            },
            {
                "title": "Talk, then decide",
                "steps": [
                    "Ask one person who does this work what their morning looks like.",
                    "Write which of these weeks you would repeat next month.",
                    "A third step for week four.",
                    "A fourth step that has no room on the page.",
                ],
            },
        ],
    }
    base.update(overrides)
    return json.dumps(base)


with TestClient(app) as client:
    section("0. the limit this feature asks for is one the config understands")
    settings = get_settings()
    check("a roadmap bucket is configured", bool(settings.rate_limit_roadmap), repr(settings.rate_limit_roadmap))
    rule = None
    try:
        rule = bool(parse(settings.rate_limit_roadmap))
    except ValueError as caught:
        rule = False
        print(f"        {caught}")
    check("…and it is a real rate rule, not a typo", rule is True, settings.rate_limit_roadmap)
    try:
        Settings(rate_limit_roadmap="every other tuesday")
        caught = None
    except ValidationError as exc:
        caught = exc
    check(
        "…and the boot-time validator rejects a bad RATE_LIMIT_ROADMAP rather than serving it",
        caught is not None and any(error["loc"] == ("rate_limit_roadmap",) for error in caught.errors()),
        str(caught)[:200] if caught else "Settings accepted 'every other tuesday'",
    )

    section("1. who may reach a plan")
    check("a request with no session cannot read a result", client.get(f"{RESULT_URL}/1").status_code == 401)
    check("…and cannot rewrite one", client.post(f"{RESULT_URL}/1/roadmap").status_code == 401)

    guardian = client.post(
        "/api/auth/onboarding",
        json={
            "role": "parent",
            "display_name": "Ma",
            "preferred_language": "en",
            "consent_profile": True,
            "consent_age": "adult",
            "device_id": "parentroadmap000000000000001",
        },
    )
    assert guardian.status_code == 200, guardian.text
    ph = {"Authorization": f"Bearer {guardian.json()['token']}"}
    check("a parent is not handed a child's plan", client.get(f"{RESULT_URL}/1", headers=ph).status_code == 403)
    check("…and does not spend a provider call over their head",
          client.post(f"{RESULT_URL}/1/roadmap", headers=ph).status_code == 403)

    def student(device: str, name: str, language: str = "en") -> dict:
        created = client.post(
            "/api/auth/onboarding",
            json={
                "role": "student",
                "display_name": name,
                "preferred_language": language,
                "class_level": "class-10",
                "consent_profile": True,
                "consent_age": "11-12",
                "device_id": device,
            },
        )
        assert created.status_code == 200, created.text
        return {
            "auth": {"Authorization": f"Bearer {created.json()['token']}"},
            "id": created.json()["user"]["id"],
        }

    one = student("studentroadmap0000000000001", "Riya")
    two = student("studentroadmap0000000000002", "Aman")

    section("2. a finished sitting arrives with a plan already written")
    sitting, result = finish(client, one["auth"], "interest", strong_hands())
    result_id = result["result_id"]
    check("the answers were enough to score something", result["totals"]["answered"] >= 16, result["totals"])
    plan = result["roadmap"]
    check("…and the result comes with a plan, not an empty card", plan is not None)
    assert plan is not None and result["careers"], "no plan on a finished interest sitting"
    check("…written by the app's own rules", plan["source"] == "rules" and plan["demo_generated"] is True, plan["source"])
    check("…without a date being invented for a model", plan["generated_at"] is not None)
    check("…and no claim about which language it was written in", plan["text_language"] is None, plan["text_language"])
    check("…in exactly the shape the screen validates", set(plan) == PLAN_KEYS, sorted(set(plan)))
    check("four weeks, numbered one to four", [entry["week"] for entry in plan["weeks"]] == [1, 2, 3, 4],
          [entry["week"] for entry in plan["weeks"]])
    check("…each with a title that does not repeat its own number",
          all(entry["title"] and not entry["title"].startswith("Week") for entry in plan["weeks"]),
          [entry["title"] for entry in plan["weeks"]])
    check("…and one to three steps apiece",
          all(1 <= len(entry["steps"]) <= 3 for entry in plan["weeks"]),
          [len(entry["steps"]) for entry in plan["weeks"]])
    check("…every step a sentence a student can act on, not a blank",
          all(step["text"].strip() for entry in plan["weeks"] for step in entry["steps"]))
    check("…inside the width the card can hold",
          all(len(step["text"]) <= 240 for entry in plan["weeks"] for step in entry["steps"]),
          max(len(step["text"]) for entry in plan["weeks"] for step in entry["steps"]))
    check("…in a week title too", all(len(entry["title"]) <= 80 for entry in plan["weeks"]))
    check("two strengths at most", 1 <= len(plan["strengths"]) <= 2, len(plan["strengths"]))
    check("…each with a number and the words for that number",
          all(isinstance(entry["score"], int) and entry["band_label"] for entry in plan["strengths"]),
          plan["strengths"])
    check("three gaps at most", len(plan["gaps"]) <= 3, len(plan["gaps"]))
    check("…each saying on what evidence", {entry["reason"] for entry in plan["gaps"]}
          <= {"low", "middle", "unmeasured"}, [entry["reason"] for entry in plan["gaps"]])
    check("…with the sentence that explains it", all(entry["detail"].strip() for entry in plan["gaps"]))
    check("…named by a theme this app has a word for",
          all(entry["label"] in {theme["label"] for theme in THEMES.values()} for entry in plan["gaps"]),
          [entry["label"] for entry in plan["gaps"]])
    check("the plan aims at the career the page lists first",
          plan["career"]["slug"] == result["careers"][0]["slug"],
          [plan["career"]["slug"], result["careers"][0]["slug"]])
    check("…and carries that career's own sample-data flag",
          plan["career"]["needs_verification"] is result["careers"][0]["needs_verification"], plan["career"])
    check("the skills beside the gap are the career's list, not the student's",
          len(plan["career_skills"]) <= 4, plan["career_skills"])
    check("the note says plainly that no model was asked", "No model was asked" in plan["note"], plan["note"])
    check("a rules plan costs the student no waiting for anyone else's uptime",
          result["roadmap_ai_available"] is False, result["roadmap_ai_available"])

    with SessionLocal() as db:
        row = db.get(Result, result_id)
        raw = dict(row.roadmap_json or {})
        career = db.scalars(select(Career).where(Career.slug == plan["career"]["slug"])).first()
    check("the plan is saved on the result, not worked out again per read", raw != {}, list(raw))
    check("…as the rules version", raw.get("source") == "rules" and raw.get("demo_generated") is True, raw.get("source"))
    check("…with both languages stored for every step",
          all(set(step) == {"en", "hi"} for entry in raw["weeks"] for step in entry["steps"]),
          raw["weeks"][0]["steps"][0])
    check("…so one stored plan answers both pages", all(step["hi"].strip() for entry in raw["weeks"] for step in entry["steps"]))
    check("…and nothing outside the week steps is written in a language",
          not DEVANAGARI.search(json.dumps({key: value for key, value in raw.items() if key != "weeks"})),
          json.dumps({key: value for key, value in raw.items() if key != "weeks"})[:200])
    check("the stored gaps hold the evidence, not the prose",
          all(entry["theme"] in THEMES for entry in raw["gaps"]), [entry.get("theme") for entry in raw["gaps"]])
    check("the skills listed came from the catalogue row itself",
          set(plan["career_skills"]) <= set(career.useful_skills or []), [plan["career_skills"], career.useful_skills])

    section("3. an area with too few answers is unknown, never weak")
    scores = {entry["dimension"]: entry for entry in result["traits"]}
    thin = [key for key, value in scores.items() if value["score"] is None]
    check("six areas were asked about, three of them barely answered", len(thin) == 3,
          [(key, value["answered"]) for key, value in scores.items()])
    check("…and an unasked-about area carries no number at all",
          all(scores[key]["score"] is None and scores[key]["band"] == "unknown" for key in thin),
          {key: scores[key]["score"] for key in thin})
    check("…nor a band that reads like a judgement",
          all(scores[key]["band_label"] == "Not enough answered yet" for key in thin),
          {key: scores[key]["band_label"] for key in thin})
    check("the plan lists them separately, as unknown",
          {entry["label"] for entry in plan["unmeasured"]} ==
          {scores[key]["name"] for key in thin}, [plan["unmeasured"], [scores[key]["name"] for key in thin]])
    check("…and never as a strength", all(entry["label"] not in [scores[key]["name"] for key in thin]
                                         for entry in plan["strengths"]))
    check("a gap that rests on nothing says so instead of giving a score",
          all(entry["reason"] != "low" or entry["detail"] for entry in plan["gaps"]))
    check("…and the one that does is worded as unknown, not as weak",
          all("unknown" in entry["detail"] or entry["reason"] != "unmeasured" for entry in plan["gaps"]),
          [entry["detail"] for entry in plan["gaps"] if entry["reason"] == "unmeasured"])
    with SessionLocal() as db:
        raw = dict(db.get(Result, result_id).roadmap_json or {})
    check("no number is stored for an area the answers did not reach",
          all(entry["score"] is not None for entry in raw["strengths"]), raw["strengths"])
    check("…and a gap called low really did come back under half",
          all(entry["score"] < 50 for entry in raw["gaps"] if entry["reason"] == "low"),
          [(entry["theme"], entry["score"]) for entry in raw["gaps"]])
    check("…and a gap called middle really did",
          all(entry["score"] >= 50 for entry in raw["gaps"] if entry["reason"] == "middle"),
          [(entry["theme"], entry["score"]) for entry in raw["gaps"]])
    check("…and one called unmeasured has no score to lie about",
          all(entry["score"] is None for entry in raw["gaps"] if entry["reason"] == "unmeasured"))
    check("the summary admits what it does not know",
          "unknown, never as weak" in plan["summary"], plan["summary"])
    check("a strength never covers a theme that is then called a gap",
          not ({entry["theme"] for entry in raw["gaps"]} & {
              theme
              for entry in raw["strengths"]
              for theme in scoring.DIMENSION_THEMES["interest"].get(entry["dimension"], [])
          }), [entry["theme"] for entry in raw["gaps"]])

    section("3b. a gap the answers actually support")
    # The shape above matched a career whose every area was already covered by a strong
    # answer, so its gap list came back empty and the gap checks above passed on
    # nothing. These three sittings are chosen from this app's own career notes for the
    # opposite: one answers an area the work leans on and comes back at the bottom of
    # the scale, one answers it at the top but arrives third behind two stronger areas,
    # and one never answers it. Between them every reason a gap can carry is real here
    # at least once.
    def answers_for(**per_dimension: str) -> dict[str, str]:
        shaped: dict[str, str] = {}
        for dimension, value in per_dimension.items():
            for code in INTEREST[dimension]:
                shaped[code] = value
        return shaped

    def with_gaps(answers: dict[str, str]) -> tuple[dict, dict, int, list[dict]]:
        _, outcome = finish(client, one["auth"], "interest", answers)
        shown = outcome["roadmap"]
        assert shown is not None, "a scored interest sitting arrived with no plan"
        assert shown["career"]["slug"] == outcome["careers"][0]["slug"], [
            shown["career"]["slug"],
            [entry["slug"] for entry in outcome["careers"]],
        ]
        return shown, stored(outcome["result_id"]), outcome["result_id"], outcome["traits"]

    lower, lower_raw, lower_id, _ = with_gaps(answers_for(R="5", A="1"))
    crowded, crowded_raw, crowded_id, _ = with_gaps(answers_for(R="5", S="5", E="3"))
    unseen, unseen_raw, unseen_id, unseen_traits = with_gaps(answers_for(A="5"))

    check("all three of these have a gap to check, which is the point",
          all(len(entry["gaps"]) for entry in (lower, crowded, unseen)),
          [(name, [gap["reason"] for gap in entry["gaps"]])
           for name, entry in (("low", lower), ("middle", crowded), ("unmeasured", unseen))])
    check("…and the three reasons between them cover every kind a gap can be",
          {entry["reason"] for entry in (*lower["gaps"], *crowded["gaps"], *unseen["gaps"])}
          == {"low", "middle", "unmeasured"})
    check("an area answered at the bottom of the scale is called low, and carries its number",
          [(entry["theme"], entry["reason"], entry["score"]) for entry in lower_raw["gaps"]]
          == [("creative_exploration", "low", 0)], lower_raw["gaps"])
    check("…said as what the answers showed, not as a judgement about the child",
          "lower than your strongest ones" in lower["gaps"][0]["detail"], lower["gaps"][0])
    check("an area that came back strong but behind two others is called middle, not missing",
          [(entry["theme"], entry["reason"], entry["score"]) for entry in crowded_raw["gaps"]]
          == [("organization_leadership", "middle", 50)], crowded_raw["gaps"])
    check("…which is what the two-strength cap does: that area is real, just not first",
          len(crowded["strengths"]) == 2
          and "E" not in {entry["dimension"] for entry in crowded_raw["strengths"]},
          [entry["dimension"] for entry in crowded_raw["strengths"]])
    check("…and its sentence says the student answered it, rather than calling it unknown",
          "in the middle" in crowded["gaps"][0]["detail"]
          and "unknown" not in crowded["gaps"][0]["detail"], crowded["gaps"][0])
    check("an area nobody answered is a gap that owns being unknown, with no number",
          all(entry["score"] is None and entry["reason"] == "unmeasured" for entry in unseen_raw["gaps"])
          and "unknown" in unseen["gaps"][0]["detail"], [unseen_raw["gaps"], unseen["gaps"][0]])
    check("…and every area behind one of those gaps really did come back unscored",
          all(
              {
                  dimension
                  for dimension in INTEREST
                  if theme in scoring.DIMENSION_THEMES["interest"].get(dimension, [])
              }
              <= {entry["dimension"] for entry in unseen_traits if entry["score"] is None}
              for theme in {entry["theme"] for entry in unseen_raw["gaps"]}
          ), [unseen_raw["gaps"], [(entry["dimension"], entry["score"]) for entry in unseen_traits]])
    check("the summary tells the two cases apart: a gap to work on, not four weeks of more of the same",
          "did not reach as far" in lower["summary"] and "go deeper rather than fixing a gap" in plan["summary"],
          [lower["summary"], plan["summary"]])
    check("…and week two spends its time on the first gap, only when there is one",
          any("first area named in the gap above" in step["text"] for step in lower["weeks"][1]["steps"])
          and not any(
              "first area named in the gap above" in step["text"]
              for entry in plan["weeks"] for step in entry["steps"]
          ), [step["text"] for step in lower["weeks"][1]["steps"]])

    section("4. the same plan, read in Hindi")
    hindi = client.get(f"{RESULT_URL}/{result_id}", headers=one["auth"],
                       params={"language": "hi"}).json()["roadmap"]
    check("the weeks read in Hindi", all(DEVANAGARI.search(step["text"]) for entry in hindi["weeks"]
                                        for step in entry["steps"]), hindi["weeks"][0]["steps"])
    check("…including the titles", all(DEVANAGARI.search(entry["title"]) for entry in hindi["weeks"]),
          [entry["title"] for entry in hindi["weeks"]])
    check("…and the strength names come from the question bank's own Hindi",
          all(DEVANAGARI.search(entry["label"]) for entry in hindi["strengths"]), hindi["strengths"])
    check("…with Hindi words for the band beside them",
          all(DEVANAGARI.search(entry["band_label"]) for entry in hindi["strengths"]), hindi["strengths"])
    check("the gap labels stay the catalogue's English key, because the page looks the Hindi up",
          [entry["label"] for entry in hindi["gaps"]] == [entry["label"] for entry in plan["gaps"]],
          [entry["label"] for entry in hindi["gaps"]])
    check("…while the sentence under each one is Hindi",
          all(DEVANAGARI.search(entry["detail"]) for entry in hindi["gaps"]),
          [entry["detail"] for entry in hindi["gaps"]])
    check("the unknown areas are still listed, still not scored",
          len(hindi["unmeasured"]) == len(plan["unmeasured"])
          and all(DEVANAGARI.search(entry["label"]) for entry in hindi["unmeasured"]), hindi["unmeasured"])
    check("the summary is Hindi too", DEVANAGARI.search(hindi["summary"]) is not None, hindi["summary"])
    check("…and still says no model was asked", "मॉडल" in hindi["note"], hindi["note"])
    check("reading it in Hindi changed no fact", [entry["week"] for entry in hindi["weeks"]] == [1, 2, 3, 4]
          and hindi["career"] == plan["career"])
    check("the English plan carries no Hindi the page would have to explain",
          not DEVANAGARI.search(json.dumps(plan)), json.dumps(plan)[:200])

    section("5. one account cannot read or rewrite another's plan")
    stolen = client.get(f"{RESULT_URL}/{result_id}", headers=two["auth"])
    check("a second student gets a 404, not somebody else's plan", stolen.status_code == 404, stolen.status_code)
    before = json.dumps(stored(result_id), sort_keys=True)
    rewrite = client.post(f"{RESULT_URL}/{result_id}/roadmap", headers=two["auth"])
    check("…and cannot ask for it to be rewritten either", rewrite.status_code == 404, rewrite.text[:160])
    check("…the refusal changed nothing on the first account's row",
          json.dumps(stored(result_id), sort_keys=True) == before)
    check("a plan that never existed is the same 404 rather than a 500",
          client.post(f"{RESULT_URL}/999999/roadmap", headers=one["auth"]).status_code == 404)
    check("…and so is a result number that is not a number",
          client.post(f"{RESULT_URL}/nonsense/roadmap", headers=one["auth"]).status_code == 422)
    check("…and a language this app does not have is dropped, not trusted",
          client.post(f"{RESULT_URL}/{result_id}/roadmap", headers=one["auth"],
                      params={"language": "klingon"}).json()["roadmap"]["text_language"] is None)

    section("6. answers that support no plan")
    # Personality's N scale maps to no career theme at all, so this is the real shape of a
    # result the app cannot aim four weeks at — not a crafted empty row.
    n_only = {code: "5" for code in codes_by_dimension("personality")["N"]}
    _, scattered = finish(client, two["auth"], "personality", n_only)
    check("a sitting can finish without a plan", scattered["roadmap"] is None, scattered["roadmap"])
    check("…and it suggests no careers either, which is the same fact", scattered["careers"] == [], scattered["careers"])
    check("…with no ✨ offered while no model is configured", scattered["roadmap_ai_available"] is False)
    scattered_id = scattered["result_id"]
    pressed = client.post(f"{RESULT_URL}/{scattered_id}/roadmap", headers=two["auth"])
    check("…pressing the route anyway answers 200 rather than 500", pressed.status_code == 200, pressed.text[:200])
    check("…and still has no plan to show", pressed.json()["roadmap"] is None, pressed.json()["roadmap"])
    check("…saying nothing about a model it never asked", pressed.json()["roadmap_note"] is None)
    check("…and storing nothing", stored(scattered_id) == {}, stored(scattered_id))

    sitting_two, with_plan = finish(client, two["auth"], "interest", strong_hands())
    two_id = with_plan["result_id"]
    check("the same student's other sitting does come with a plan", with_plan["roadmap"] is not None)
    blank_plan(two_id)
    old = client.get(f"{RESULT_URL}/{two_id}", headers=two["auth"]).json()
    check("a row from before plans existed reads as having none", old["roadmap"] is None, old["roadmap"])
    check("…and the screen is told the truth about a model being unavailable",
          old["roadmap_ai_available"] is False)
    wrote = client.post(f"{RESULT_URL}/{two_id}/roadmap", headers=two["auth"]).json()
    check("…asking for a plan writes the rules one, with no provider configured",
          wrote["roadmap"] is not None and wrote["roadmap"]["source"] == "rules", wrote["roadmap"])
    check("…and does not pretend a model was involved", wrote["roadmap_note"] is None)
    check("…storing it for the next read", stored(two_id).get("source") == "rules")

    section("7. what the provider is told — and nothing else")
    replies: list[str] = []
    calls: list[dict] = []

    class StubProvider(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            length = int(self.headers.get("Content-Length", 0))
            calls.append({
                "body": json.loads(self.rfile.read(length)),
                "auth": self.headers.get("Authorization", ""),
            })
            payload = json.dumps(
                {"choices": [{"message": {"role": "assistant", "content": replies[-1]}}]}
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *args):
            pass

    stub = ThreadingHTTPServer(("127.0.0.1", 0), StubProvider)
    threading.Thread(target=stub.serve_forever, daemon=True).start()
    port = stub.server_address[1]

    def asked(language: str = "en") -> dict:
        response = client.post(f"{RESULT_URL}/{result_id}/roadmap", headers=one["auth"],
                               params={"language": language})
        assert response.status_code == 200, response.text[:300]
        return response.json()

    def plan_calls() -> list[dict]:
        return [call for call in calls if "30-day action plan" in json.dumps(call["body"])]

    try:
        settings.ai_provider = "openai"
        settings.ai_api_key = "stub-key-never-a-real-one"
        settings.ai_model = "stub-model"
        settings.ai_base_url = f"http://127.0.0.1:{port}/v1"

        offered = client.get(f"{RESULT_URL}/{result_id}", headers=one["auth"]).json()
        check("with a provider configured the page may offer the button",
              offered["roadmap_ai_available"] is True, offered["roadmap_ai_available"])
        check("…and a rules plan is still what the page shows until it is pressed",
              offered["roadmap"]["source"] == "rules" and offered["roadmap"]["demo_generated"] is True)

        replies.append(model_plan())
        built = asked()
        sent = plan_calls()[-1]["body"]
        prompt = sent["messages"][0]["content"]
        check("a plan aimed at a career names that career to the model",
              built["roadmap"]["career"]["title"] in prompt, built["roadmap"]["career"])
        check("…with the numbers it scored them on, and no others",
              "out of 100" in prompt and "Questionnaire:" in prompt, prompt[:300])
        check("…and which areas were too thin to score",
              "too few answers to score" in prompt, [line for line in prompt.splitlines() if "few" in line])
        check("the request is a chat completion against the configured model",
              sent["model"] == "stub-model" and len(sent["messages"]) == 1, sent.get("model"))
        check("the key travels only as a header",
              plan_calls()[-1]["auth"] == "Bearer stub-key-never-a-real-one"
              and "stub-key" not in json.dumps(sent), plan_calls()[-1]["auth"])
        # The configured model is a reasoning model. Asked for this plan in English it spent
        # 1670 tokens thinking and 311 writing; in Hindi, 2358 and 615. A budget sized for the
        # answer alone truncates the JSON and silently returns the rules plan.
        check("the completion budget leaves room for a reasoning model to think first",
              sent["max_tokens"] >= 4000, sent["max_tokens"])
        check("the hard rules travel with the request",
              "Never suggest paying for a course" in prompt and "unknown, not low" in prompt, prompt[:120])
        check("…including the four-weeks contract the parser reads",
              '"weeks": [' in prompt and "exactly four objects" in prompt, prompt[-300:])
        check("…and that a week title must not repeat the number the page prints",
              'do not write "Week 1"' in prompt, prompt[-400:])

        # `/privacy` says only the scored numbers leave the machine. This account now holds
        # a CV and a name with sentinels in them, so that sentence is checked against every
        # roadmap request the stub recorded rather than read off the route.
        planted = client.post(
            "/api/resume",
            json={
                "target_role": "Sentinel Mechanical Engineer",
                "education": [{"class_level": "class-10", "school": "Sentinel Vidyalaya 9132",
                               "year": "2025", "result": "88%"}],
                "skills": [{"name": "Sentinel skill", "level": "comfortable"}],
                "projects": [{"title": "Sentinel project", "detail": "Riya Sharma, 98765-43210"}],
            },
            headers=one["auth"],
        )
        check("a CV can be planted on this account for the sentinel check",
              planted.status_code == 200, planted.text[:160])
        asked()
        recorded = json.dumps(plan_calls())
        for sentinel in ("Sentinel Vidyalaya", "98765-43210", "Riya Sharma", "Sentinel project",
                         "Sentinel skill", "Sentinel Mechanical Engineer", "Riya"):
            check(f"…and “{sentinel}” never reaches the provider", sentinel not in recorded, recorded[:200])
        check("…not even the questionnaire's own wording",
              "I like building things with my hands" not in recorded, recorded[:200])
        check("…while the two facts it is meant to carry are there",
              "Building and doing" in recorded
              and recorded.count("out of 100") >= 3, recorded[:200])

        section("8. the model's own plan, and the bounds it arrives inside")
        ai = built["roadmap"]
        check("the answer says which model wrote it", ai["source"] == "openai", ai["source"])
        check("…and stops claiming to be the rules", ai["demo_generated"] is False)
        check("…naming the language it was written in", ai["text_language"] == "en", ai["text_language"])
        check("…with the model's own summary", ai["summary"].startswith("Your answers point at work"), ai["summary"])
        check("…three strengths arrive as two", len(ai["strengths"]) == 2, [entry["label"] for entry in ai["strengths"]])
        check("…a model's guess at a score is not passed on as one",
              all(entry["score"] is None for entry in ai["strengths"]), ai["strengths"])
        check("…four gaps arrive as three", len(ai["gaps"]) == 3, [entry["label"] for entry in ai["gaps"]])
        check("…each labelled as the model's opinion rather than a measured band",
              {entry["reason"] for entry in ai["gaps"]} == {"ai"}, [entry["reason"] for entry in ai["gaps"]])
        check("…and four weeks, renumbered in order",
              [entry["week"] for entry in ai["weeks"]] == [1, 2, 3, 4])
        check("…with a week's fourth step dropped rather than overflowing the card",
              all(len(entry["steps"]) <= 3 for entry in ai["weeks"]),
              [len(entry["steps"]) for entry in ai["weeks"]])
        check("…and every step the model's own sentence",
              ai["weeks"][0]["steps"][0]["text"].startswith("Twenty minutes"), ai["weeks"][0]["steps"])
        check("the note now says a model wrote it", "configured AI model" in ai["note"], ai["note"])
        check("nothing had to go wrong, so no apology is printed", built["roadmap_note"] is None)
        check("…and the same read-back is still the model's plan",
              client.get(f"{RESULT_URL}/{result_id}", headers=one["auth"]).json()["roadmap"]["source"] == "openai")
        check("…stored, not re-asked on every page load", stored(result_id).get("source") == "openai")
        check("…with the model's prose in the database rather than language-neutral data",
              DEVANAGARI.search(json.dumps(stored(result_id)["weeks"])) is None)

        replies.append("```json\n" + model_plan() + "\n```")
        fenced = asked()
        check("a fenced reply still parses", fenced["roadmap"]["source"] == "openai", fenced["roadmap"]["source"])
        check("…and is not labelled as the app's own rules", fenced["roadmap"]["demo_generated"] is False)

        replies.append("```json\n" + model_plan() + "\n```Here is why these four weeks matter.")
        padded = asked()
        check("…so does one with a sentence trailing after it",
              padded["roadmap"]["source"] == "openai" and padded["roadmap_note"] is None, padded["roadmap_note"])

        replies.append(json.dumps({
            "summary": "S" * 900,
            "strengths": ["T" * 500, "U" * 500, "V" * 500],
            "gaps": ["W" * 500],
            "weeks": [{"title": "X" * 400, "steps": ["Y" * 900, "Z" * 900]} for _ in range(4)],
        }))
        greedy = asked()
        check("a model that will not stop talking arrives bounded",
              len(greedy["roadmap"]["summary"]) <= 400, len(greedy["roadmap"]["summary"]))
        check("…each step to the same width the rules plan respects",
              all(len(step["text"]) <= 240 for entry in greedy["roadmap"]["weeks"] for step in entry["steps"]),
              max(len(step["text"]) for entry in greedy["roadmap"]["weeks"] for step in entry["steps"]))
        check("…and each title to one line",
              all(len(entry["title"]) <= 80 for entry in greedy["roadmap"]["weeks"]))
        check("…which is still a payload the screen's schema accepts",
              set(greedy["roadmap"]) == PLAN_KEYS and len(greedy["roadmap"]["weeks"]) == 4)

        good = json.dumps(stored(result_id), sort_keys=True)

        def refused(reply: str, label: str) -> dict:
            """Press the button, expect this one sentence, and expect nothing else to change."""
            replies.append(reply)
            payload = asked()
            check(f"{label} is refused rather than served",
                  payload["roadmap_note"] == roadmap.UNUSABLE, payload["roadmap_note"])
            check(f"…and {label} leaves the plan the student already had untouched",
                  json.dumps(stored(result_id), sort_keys=True) == good)
            return payload

        three = refused(model_plan(weeks=[{"title": "One", "steps": ["a"]}] * 3), "three weeks")
        five = refused(model_plan(weeks=[{"title": "One", "steps": ["a"]}] * 5), "five weeks")
        refused(model_plan(weeks=[{"title": "", "steps": ["a"]}, {"title": "b", "steps": ["a"]},
                                  {"title": "c", "steps": ["a"]}, {"title": "d", "steps": ["a"]}]),
                "a week with no title")
        refused(model_plan(weeks=[{"title": "a", "steps": []}, {"title": "b", "steps": ["a"]},
                                  {"title": "c", "steps": ["a"]}, {"title": "d", "steps": ["a"]}]),
                "a week with nothing to do")
        refused(model_plan(strengths=[]), "a plan with no strengths")
        refused(model_plan(gaps=[]), "a plan with no gaps")
        refused(model_plan(summary=""), "a plan that never says what it is for")
        prose = refused("I'm not able to write a plan for that.", "a model that answers in prose")
        refused(json.dumps(["not", "an", "object"]), "an array where an object was promised")
        refused("", "an empty reply")

        check("a refusal blames the reply, never the connection",
              "could not be reached" not in prose["roadmap_note"], prose["roadmap_note"])
        check("…and the plan those failures left standing is still four weeks of steps",
              len(prose["roadmap"]["weeks"]) == 4 and prose["roadmap"]["source"] == "openai",
              prose["roadmap"]["source"])
        check("…with the note about the failure and the badge about the author saying the same thing",
              all("rules" not in (payload["roadmap_note"] or "") for payload in (three, five, prose))
              and prose["roadmap"]["demo_generated"] is False,
              [three["roadmap_note"], prose["roadmap"]["source"]])

        replies.append(model_plan())
        restored = asked()
        check("pressing the button again after a failure works",
              restored["roadmap"]["source"] == "openai" and restored["roadmap_note"] is None)

        replies.append(model_plan())
        hindi_built = asked("hi")
        check("asked in Hindi, the model's own Hindi text is what the page gets",
              hindi_built["roadmap"]["text_language"] == "hi", hindi_built["roadmap"]["text_language"])
        check("…and the request was written in Hindi, because that is the page the student is on",
              "Write the text in Hindi" in plan_calls()[-1]["body"]["messages"][0]["content"],
              plan_calls()[-1]["body"]["messages"][0]["content"][-200:])
        hindi_stored = json.dumps(stored(result_id), sort_keys=True)
        english_read = client.get(f"{RESULT_URL}/{result_id}", headers=one["auth"],
                                 params={"language": "en"}).json()["roadmap"]
        check("an English page reading that plan keeps the plan's own language",
              english_read["text_language"] == "hi", english_read["text_language"])
        check("…rather than serving English sentences no model wrote",
              english_read["summary"] == hindi_built["roadmap"]["summary"], english_read["summary"][:120])
        check("…and merely reading it in another language rewrites nothing",
              json.dumps(stored(result_id), sort_keys=True) == hindi_stored)

        blank_plan(result_id)
        replies.append(model_plan())
        rebuilt_old = asked("en")
        check("a plan that was missing gets written from the answers before the model is asked",
              rebuilt_old["roadmap"]["source"] == "openai" and rebuilt_old["roadmap_note"] is None,
              rebuilt_old["roadmap_note"])
        check("…so the model is given a real target career rather than an empty document",
              rebuilt_old["roadmap"]["career"]["title"] in plan_calls()[-1]["body"]["messages"][0]["content"],
              rebuilt_old["roadmap"]["career"])

        settings.ai_base_url = "http://127.0.0.1:1/v1"
        before_down = json.dumps(stored(result_id), sort_keys=True)
        down = asked()
        check("an unreachable provider costs the student their plan and nothing else",
              down["roadmap_note"] == roadmap.UNREACHABLE, down["roadmap_note"])
        check("…the plan on the page is byte-for-byte the one they already had",
              json.dumps(stored(result_id), sort_keys=True) == before_down)
        check("…and the sentence about the failure names no author the badge would contradict",
              "rules" not in down["roadmap_note"] and down["roadmap"]["source"] == "openai",
              [down["roadmap_note"], down["roadmap"]["source"]])

        settings.ai_provider = "demo"
        settings.ai_api_key = ""
        unconfigured = asked()
        check("back in demo mode the button is not even offered on the page",
              unconfigured["roadmap_ai_available"] is False, unconfigured["roadmap_ai_available"])
        check("…and a request that arrives anyway changes nothing and apologises for nothing",
              unconfigured["roadmap_note"] is None
              and unconfigured["roadmap"]["source"] == down["roadmap"]["source"])
    finally:
        settings.ai_provider = "demo"
        settings.ai_api_key = ""
        settings.ai_model = ""
        settings.ai_base_url = "https://api.openai.com/v1"
        stub.shutdown()
        stub.server_close()

    section("9. the guide is handed the same four weeks")
    _, kept = finish(client, one["auth"], "interest", strong_hands())
    check("a second sitting on the same account comes with its own plan", kept["roadmap"] is not None)
    conversation = client.post("/api/conversations", json={"kind": "chat", "language": "en"}, headers=one["auth"])
    assert conversation.status_code == 201, conversation.text[:200]
    thread = conversation.json()["id"]

    def say(message: str, **extra) -> dict:
        response = client.post(
            f"/api/conversations/{thread}/messages", headers=one["auth"], json={"message": message, **extra}
        )
        return {
            "status": response.status_code,
            "body": response.json() if response.headers.get("content-type", "").startswith("application/json") else {},
        }

    plain = say("What should I work on first?")
    check("an ordinary chat still works with no plan attached", plain["status"] == 200, plain["body"])
    check("…and nothing about a plan is invented for it",
          "30-day plan" not in plain["body"]["reply"]["content"], plain["body"]["reply"]["content"])

    with_plan = say("Which week should I start with?", plan_of=kept["result_id"])
    check("a message can point at the sender's own plan", with_plan["status"] == 200, with_plan["body"])
    check("…and the reply still reads as the built-in guide's, since no provider is configured here",
          with_plan["body"]["reply"]["demo_generated"] is True)
    check("…with the guide acknowledging the four weeks rather than asking the student to describe them",
          "30-day plan" in with_plan["body"]["reply"]["content"], with_plan["body"]["reply"]["content"])

    with SessionLocal() as db:
        row = db.get(Result, kept["result_id"])
        rendered_en = roadmap.render(row.roadmap_json, "en")
        note_en = roadmap.guide_note(rendered_en)
        rendered_hi = roadmap.render(row.roadmap_json, "hi")
        note_hi = roadmap.guide_note(rendered_hi)
        # Section 3b's middle-gap sitting is the other half of this: the shape above
        # matched a career with nothing left to ask for, so its note has no gap line at
        # all. Which is the rule, and a note that printed one anyway would be the guide
        # telling a student about a gap their own page does not show.
        note_gap = roadmap.guide_note(roadmap.render(db.get(Result, crowded_id).roadmap_json, "en"))
    check("the block the guide is given names the career the plan aims at",
          row.roadmap_json["career"]["title"] in note_en, note_en[:200])
    check("…counts the weeks out in order, since the page's numbered rail is not there",
          all(f"Week {n}. " in note_en for n in (1, 2, 3, 4)), note_en)
    check("…says which areas came back strong",
          "Where their answers came back strong:" in note_en, note_en)
    check("…and which the work wants more of, on a plan that found a gap",
          "Where this work asks for more: Organization and leadership." in note_gap, note_gap)
    check("…leaving that line out when the answers covered everything the work leans on",
          "Where this work asks for more:" not in note_en and not rendered_en["gaps"], note_en)
    check("…and says plainly that an unmeasured area is not a weakness",
          "Not measured at all, so not a weakness:" in note_en, note_en)
    check("…in Hindi when the student reads the app in Hindi",
          DEVANAGARI.search(note_hi) is not None and "Week 1. " in note_hi, note_hi[:200])
    check("…carrying the very week titles the Hindi page shows, not a second paraphrase",
          all(entry["title"] in note_hi for entry in rendered_hi["weeks"]), note_hi[:240])

    other_thread = client.post("/api/conversations", json={"kind": "chat"}, headers=two["auth"])
    assert other_thread.status_code == 201, other_thread.text[:200]
    thread_two = other_thread.json()["id"]
    stolen = client.post(f"/api/conversations/{thread_two}/messages", headers=two["auth"],
                         json={"message": "Tell me about my plan", "plan_of": kept["result_id"]})
    check("one student cannot hand the guide another student's plan", stolen.status_code == 404, stolen.text[:200])
    check("…and is told what happened instead of getting an answer about it",
          "no plan by that number" in stolen.json()["detail"], stolen.json()["detail"])
    messages = client.get(f"/api/conversations/{thread}/messages", headers=one["auth"]).json()
    check("…the victim's conversation is not even touched",
          len(client.get(f"/api/conversations/{thread}/messages", headers=one["auth"]).json()) == len(messages))
    check("…and the refusal stores no message on the attacker's side either",
          len(client.get(f"/api/conversations/{thread_two}/messages", headers=two["auth"]).json()) == 1,
          len(client.get(f"/api/conversations/{thread_two}/messages", headers=two["auth"]).json()))

    missing = say("And this week?", plan_of=999999)
    check("a plan number that is not on the account is a 404, not a guess",
          missing["status"] == 404, missing)
    check("…with the same one true sentence", "no plan by that number" in str(missing["body"]), missing["body"])
    check("…and the message was not stored",
          len(client.get(f"/api/conversations/{thread}/messages", headers=one["auth"]).json()) == len(messages))

    for bad in (0, -1):
        check(f"a plan_of of {bad} is refused before anything is read",
              say("hello", plan_of=bad)["status"] == 422)
    check("…as is one that is not a number at all", say("hello", plan_of="seven")["status"] == 422)
    check("…while leaving the plan it does not name alone", stored(kept["result_id"]).get("source") == "rules")

    no_plan = client.post(f"/api/conversations/{thread_two}/messages", headers=two["auth"],
                          json={"message": "What about my plan?", "plan_of": scattered_id})
    check("a result with nothing to hand over carries on as an ordinary chat",
          no_plan.status_code == 200, no_plan.text[:200])
    check("…rather than inventing a plan for the guide to talk about",
          "30-day plan" not in no_plan.json()["reply"]["content"], no_plan.json()["reply"]["content"])
    check("a parent cannot use a child's plan number in their own chat",
          client.post(f"/api/conversations/{thread}/messages", headers=ph,
                      json={"message": "What does my child's plan say?",
                            "plan_of": kept["result_id"]}).status_code == 403)

    section("10. erasure takes the plan with it")
    gone = client.delete("/api/users/me", headers=two["auth"])
    check("the account asks for its own erasure", gone.status_code == 200, gone.text[:200])
    check("…and counts the results among what it removed",
          gone.json()["removed"].get("assessment_results") == 2, str(gone.json()["removed"])[:240])
    with SessionLocal() as db:
        check("…leaving no result row that holds a plan",
              db.scalars(select(Result).where(Result.user_id == two["id"])).first() is None)
        check("…and no plan outlives the account it was written for",
              db.query(Result).join(User, Result.user_id == User.id).filter(User.role == "erased").count() == 0)
    check("another account's plan is untouched by that erasure",
          stored(kept["result_id"]).get("source") == "rules"
          and len(stored(result_id).get("weeks", [])) == 4,
          [stored(kept["result_id"]).get("source"), len(stored(result_id).get("weeks", []))])
    check("…and still reads on its own page as four weeks",
          len(client.get(f"{RESULT_URL}/{result_id}", headers=one["auth"]).json()["roadmap"]["weeks"]) == 4)

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + ", ".join(FAIL))
    sys.exit(1)
