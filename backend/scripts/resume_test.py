"""Prove the resume belongs to its student, and that its suggestions say where they came from.

Two failure modes this suite is written against.

The first is privacy: a CV holds a child's marks, the skills they claim and the projects
they say they did. So every check about access asks the same question in a different voice
— can one account read or write another's document, and does the erasure route leave a
copy behind? The answer is not allowed to depend on a `user_id` in a request body, because
a body is the one thing a caller controls.

The second is honesty about the ✨ button. `POST /api/ai/resume-suggest` answers from the
app's own career catalogue whenever no AI provider is configured, when the provider cannot
be reached, and when it returns something unreadable. Every one of those answers carries
`demo_generated: true`, because a list labelled "AI suggested" when no model was consulted
is the thing this project will not print. The stand-in provider in section 7 is what proves
the flag flips both ways, and that a model's overlong answer is bounded before a student
ever sees it as something they can save.

Runs against a throwaway database, never `careerguide.db`.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/resume_test.py
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_resume_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py

from fastapi.testclient import TestClient  # noqa: E402
from limits import parse  # noqa: E402 - the same parser the limiter itself uses
from sqlalchemy import select  # noqa: E402

from app.config import Settings, get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Career, Resume, User  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n=== {title}")


def rows_for(user_id: int) -> list[Resume]:
    with SessionLocal() as db:
        return list(db.scalars(select(Resume).where(Resume.user_id == user_id)))


def document(role: str = "Software Engineer") -> dict:
    """A small, ordinary CV — the payload the screen actually sends."""
    return {
        "target_role": role,
        "education": [
            {"class_level": "class-10", "school": "Govt. High School", "year": "2025", "result": "82%"},
            {"class_level": "class-12", "school": None, "year": None, "result": "appearing"},
        ],
        "skills": [
            {"name": "Python", "level": "learning"},
            {"name": "Spreadsheets", "level": "comfortable"},
        ],
        "projects": [
            {"title": "Attendance tracker", "detail": "A sheet my teacher uses every morning.", "year": "2026"},
        ],
    }


def skills(count: int) -> list[dict]:
    return [{"name": f"Skill {n}", "level": ""} for n in range(count)]


RESUME_URL = "/api/resume"
SUGGEST_URL = "/api/ai/resume-suggest"

with TestClient(app) as client:
    section("0. the limit this feature asks for is one the config understands")
    settings = get_settings()
    check("a resume bucket is configured", bool(settings.rate_limit_resume), repr(settings.rate_limit_resume))
    rule = None
    try:
        rule = bool(parse(settings.rate_limit_resume))
    except ValueError as caught:
        rule = False
        print(f"        {caught}")
    check("…and it is a real rate rule, not a typo", rule is True, settings.rate_limit_resume)
    # Not "is the field listed in a decorator" — actually build the settings object the
    # way the boot does and see whether a nonsense rule survives. A bucket the config
    # does not check is a bucket that silently becomes no limit at all.
    from pydantic import ValidationError  # noqa: E402 - only this one check needs it

    try:
        Settings(rate_limit_resume="every other tuesday")
        caught = None
    except ValidationError as exc:
        caught = exc
    check(
        "…and the boot-time validator rejects a bad RATE_LIMIT_RESUME rather than serving it",
        caught is not None and any(error["loc"] == ("rate_limit_resume",) for error in caught.errors()),
        str(caught)[:200] if caught else "Settings accepted 'every other tuesday'",
    )

    section("1. who may reach it")
    check("a request with no session is turned away", client.get(RESUME_URL).status_code == 401)
    check("so is a save", client.post(RESUME_URL, json=document()).status_code == 401)
    check("and so is the suggester", client.post(SUGGEST_URL, json={"target_role": "Doctor"}).status_code == 401)

    guardian = client.post(
        "/api/auth/onboarding",
        json={
            "role": "parent",
            "display_name": "Ma",
            "preferred_language": "en",
            "consent_profile": True,
            "consent_age": "adult",
            "device_id": "parentresume000000000000001",
        },
    )
    assert guardian.status_code == 200, guardian.text
    ph = {"Authorization": f"Bearer {guardian.json()['token']}"}
    check("a parent is not handed a child's CV", client.get(RESUME_URL, headers=ph).status_code == 403)
    check("…and cannot write one over them", client.post(RESUME_URL, json=document(), headers=ph).status_code == 403)
    check("…and does not spend a provider call on their behalf",
          client.post(SUGGEST_URL, json={"target_role": "Doctor"}, headers=ph).status_code == 403)

    def student(device: str, name: str) -> dict:
        created = client.post(
            "/api/auth/onboarding",
            json={
                "role": "student",
                "display_name": name,
                "preferred_language": "en",
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

    one = student("studentresume00000000000001", "Riya")
    two = student("studentresume00000000000002", "Aman")

    section("2. a first visit is an empty document, not a missing page")
    first = client.get(RESUME_URL, headers=one["auth"])
    check("opening a resume answers 200 rather than 404", first.status_code == 200, first.text[:200])
    body = first.json()
    check("…holding nothing", body["education"] == [] and body["skills"] == [] and body["projects"] == [], body)
    check("…and no date, because nothing was saved", body["saved_at"] is None, body)
    check("looking did not write a row", rows_for(one["id"]) == [], [r.user_id for r in rows_for(one["id"])])

    section("3. saving")
    saved = client.post(RESUME_URL, json=document(), headers=one["auth"])
    check("a student can save their own CV", saved.status_code == 200, saved.text[:240])
    check("…and the answer is the document they sent", saved.json()["skills"] == document()["skills"], saved.json())
    check("…with a timestamp on it", saved.json()["saved_at"] is not None, saved.json())
    check("two saves are still one resume per account", len(rows_for(one["id"])) == 1,
          [r.user_id for r in rows_for(one["id"])])
    check("…keyed by the account the session proved, not by anything in the body",
          rows_for(one["id"])[0].user_id == one["id"])
    read_back = client.get(RESUME_URL, headers=one["auth"]).json()
    check("reading it back gives the same document",
          read_back["education"] == document()["education"]
          and read_back["projects"] == document()["projects"], read_back)
    check("the target role is kept", read_back["target_role"] == "Software Engineer", read_back)

    replaced = document()
    replaced["skills"] = [{"name": "Excel", "level": "confident"}]
    again = client.post(RESUME_URL, json=replaced, headers=one["auth"])
    check("saving again replaces the list rather than appending to it",
          again.json()["skills"] == [{"name": "Excel", "level": "confident"}], again.json())

    hindi = document()
    hindi["skills"] = [{"name": "प्रस्तुति", "level": "comfortable"}]
    hindi["projects"] = [{"title": "विज्ञान मेला", "detail": "स्कूल में बनाया।", "year": "2026"}]
    typed = client.post(RESUME_URL, json=hindi, headers=one["auth"])
    check("a Hindi CV survives the round trip unchanged",
          typed.json()["skills"] == hindi["skills"] and typed.json()["projects"] == hindi["projects"],
          typed.json())

    emptied = client.post(
        RESUME_URL,
        json={"target_role": None, "education": [], "skills": [], "projects": []},
        headers=one["auth"],
    )
    check("a student can clear the whole thing",
          emptied.status_code == 200 and emptied.json()["skills"] == [], emptied.text[:200])

    client.post(RESUME_URL, json=document(), headers=one["auth"])

    section("4. the bounds a body cannot talk past")
    refused_bodies = [
        ("21 skills", {**document(), "skills": skills(21)}),
        ("an 81-character skill name", {**document(), "skills": [{"name": "x" * 81, "level": ""}]}),
        ("9 education lines", {**document(), "education": [{"class_level": "class-10"}] * 9}),
        ("11 projects", {**document(), "projects": [{"title": "T", "detail": None, "year": None}] * 11}),
        ("a 601-character project", {**document(), "projects": [{"title": "T", "detail": "y" * 601}]}),
        ("a 121-character target role", {**document(), "target_role": "z" * 121}),
        ("a class below the app's floor", {**document(), "education": [{"class_level": "class-4"}]}),
        ("a made-up class", {**document(), "education": [{"class_level": "grade-10"}]}),
        ("a skill level the app does not offer", {**document(), "skills": [{"name": "Python", "level": "expert"}]}),
        ("an education line with no class", {**document(), "education": [{"school": "Some school"}]}),
        ("somebody else's account number", {**document(), "user_id": two["id"]}),
        ("a resume id of its own", {**document(), "id": 7}),
    ]
    for label, payload in refused_bodies:
        response = client.post(RESUME_URL, json=payload, headers=one["auth"])
        check(f"{label} is refused, not quietly truncated", response.status_code == 422,
              f"{response.status_code} {response.text[:120]}")
    check("a refusal left the saved document alone",
          client.get(RESUME_URL, headers=one["auth"]).json()["skills"] == document()["skills"])
    fits = client.post(RESUME_URL, json={**document(), "skills": skills(20)}, headers=one["auth"])
    check("and twenty skills is the number that fits", fits.status_code == 200, fits.text[:160])
    check("…saving it stores all twenty", len(fits.json()["skills"]) == 20, len(fits.json()["skills"]))
    client.post(RESUME_URL, json=document(), headers=one["auth"])

    section("5. one account cannot see or write another")
    other = client.get(RESUME_URL, headers=two["auth"])
    check("a second student gets their own empty CV",
          other.status_code == 200 and other.json()["skills"] == [], other.json())
    check("…not the first one's", "Python" not in json.dumps(other.json()))
    client.post(RESUME_URL, json=document("Nurse"), headers=two["auth"])
    check("and writing theirs does not touch the first",
          client.get(RESUME_URL, headers=one["auth"]).json()["target_role"] == "Software Engineer")
    check("…with two rows, one per account",
          len(rows_for(one["id"])) == 1 and len(rows_for(two["id"])) == 1)
    with SessionLocal() as db:
        stored = db.get(Resume, two["id"])
        check("the second row belongs to the second student",
              stored is not None and stored.target_role == "Nurse",
              None if stored is None else stored.target_role)

    section("6. suggestions with no AI provider configured")
    blank = client.post(SUGGEST_URL, json={"target_role": "Software Engineer"}, headers=one["auth"])
    check("the suggester answers", blank.status_code == 200, blank.text[:200])
    suggested = blank.json()
    check("…and says plainly that no model was consulted",
          suggested["demo_generated"] is True and suggested["provider"] == "catalogue", suggested)
    check("…with something a student can actually use",
          len(suggested["skills"]) >= 4 and len(suggested["projects"]) >= 3,
          [len(suggested["skills"]), len(suggested["projects"])])
    check("…each of which fits the form that saves it",
          all(len(skill["name"]) <= 80 for skill in suggested["skills"])
          and all(len(project["title"]) <= 200 for project in suggested["projects"]))
    check("no skill claims a level the student never picked",
          all(skill["level"] == "" for skill in suggested["skills"]), suggested["skills"])
    check("“Software Engineer” names no career, because this catalogue has none",
          suggested["matched_career"] is None, suggested["matched_career"])
    with SessionLocal() as db:
        career = db.scalars(select(Career)).first()
    named = client.post(SUGGEST_URL, json={"target_role": f"I want to be a {career.title}"},
                        headers=one["auth"]).json()
    check("a career that is in the catalogue is named as the source",
          named["matched_career"] == career.title, [named["matched_career"], career.title])
    check("…and its own verified skills are what came back",
          named["skills"][0]["name"] in (career.useful_skills or []),
          [named["skills"][0]["name"], career.useful_skills])
    check("suggesting did not write anything to the resume",
          client.get(RESUME_URL, headers=one["auth"]).json()["skills"] == document()["skills"])
    short = client.post(SUGGEST_URL, json={"target_role": "x"}, headers=one["auth"])
    check("a one-character target role is refused before it is asked of anything",
          short.status_code == 422, short.status_code)

    section("7. suggestions with a stand-in provider")
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
    good = json.dumps(
        {
            "skills": [
                {"name": "Breaking a problem into steps", "level": "learning"},
                {"name": "Git"},
            ],
            "projects": [
                {"title": "A timetable generator", "detail": "Input classes and free rooms, get a grid."}
            ],
        }
    )
    try:
        settings.ai_provider = "openai"
        settings.ai_api_key = "stub-key-never-a-real-one"
        settings.ai_model = "stub-model"
        settings.ai_base_url = f"http://127.0.0.1:{port}/v1"

        replies.append(good)
        asked = client.post(SUGGEST_URL, json={"target_role": "Software Engineer"}, headers=one["auth"]).json()
        check("the model's own list comes back",
              asked["skills"][0]["name"] == "Breaking a problem into steps"
              and asked["projects"] == [{"title": "A timetable generator",
                                         "detail": "Input classes and free rooms, get a grid.", "year": ""}],
              asked)
        check("…and is not labelled as anything but the provider's",
              asked["demo_generated"] is False and asked["provider"] == "openai" and asked["error"] is None, asked)
        check("a model's guess about how far along the student is does not arrive as a level",
              all(skill["level"] == "" for skill in asked["skills"]), asked["skills"])
        sent = calls[-1]["body"]
        system = sent["messages"][0]["content"]
        check("the role the student typed reaches the prompt",
              sent["messages"][0]["role"] == "system" and "Software Engineer" in system, system[:200])
        check("…with the rules that keep it a student's list",
              "Never suggest paying for a course" in system, system[:80])
        check("…and the JSON contract the parser reads", '{"skills": [' in system, system[-160:])
        # The real configured model is a reasoning model: at 900 tokens it spent the
        # whole budget thinking, returned an empty `content`, and every ✨ click fell
        # back to the catalogue. A budget that only sizes the answer is not a budget.
        check("the completion budget leaves room for a reasoning model to think first",
              calls[-1]["body"]["max_tokens"] >= 2000, calls[-1]["body"]["max_tokens"])
        check("the key travels only as a header",
              calls[-1]["auth"] == "Bearer stub-key-never-a-real-one"
              and "stub-key" not in json.dumps(sent), calls[-1]["auth"])
        # `/privacy` tells a family that only the job title they type leaves the
        # machine. This account now holds a CV with a sentinel in it, so that
        # sentence is checked against every request the stub has recorded rather
        # than read off the route.
        with_cv = document()
        with_cv["education"][0]["school"] = "Sentinel Vidyalaya 9132"
        with_cv["projects"][0]["detail"] = "Riya Sharma, 98765-43210"
        client.post(RESUME_URL, json=with_cv, headers=one["auth"])
        client.post(SUGGEST_URL, json={"target_role": "Pilot"}, headers=one["auth"])
        recorded = json.dumps(calls)
        check("…and nothing from the saved CV is in any provider request",
              "Sentinel Vidyalaya" not in recorded
              and "98765-43210" not in recorded
              and "Riya Sharma" not in recorded
              and "Attendance tracker" not in recorded,
              recorded[:200])

        replies.append("```json\n" + good + "\n```")
        fenced = client.post(SUGGEST_URL, json={"target_role": "Doctor"}, headers=one["auth"]).json()
        check("a fenced reply still parses",
              fenced["demo_generated"] is False and fenced["skills"] != [], fenced)

        replies.append("```json\n" + good + "\n```Here is why these matter.")
        padded = client.post(SUGGEST_URL, json={"target_role": "Pilot"}, headers=one["auth"]).json()
        check("…and so does one with a sentence trailing after it",
              padded["demo_generated"] is False, padded)

        replies.append(json.dumps({
            "skills": [{"name": f"Skill {n} with a name far longer than any student would type into a form", "level": "expert"} for n in range(40)],
            "projects": [{"title": "T" * 900, "detail": "y" * 5000}] * 9,
        }))
        greedy = client.post(SUGGEST_URL, json={"target_role": "Architect"}, headers=one["auth"]).json()
        check("forty skills from a model arrive bounded",
              len(greedy["skills"]) == 8 and all(len(s["name"]) <= 80 for s in greedy["skills"]),
              len(greedy["skills"]))
        check("…and a level the app never offered is dropped rather than saved",
              all(s["level"] == "" for s in greedy["skills"]), greedy["skills"][:3])
        check("nine projects arrive as five, with the prose cut to the field's limit",
              len(greedy["projects"]) == 5
              and all(len(p["title"]) <= 200 for p in greedy["projects"])
              and all(len(p["detail"]) <= 600 for p in greedy["projects"]),
              [len(greedy["projects"]), len(greedy["projects"][0]["title"]), len(greedy["projects"][0]["detail"])])
        check("…which is a document the save route accepts without a complaint",
              client.post(RESUME_URL, json={"target_role": "Architect", "education": [],
                                            "skills": greedy["skills"], "projects": greedy["projects"]},
                          headers=one["auth"]).status_code == 200)
        client.post(RESUME_URL, json=document(), headers=one["auth"])

        replies.append("I'm not able to suggest anything for that.")
        prose = client.post(SUGGEST_URL, json={"target_role": "Lawyer"}, headers=one["auth"]).json()
        check("a model that answers in prose falls back, and blames its own reply not the connection",
              prose["demo_generated"] is True and prose["provider"] == "catalogue"
              and "did not return usable suggestions" in (prose["error"] or "")
              and "could not be reached" not in (prose["error"] or ""), prose)
        check("…still handing the student a usable list",
              len(prose["skills"]) >= 4 and len(prose["projects"]) >= 3,
              [len(prose["skills"]), len(prose["projects"])])

        replies.append(json.dumps({"skills": [], "projects": []}))
        nothing = client.post(SUGGEST_URL, json={"target_role": "Chef"}, headers=one["auth"]).json()
        check("an empty list from a model is not passed on as an empty resume",
              nothing["demo_generated"] is True and nothing["skills"] != [], nothing)

        replies.append(json.dumps(["not", "an", "object"]))
        array = client.post(SUGGEST_URL, json={"target_role": "Editor"}, headers=one["auth"]).json()
        check("an array where an object was promised degrades, it does not 500",
              array["demo_generated"] is True and array["skills"] != [], array)
        check("…and is described as the odd reply it was",
              "did not return usable suggestions" in (array["error"] or ""), array["error"])

        devanagari = client.post(SUGGEST_URL, json={"target_role": "डॉक्टर"}, headers=one["auth"])
        check("a Hindi target role is answered", devanagari.status_code == 200, devanagari.text[:160])
        check("…asked of the model in Hindi, because that is what the student wrote",
              "Write the text in Hindi" in calls[-1]["body"]["messages"][0]["content"],
              calls[-1]["body"]["messages"][0]["content"][-160:])

        settings.ai_base_url = "http://127.0.0.1:1/v1"
        down = client.post(SUGGEST_URL, json={"target_role": "Software Engineer"}, headers=one["auth"]).json()
        check("an unreachable provider costs the student nothing but the truth",
              down["demo_generated"] is True and "could not be reached" in (down["error"] or ""), down)
        check("…and the catalogue list is still a real answer", len(down["skills"]) >= 4, down["skills"])

        settings.ai_provider = "demo"
        settings.ai_api_key = ""
        settings.ai_model = ""
        settings.ai_base_url = "https://api.openai.com/v1"
        unconfigured = client.post(SUGGEST_URL, json={"target_role": "Software Engineer"},
                                   headers=one["auth"]).json()
        check("back in demo mode the answer is the catalogue again",
              unconfigured["provider"] == "catalogue" and unconfigured["demo_generated"] is True, unconfigured)
    finally:
        settings.ai_provider = "demo"
        settings.ai_api_key = ""
        settings.ai_model = ""
        settings.ai_base_url = "https://api.openai.com/v1"
        stub.shutdown()
        stub.server_close()

    section("8. erasure takes the CV with it")
    gone = client.delete("/api/users/me", headers=one["auth"])
    check("the account asks for its own erasure", gone.status_code == 200, gone.text[:200])
    check("…and counts the resume among what it removed",
          gone.json()["removed"].get("resume") == 1, str(gone.json()["removed"])[:200])
    check("…leaving no row keyed to that account", rows_for(one["id"]) == [], [r.user_id for r in rows_for(one["id"])])
    left = client.get(RESUME_URL, headers=two["auth"])
    check("the other student's CV is untouched",
          left.status_code == 200 and left.json()["target_role"] == "Nurse", left.json())
    with SessionLocal() as db:
        check("…still exactly one row, still theirs", rows_for(two["id"]) != [])
        check("and no resume outlives the account it was keyed to",
              db.query(Resume).join(User, Resume.user_id == User.id).filter(User.role == "erased").count() == 0)

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + ", ".join(FAIL))
    sys.exit(1)
