"""Test that the conversation, not a form, fills in the student's situation.

Onboarding is now a single question, so this checks the machinery behind it: the
guide asks for one missing fact at a time, a clear answer is stored on the
profile, an ambiguous one is not, and nothing the student already said gets
overwritten.

Runs against a throwaway database, never `careerguide.db`.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/conversation_facts_test.py
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_facts_test.db"
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


with TestClient(app) as client:
    signup = client.post(
        "/api/auth/onboarding",
        json={
            "role": "student",
            "display_name": "Riya",
            "preferred_language": "hinglish",
            "consent_profile": True,
            "consent_age": "9-10",
        },
    )
    check("onboarding works with only a role and a name", signup.status_code == 200, signup.text[:200])
    headers = {"Authorization": f"Bearer {signup.json()['token']}"}
    profile = signup.json()["profile"]
    check(
        "nothing but the name is assumed",
        profile["class_level"] is None
        and profile["education_context"] is None
        and profile["interest_areas"] == [],
        profile,
    )

    started = client.post("/api/conversations", json={"mode": "chat"}, headers=headers)
    check("a conversation starts", started.status_code == 201, started.text[:200])
    session_id = started.json()["id"]

    def say(message: str) -> dict:
        response = client.post(
            f"/api/conversations/{session_id}/messages",
            json={"message": message},
            headers=headers,
        )
        assert response.status_code == 200, response.text[:300]
        return response.json()

    def current_profile() -> dict:
        return client.get("/api/auth/me", headers=headers).json()["profile"]

    first = say("hi")
    print(f"      stage {first['stage']}: {first['reply']['content'][:80]}")
    check(
        "the guide asks for the class instead of a form",
        "class" in first["reply"]["content"].lower(),
        first["reply"]["content"],
    )
    check("asking is not storing", current_profile()["class_level"] is None, current_profile())

    answered = say("main class 8 mein hoon")
    check(
        "the answer is read out of the chat",
        answered["profile_updates"].get("class_level") == "class-8",
        answered["profile_updates"],
    )
    stored = current_profile()
    check("it is on the profile", stored["class_level"] == "class-8", stored)
    check("the age band follows the class", stored["age_range"] == "11-12", stored)

    noise = say("class 3 hours of study daily is too much")
    check("a stray number teaches nothing", noise["profile_updates"] == {}, noise["profile_updates"])
    check("and cannot overwrite the answer", current_profile()["class_level"] == "class-8", current_profile())

    transcript = []
    for _ in range(8):
        turn = say("mujhe drawing aur puzzles pasand hain, main roz inme time bitata hoon")
        transcript.append(turn["reply"]["content"])
        if any("government school" in line.lower() for line in transcript):
            break
    check(
        "later in the chat it asks where the student studies",
        any("government school" in line.lower() for line in transcript),
        transcript[-1] if transcript else "",
    )

    edu = say("main sarkari school jaata hoon")
    check(
        "the situation is stored as a fixed description",
        edu["profile_updates"].get("education_context") == "Studies at a government school.",
        edu["profile_updates"],
    )
    final = current_profile()
    check("the student's own words are not kept in the profile", final["education_context"] == "Studies at a government school.", final)

    asked = client.get(f"/api/conversations/{session_id}/messages", headers=headers).json()
    fact_questions = [
        line["content"]
        for line in asked
        if line["role"] == "assistant"
        and ("class" in line["content"].lower() or "school" in line["content"].lower())
    ]
    check(
        "each reply still carries at most one question",
        all(line["content"].count("?") <= 1 for line in asked if line["role"] == "assistant"),
        [line["content"] for line in asked if line["role"] == "assistant" and line["content"].count("?") > 1],
    )
    print(f"      fact questions asked: {len(fact_questions)}")

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("failed: " + ", ".join(FAIL))
    sys.exit(1)
