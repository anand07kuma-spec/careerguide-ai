"""Test the assessment bank, the scorer and the assessment routes.

Two things here matter more than the arithmetic. The answer key of the puzzle set
must never appear in any response body — a child with DevTools open should not be
able to read it. And a session id or a result id from another device must come
back as 404, because the app has no login and the bearer token is the only thing
standing between one family's answers and another's.

Runs against a throwaway database, never `careerguide.db`.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/assessment_test.py
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import _console  # noqa: E402,F401 -- utf-8 stdout, see _console.py

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_assessment_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py

from fastapi.testclient import TestClient  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import StudentProfile  # noqa: E402
from app.services import assessment_bank, scoring  # noqa: E402
from app.services.themes import THEMES  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)[:180]) if detail and not condition else ''}")


DEVANAGARI = re.compile(r"[ऀ-ॿ]")
LATIN = re.compile(r"[A-Za-z]")
# Anything from a script this app never speaks: a stray CJK character in a Hindi
# sentence passed the JSON parser perfectly and would have shipped to children.
STRAY = re.compile(r"[぀-ヿ㐀-䶿一-鿿＀-￯]")

print("\n=== 1. the question bank on disk")

bank = assessment_bank.bank()
items = bank["items"]
by_type: dict[str, list[dict]] = {}
for entry in items:
    by_type.setdefault(entry["type"], []).append(entry)

check("parses as JSON", bool(bank))
check("75 items in total", len(items) == 75, len(items))
check("30 interest items", len(by_type["interest"]) == 30, len(by_type["interest"]))
check("20 personality items", len(by_type["personality"]) == 20, len(by_type["personality"]))
check("25 aptitude items", len(by_type["aptitude"]) == 25, len(by_type["aptitude"]))

spectrum: dict[str, dict[str, int]] = {}
for entry in items:
    counts = spectrum.setdefault(entry["type"], {})
    counts[entry["dimension"]] = counts.get(entry["dimension"], 0) + 1
check(
    "RIASEC covers six areas with five items each",
    spectrum["interest"] == {"R": 5, "I": 5, "A": 5, "S": 5, "E": 5, "C": 5},
    spectrum["interest"],
)
check(
    "Big Five covers five traits with four items each",
    spectrum["personality"] == {"O": 4, "C": 4, "E": 4, "A": 4, "N": 4},
    spectrum["personality"],
)
check(
    "aptitude covers four dimensions 7/7/6/5",
    spectrum["aptitude"] == {"numerical": 7, "verbal": 7, "logical": 6, "spatial": 5},
    spectrum["aptitude"],
)

codes = {(entry["type"], entry["code"]) for entry in items}
check("item codes are unique inside each instrument", len(codes) == len(items), len(codes))

orders = {
    (entry["type"], entry["order"]) for entry in items
}
check("no two items share a position", len(orders) == len(items))

stray = [
    (entry["code"], field, text)
    for entry in items
    for field, text in entry["text"].items()
    if STRAY.search(text)
]
stray += [
    (entry["code"], "option", option["label"][lang])
    for entry in items
    for option in entry.get("options", [])
    for lang in ("en", "hi")
    if STRAY.search(option["label"][lang])
]
prose = []
for instrument in bank["instruments"]:
    for key in ("name", "blurb", "caveat"):
        if STRAY.search(instrument[key]["hi"]) or STRAY.search(instrument[key]["en"]):
            prose.append((instrument["type"], key))
    for dimension, meta in instrument["dimensions"].items():
        if STRAY.search(meta["name"]["hi"]) or STRAY.search(meta["blurb"]["hi"]):
            prose.append((instrument["type"], dimension))
check("no stray characters from a script this app does not use", not stray and not prose, stray + prose)

missing_hi = [
    entry["code"]
    for entry in items
    if not DEVANAGARI.search(entry["text"]["hi"]) and LATIN.search(entry["text"]["en"])
]
check("every item that says something in English says it in Hindi too", not missing_hi, missing_hi)

likert_values = {entry["value"] for entry in assessment_bank.scale()}
check("the agree/disagree scale has five steps", likert_values == {1, 2, 3, 4, 5}, likert_values)
check(
    "scale steps carry both languages",
    all(
        entry["label"].get("en") and entry["label"].get("hi")
        for entry in assessment_bank.scale()
    ),
)

keyed = {
    entry["code"]: entry.get("keyed", "+")
    for entry in by_type["personality"]
}
per_trait: dict[str, list[str]] = {}
for entry in by_type["personality"]:
    per_trait.setdefault(entry["dimension"], []).append(entry.get("keyed", "+"))
check(
    "every personality trait has two forward and two reverse-worded items",
    all(sorted(flags) == ["+", "+", "-", "-"] for flags in per_trait.values()),
    per_trait,
)
check(
    "interest items are all worded the same way up",
    all(entry.get("keyed", "+") == "+" for entry in by_type["interest"]),
)

bad_options = [
    entry["code"]
    for entry in by_type["aptitude"]
    if len(entry.get("options", [])) != 4
    or len({option["value"] for option in entry["options"]}) != 4
    or entry.get("answer") not in {option["value"] for option in entry["options"]}
]
check("every puzzle item has four distinct options and a key among them", not bad_options, bad_options)

leaked = [entry["code"] for entry in items if "answer" in entry and entry["type"] != "aptitude"]
check("only the puzzle set has an answer key at all", not leaked, leaked)

instruments = assessment_bank.instruments()
check(
    "every instrument declares the dimensions its items use",
    all(set(spectrum[key]) <= set(meta["dimensions"]) for key, meta in instruments.items()),
)
check(
    "every dimension has a name and a description in both languages",
    all(
        meta["name"].get("en")
        and meta["name"].get("hi")
        and meta["blurb"].get("en")
        and meta["blurb"].get("hi")
        for instrument in instruments.values()
        for meta in instrument["dimensions"].values()
    ),
)
check(
    "min_class and minutes are set on all three",
    all(6 <= meta["min_class"] <= 12 and 1 <= meta["minutes"] <= 30 for meta in instruments.values()),
)

print("\n=== 2. the scorer")


def as_item(entry: dict, assessment_type: str) -> dict:
    return {
        "code": entry["code"],
        "dimension": entry["dimension"],
        "response_type": entry.get("response_type") or instruments[assessment_type]["response"],
        "keyed": entry.get("keyed", "+"),
        "options_json": entry.get("options", []),
        "correct_value": entry.get("answer"),
    }


interest_items = [as_item(entry, "interest") for entry in by_type["interest"]]
personality_items = [as_item(entry, "personality") for entry in by_type["personality"]]
aptitude_items = [as_item(entry, "aptitude") for entry in by_type["aptitude"]]

top = scoring.score_items(interest_items, {entry["code"]: "5" for entry in by_type["interest"]})
check("strongly agreeing gives 100 on every interest area",
      all(entry["score"] == 100 for entry in top["dimensions"].values()), top["dimensions"])
low = scoring.score_items(interest_items, {entry["code"]: "1" for entry in by_type["interest"]})
check("disagreeing with everything gives 0",
      all(entry["score"] == 0 for entry in low["dimensions"].values()))
middle = scoring.score_items(interest_items, {entry["code"]: "3" for entry in by_type["interest"]})
check("answering the middle everywhere gives 50",
      all(entry["score"] == 50 for entry in middle["dimensions"].values()))

consistent = {}
for entry in by_type["personality"]:
    consistent[entry["code"]] = "5" if entry.get("keyed", "+") == "+" else "1"
consistent_scores = scoring.score_items(personality_items, consistent)
check("a consistent respondent scores 100, so reverse keying really flips",
      all(entry["score"] == 100 for entry in consistent_scores["dimensions"].values()),
      consistent_scores["dimensions"])
acquiescent = scoring.score_items(personality_items, {entry["code"]: "5" for entry in by_type["personality"]})
check("agreeing with everything, reverses included, lands on the midpoint",
      acquiescent["dimensions"]["O"]["score"] == 50, acquiescent["dimensions"]["O"])

sparse = scoring.score_items(interest_items, {"R1": "4"})
check("one answer on its own produces no number",
      sparse["dimensions"]["R"]["score"] is None and sparse["dimensions"]["R"]["band"] == "unknown")
check("…and the unanswered areas are named in the totals", sparse["totals"]["answered"] == 1, sparse["totals"])

garbage = scoring.score_items(interest_items, {"R1": "9", "R2": "banana", "R3": "3"})
check("out-of-range answers are counted as ignored, not averaged in",
      garbage["totals"]["ignored"] == 2 and garbage["dimensions"]["R"]["score"] is None, garbage)

keys = {entry["code"]: entry["answer"] for entry in by_type["aptitude"]}
perfect = scoring.score_items(aptitude_items, keys)
check("the answer key scores 100 on every puzzle dimension",
      all(entry["score"] == 100 for entry in perfect["dimensions"].values()))
wrong = {entry["code"]: ("a" if entry.get("answer") != "a" else "b") for entry in by_type["aptitude"]}
none_right = scoring.score_items(aptitude_items, wrong)
check("every wrong option scores 0",
      all(entry["score"] == 0 for entry in none_right["dimensions"].values()))
check("puzzle scores carry the raw count as well as the percentage",
      perfect["dimensions"]["numerical"]["correct"] == 7, perfect["dimensions"]["numerical"])

check("band boundaries: 24 is still light", scoring._band(24, "likert") == "light")
check("band boundaries: 25 opens 'some'", scoring._band(25, "likert") == "some")
check("band boundaries: 50 is strong", scoring._band(50, "likert") == "strong")
check("band boundaries: 75 is very strong", scoring._band(75, "likert") == "very_strong")

traits = scoring.traits("interest", "en", top)
check("all six areas appear in the traits list", len(traits) == 6, len(traits))
check("traits come with a band label the screen can print",
      all(entry["band_label"] for entry in traits))
ranked = scoring.traits("interest", "en", scoring.score_items(interest_items, {"R1": "5", "R2": "5", "A1": "1", "A2": "1"}))
check("unscored areas sort after scored ones",
      ranked[0]["score"] is not None and ranked[-1]["score"] is None, [entry["score"] for entry in ranked])
hi_traits = scoring.traits("personality", "hi", consistent_scores)
check("traits render in Hindi when asked", all(DEVANAGARI.search(entry["name"]) for entry in hi_traits), hi_traits)

check("career themes come only from answered areas",
      scoring.career_themes("interest", sparse) == [], scoring.career_themes("interest", sparse))
themes = scoring.career_themes("interest", top)
check("a full sitting yields themes to match careers against", len(themes) >= 2, themes)
check("keeping calm is not claimed as a career requirement",
      scoring.DIMENSION_THEMES["personality"]["N"] == [])

for assessment_type in ("interest", "personality", "aptitude"):
    lines = scoring.caveats(assessment_type, "en")
    check(f"{assessment_type} ships its caveats in English", len(lines) == 2 and all(lines))
check("the personality caveat says it is not a diagnosis",
      "not a mental-health assessment" in scoring.caveats("personality", "en")[1])
check("the puzzle caveat says it is not a measure of ability",
      "not a measurement of ability" in scoring.caveats("aptitude", "en")[1])
check("…in Hindi too", "क्षमता की माप नहीं" in scoring.caveats("aptitude", "hi")[1])

print("\n=== 3. the routes")


def student(client: TestClient, device: str, class_level: str, legacy: str | None = None) -> dict:
    created = client.post(
        "/api/auth/onboarding",
        json={
            "role": "student",
            "display_name": f"Kid {class_level}",
            "preferred_language": "en",
            "class_level": class_level,
            "consent_profile": True,
            "consent_age": "11-12",
            "device_id": device,
        },
    )
    assert created.status_code == 200, created.text
    if legacy:
        # The API will not store a class below six, so a row like this can only be
        # data written before the floor moved. Written by hand, it is what the
        # routes have to keep turning away.
        with SessionLocal() as db:
            db.get(StudentProfile, created.json()["user"]["id"]).class_level = legacy
            db.commit()
    return {"Authorization": f"Bearer {created.json()['token']}"}


with TestClient(app) as client:
    check("a request with no token is turned away", client.get("/api/assessments").status_code == 401)

    guardian = client.post(
        "/api/auth/onboarding",
        json={
            "role": "parent",
            "display_name": "Ma",
            "preferred_language": "en",
            "consent_profile": True,
            "consent_age": "adult",
        },
    )
    assert guardian.status_code == 200, guardian.text
    gh = {"Authorization": f"Bearer {guardian.json()['token']}"}
    forbidden = client.get("/api/assessments", headers=gh)
    check("a parent account is not handed a child's questionnaire",
          forbidden.status_code == 403, forbidden.status_code)

    eight = student(client, "aaaa1111bbbb2222cccc3333dddd4444", "class-8")
    four = student(client, "eeee5555ffff6666gggg7777hhhh8888", "class-6", legacy="class-4")

    catalogue = client.get("/api/assessments", headers=eight)
    check("a student gets the catalogue", catalogue.status_code == 200, catalogue.status_code)
    rows = {row["type"]: row for row in catalogue.json()["instruments"]}
    check("three instruments are offered", set(rows) == {"interest", "personality", "aptitude"}, set(rows))
    check("item counts match the bank",
          (rows["interest"]["item_count"], rows["personality"]["item_count"], rows["aptitude"]["item_count"])
          == (30, 20, 25), rows)
    check("nothing has been started yet", all(row["latest"] is None for row in rows.values()))
    check("the catalogue explains what these are",
          "not licensed clinical instruments" in catalogue.json()["note"])

    hindi_catalogue = client.get("/api/assessments", headers=eight, params={"language": "hi"})
    names = [row["name"] for row in hindi_catalogue.json()["instruments"]]
    check("the catalogue reads in Hindi", all(DEVANAGARI.search(name) for name in names), names)

    refused = client.post(
        "/api/auth/onboarding",
        json={
            "role": "student",
            "display_name": "Kid below the floor",
            "preferred_language": "en",
            "class_level": "class-4",
            "consent_profile": True,
            "consent_age": "6-8",
            "device_id": "iiii9999jjjj0000kkkk1111llll2222",
        },
    )
    check(
        "the server will not store a class below six",
        refused.status_code == 422,
        refused.status_code,
    )

    too_young = client.post("/api/assessments/aptitude/start", headers=four, json={"language": "en"})
    check("a legacy class-4 row cannot start the puzzle set", too_young.status_code == 403, too_young.status_code)
    check("…and is told what to use instead", "interest conversation" in too_young.json()["detail"])
    legacy_interest = client.post("/api/assessments/interest/start", headers=four, json={"language": "en"})
    check("…and every other set sits behind the same floor",
          legacy_interest.status_code == 403, legacy_interest.status_code)

    unknown = client.post("/api/assessments/astrology/start", headers=eight, json={})
    check("an invented instrument is a 404", unknown.status_code == 404, unknown.status_code)

    started = client.post("/api/assessments/interest/start", headers=eight, json={"language": "en"})
    check("starting a sitting works", started.status_code == 200, started.text)
    session_id = started.json()["assessment_id"]
    check("a fresh sitting says it is fresh", started.json()["resumed"] is False)
    check("it reports thirty items", started.json()["item_count"] == 30)

    again = client.post("/api/assessments/interest/start", headers=eight, json={"language": "en"})
    check("starting again resumes the same sitting instead of making a second one",
          again.json()["resumed"] is True and again.json()["assessment_id"] == session_id, again.json())

    page = client.get(f"/api/assessments/session/{session_id}/questions", headers=eight)
    check("the sitting's questions load", page.status_code == 200, page.status_code)
    body = page.json()
    check("thirty questions come back", len(body["items"]) == 30, len(body["items"]))
    check("the scale comes with them", len(body["scale"]) == 5)
    check("nothing is answered yet", body["answered"] == {})
    check("the honest note travels with the questions", bool(body["caveat"]))

    raw = page.text
    check("the answer key is nowhere in the question payload",
          "correct_value" not in raw and '"answer"' not in raw)
    check("no item leaks its dimension to the runner",
          all("dimension" not in item for item in body["items"]))

    saved = client.post(
        f"/api/assessments/session/{session_id}/answer", headers=eight, json={"code": "R1", "value": "5"}
    )
    check("an answer autosaves", saved.status_code == 200 and saved.json()["saved"], saved.text)
    check("and the count says one", saved.json()["answered"] == 1, saved.json())

    retaken = client.post(
        f"/api/assessments/session/{session_id}/answer", headers=eight, json={"code": "R1", "value": "4"}
    )
    check("changing your mind replaces the answer rather than adding a row",
          retaken.json()["answered"] == 1, retaken.json())

    bad_value = client.post(
        f"/api/assessments/session/{session_id}/answer", headers=eight, json={"code": "R2", "value": "7"}
    )
    check("a value off the scale is rejected", bad_value.status_code == 422, bad_value.status_code)
    bad_code = client.post(
        f"/api/assessments/session/{session_id}/answer", headers=eight, json={"code": "NU1", "value": "5"}
    )
    check("an item from another instrument is rejected", bad_code.status_code == 422, bad_code.status_code)

    other_page = client.get(f"/api/assessments/session/{session_id}/questions", headers=four)
    check("another child's device cannot open this sitting", other_page.status_code == 404, other_page.status_code)
    other_answer = client.post(
        f"/api/assessments/session/{session_id}/answer", headers=four, json={"code": "R2", "value": "3"}
    )
    check("…nor write into it", other_answer.status_code == 404, other_answer.status_code)

    submitted = client.post(
        f"/api/assessments/session/{session_id}/submit", headers=eight, json={"language": "en"}
    )
    check("submitting scores the sitting", submitted.status_code == 200, submitted.text)
    result = submitted.json()
    check("every area carries a number", len(result["scores"]) == 6)
    check("top traits are ranked", [entry["score"] for entry in result["top_traits"]]
          == sorted([entry["score"] for entry in result["top_traits"]], reverse=True))
    check("completeness is reported honestly", result["totals"]["completeness"] < 10, result["totals"])
    check("a near-empty sitting suggests no careers", result["careers"] == [], result["careers"])
    check("the result carries its caveats", len(result["caveats"]) == 2)
    result_id = result["result_id"]

    twice = client.post(f"/api/assessments/session/{session_id}/submit", headers=eight, json={})
    check("submitting twice returns the first result", twice.json()["result_id"] == result_id)
    late = client.post(
        f"/api/assessments/session/{session_id}/answer", headers=eight, json={"code": "R2", "value": "2"}
    )
    check("answers are closed once finished", late.status_code == 409, late.status_code)

    read = client.get(f"/api/assessments/result/{result_id}", headers=eight)
    check("the owner can read the result back", read.status_code == 200, read.status_code)
    check("…and it points at the same sitting", read.json()["assessment_id"] == session_id)
    switched = client.get(f"/api/assessments/result/{result_id}", headers=eight, params={"language": "hi"})
    check("…in Hindi on request, without re-scoring",
          DEVANAGARI.search(switched.json()["name"]) is not None, switched.json()["name"])
    check("other device cannot read it",
          client.get(f"/api/assessments/result/{result_id}", headers=four).status_code == 404)
    # Anonymous, for real: this client is a browser and an earlier check left it holding a
    # session cookie, so the jar has to be emptied before asking what a stranger gets.
    client.cookies.clear()
    check("an anonymous caller cannot read it",
          client.get(f"/api/assessments/result/{result_id}").status_code == 401)
    check("a made-up result id is a 404",
          client.get("/api/assessments/result/987654", headers=eight).status_code == 404)

    after = client.get("/api/assessments", headers=eight).json()["instruments"]
    interest_row = next(row for row in after if row["type"] == "interest")
    check("the catalogue now offers the finished result",
          interest_row["latest"]["status"] == "submitted"
          and interest_row["latest"]["result_id"] == result_id, interest_row)

    journey = client.get("/api/journey", headers=eight).json()
    check("the journey remembers the questionnaire",
          any("questionnaire" in event["title"] for event in journey["events"]), journey["events"][:2])

    # A near-empty sitting proves the honesty; a complete one is where career
    # mapping is supposed to switch on.
    full_id = client.post(
        "/api/assessments/interest/start", headers=eight, json={"language": "en"}
    ).json()["assessment_id"]
    check("a finished sitting can be taken again as a new sitting", full_id != session_id, full_id)
    for entry in by_type["interest"]:
        client.post(
            f"/api/assessments/session/{full_id}/answer",
            headers=eight,
            json={"code": entry["code"], "value": "5" if entry["dimension"] in ("R", "I", "A") else "2"},
        )
    full = client.post(
        f"/api/assessments/session/{full_id}/submit", headers=eight, json={"language": "en"}
    ).json()
    check("a complete sitting reports itself complete", full["totals"]["completeness"] == 100, full["totals"])
    check("careers are suggested from the catalogue", len(full["careers"]) > 0, len(full["careers"]))
    catalogue_titles = {row["title"] for row in client.get("/api/careers", headers=eight).json()}
    check("every suggestion is a career the app really has",
          all(row["title"] in catalogue_titles for row in full["careers"]),
          [row["title"] for row in full["careers"] if row["title"] not in catalogue_titles])
    theme_labels = {meta["label"] for meta in THEMES.values()}
    check("each suggestion names the themes it matched on",
          all(row["matched"] and set(row["matched"]) <= theme_labels for row in full["careers"]),
          full["careers"][:1])
    check("every suggested career is flagged as unverified sample data",
          all(row["needs_verification"] for row in full["careers"]))
    check("the career list admits it is sample data",
          "not been checked against official sources" in full["career_note"])
    check("the strongest areas are ranked first",
          [entry["score"] for entry in full["top_traits"]][:3] == [100, 100, 100],
          [entry["score"] for entry in full["top_traits"]])
    check("the finished sitting is closed to further answers",
          client.post(f"/api/assessments/session/{full_id}/answer",
                      headers=eight, json={"code": "R1", "value": "1"}).status_code == 409)

    apt_started = client.post("/api/assessments/aptitude/start", headers=eight, json={"language": "hi"})
    apt_id = apt_started.json()["assessment_id"]
    apt_page = client.get(f"/api/assessments/session/{apt_id}/questions", headers=eight)
    apt_body = apt_page.json()
    hi_bank = {entry["code"]: entry for entry in by_type["aptitude"]}
    check("puzzle items arrive in the sitting's own language",
          all(item["text"] == hi_bank[item["code"]]["text"]["hi"] for item in apt_body["items"]),
          apt_body["items"][0])
    verbal = next(item for item in apt_body["items"] if item["code"] == "VE1")
    check("…which for a word puzzle means Devanagari, options and all",
          DEVANAGARI.search(verbal["text"]) is not None
          and all(DEVANAGARI.search(option["label"]) for option in verbal["options"]),
          verbal)
    check("puzzle items bring their options", len(apt_body["items"][0]["options"]) == 4)
    check("…and no scale, because there is nothing to agree with", apt_body["scale"] == [])
    apt_key = client.get(f"/api/assessments/session/{apt_id}/questions", headers=eight).text
    check("the puzzle answer key never reaches the client", '"answer"' not in apt_key)
    wrong_option = client.post(
        f"/api/assessments/session/{apt_id}/answer", headers=eight, json={"code": "NU1", "value": "z"}
    )
    check("an option that does not exist is refused", wrong_option.status_code == 422, wrong_option.status_code)
    for entry in by_type["aptitude"]:
        answer_body = client.post(
            f"/api/assessments/session/{apt_id}/answer",
            headers=eight,
            json={"code": entry["code"], "value": entry["answer"]},
        )
        if answer_body.status_code != 200:
            break
    apt_result = client.post(f"/api/assessments/session/{apt_id}/submit", headers=eight, json={}).json()
    check("the puzzle set scores all four dimensions", len(apt_result["scores"]) == 4, apt_result)
    check("a submit with no language answers in the sitting's own language",
          DEVANAGARI.search(apt_result["name"]) is not None, apt_result["name"])
    check("puzzle bands describe the set, not the child",
          all("सही" in entry["band_label"] for entry in apt_result["traits"]), apt_result["traits"][0])
    apt_english = client.get(
        f"/api/assessments/result/{apt_result['result_id']}", headers=eight, params={"language": "en"}
    ).json()
    check("…and the same numbers read honestly in English",
          all("were right" in entry["band_label"] for entry in apt_english["traits"]),
          apt_english["traits"][0])
    check("puzzle traits are counted, not judged",
          all(entry["answered"] == entry["total"] for entry in apt_english["traits"]),
          [(entry["answered"], entry["total"]) for entry in apt_english["traits"]])

    empty = client.post("/api/assessments/personality/start", headers=eight, json={}).json()["assessment_id"]
    bare_submit = client.post(f"/api/assessments/session/{empty}/submit", headers=eight, json={})
    check("a sitting with no answers at all is not scored", bare_submit.status_code == 422, bare_submit.text)

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
