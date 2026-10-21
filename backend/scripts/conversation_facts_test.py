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
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py

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

    started = client.post("/api/conversations", json={"kind": "chat"}, headers=headers)
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

    noise = say("class 9 hours of study daily is too much")
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

    # A child who volunteers a fact inside a longer sentence should not have to
    # say it twice — and a number that is not about them must still teach nothing.
    from app.services import profile_facts  # noqa: E402

    second = client.post(
        "/api/auth/onboarding",
        json={
            "role": "student",
            "display_name": "Arav",
            "preferred_language": "hinglish",
            "consent_profile": True,
            "consent_age": "11-12",
        },
    )
    arav = {"Authorization": f"Bearer {second.json()['token']}"}
    second_session = client.post("/api/conversations", json={"kind": "chat"}, headers=arav).json()["id"]

    def say2(message: str) -> dict:
        response = client.post(
            f"/api/conversations/{second_session}/messages",
            json={"message": message},
            headers=arav,
        )
        assert response.status_code == 200, response.text[:300]
        return response.json()

    def arav_profile() -> dict:
        return client.get("/api/auth/me", headers=arav).json()["profile"]

    check(
        "a duration is never read as a class, even in a first-person sentence",
        say2("Main roz class 9 hours padhai karta hoon, mujhe cricket pasand hai")["profile_updates"] == {},
        arav_profile(),
    )
    check(
        "and a family member's class is not the student's",
        say2("mere papa class 12 mein the, isliye mujhe engineering thodi pata hai")["profile_updates"] == {},
        arav_profile(),
    )
    volunteered = say2("Mujhe design pasand hai, main class 8 mein hoon")
    check(
        "a class volunteered mid-sentence is stored without being asked twice",
        volunteered["profile_updates"].get("class_level") == "class-8",
        volunteered["profile_updates"],
    )
    check("and it lands on the profile", arav_profile()["class_level"] == "class-8", arav_profile())
    check(
        "the guide moves on instead of re-asking the class",
        "kaunsi class" not in volunteered["reply"]["content"].lower(),
        volunteered["reply"]["content"],
    )

    stated = profile_facts.self_stated
    check("Devanagari self-statement counts", stated("class_level", "मैं कक्षा ८ में हूँ और मुझे चित्रकारी पसंद है") == "class-8")
    check(
        "an age volunteered mid-sentence sets the band",
        profile_facts.applicable_facts("Mujhe football pasand hai, meri age 13 hai", {})
        == {"age": 13, "age_range": "adult"},
    )
    # The same sentence read two ways: the number is what the student said, and the band
    # is the guide's own framework derived from it. Neither is asked of the student.
    check("a stated age is kept as the number", profile_facts.detect_age_years("meri age 13 hai") == 13)
    check("…including the Hindi way of saying it", profile_facts.detect_age_years("main 14 saal ka hoon") == 14)
    check("…and Devanagari digits", profile_facts.detect_age_years("उम्र १५ वर्ष है") == 15)
    check("a number that means nothing else is still not an age",
          profile_facts.detect_age_years("main 14 rupaye ka pencil lata hoon") is None)
    check("an age outside the range the app can speak to is ignored, not stored",
          profile_facts.detect_age_years("meri age 2 hai") is None)
    check("…and the two ends of the range itself are kept, inclusive",
          [profile_facts.detect_age_years(f"meri age {n} hai") for n in (3, 99)] == [3, 99],
          [profile_facts.detect_age_years(f"meri age {n} hai") for n in (3, 99)])
    check(
        "and the band it implies is never handed back as the student's own answer",
        profile_facts.detect_age_range("meri age 13 hai") == "adult",
    )
    check(
        "each band boundary is derived from the number, not chosen beside it",
        [profile_facts.band_for_age(years) for years in (5, 6, 8, 9, 10, 11, 12, 13, 40)]
        == ["3-5", "6-8", "6-8", "9-10", "9-10", "11-12", "11-12", "adult", "adult"],
        [profile_facts.band_for_age(years) for years in (5, 6, 8, 9, 10, 11, 12, 13, 40)],
    )
    check("class 9 hours never becomes a class", profile_facts.detect_class_level("class 9 hours of study") is None)
    check(
        "a class below six states nothing this app can serve",
        profile_facts.detect_class_level("main class 3 mein hoon") is None,
    )
    check("'My class is 8' is read", profile_facts.detect_class_level("My class is 8 and I like drawing") == "class-8")
    check(
        "a third-person sentence states nothing",
        stated("class_level", "mere papa class 12 mein the aur mere bhai ne bhi wahi liya tha") is None,
    )

    # The same fact typed into the profile field, from the other direction: the number
    # is stored as stated, the band is never accepted from the client, and a number the
    # server refuses changes nothing at all.
    def patch_age(body: object):
        return client.patch("/api/auth/profile", json=body, headers=headers)

    typed = patch_age({"age": 14})
    check("a student types their real age instead of choosing a band", typed.status_code == 200, typed.text[:200])
    check("…stored as the number they typed", typed.json()["age"] == 14, typed.json())
    check("…and the band the guide works in follows it", typed.json()["age_range"] == "adult", typed.json())

    second_age = patch_age({"age": 13})
    check("a second number replaces the first instead of being added to it",
          (second_age.json()["age"], second_age.json()["age_range"]) == (13, "adult"), second_age.json())

    check("…and it survives a reload", (client.get("/api/auth/me", headers=headers).json()["profile"])["age"] == 13)

    stale_band = patch_age({"age_range": "3-5"})
    check("a client cannot hand back a band the number says otherwise",
          stale_band.status_code == 200
          and (stale_band.json()["age"], stale_band.json()["age_range"]) == (13, "adult"),
          stale_band.json() if stale_band.status_code == 200 else stale_band.text[:200])

    for rejected in (2, 100, "fourteen", 14.5):
        refused = patch_age({"age": rejected})
        check(f"an age of {rejected!r} is refused, not stored", refused.status_code == 422, refused.text[:200])
        check(f"…and the age that was already there is untouched",
              client.get("/api/auth/me", headers=headers).json()["profile"]["age"] == 13)

    cleared = patch_age({"age": None})
    check("clearing the field takes the number back", cleared.status_code == 200 and cleared.json()["age"] is None,
          cleared.text[:200])
    check("…and the band that existed only because of it goes with it, falling back to the class",
          cleared.json()["age_range"] == "11-12", cleared.json())

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("failed: " + ", ".join(FAIL))
    sys.exit(1)
