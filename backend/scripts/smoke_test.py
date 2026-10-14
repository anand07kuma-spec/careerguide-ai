"""End-to-end smoke test for the CareerGuide AI backend.

Runs the FastAPI app in-process against a throwaway database, so it never touches
`careerguide.db`. It checks the behaviour the product promises: consent gates,
server-side ownership, the conversation pipeline, recommendations, plans,
reports, the parent dashboard and the transparency rules.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/smoke_test.py
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_smoke.db"
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
    print(f"  [{mark}] {label}{(' — ' + detail) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n== {title} ==")


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


STUDENT = {
    "role": "student",
    "display_name": "Aarav",
    "preferred_language": "hinglish",
    "class_level": "class-9",
    "interest_areas": ["drawing", "how things are built"],
    "consent_profile": True,
    "consent_voice": True,
    "consent_age": "11-12",
}

client = TestClient(app)

with client:
    section("Health and catalogue")
    r = client.get("/api/health")
    check("health responds", r.status_code == 200, r.text)
    check("health declares demo mode", r.json().get("demo_mode") is True)

    r = client.get("/api/careers")
    careers = r.json()
    check("career catalogue seeded", r.status_code == 200 and len(careers) >= 40, str(len(careers)))
    check(
        "every career is marked for verification",
        all(c.get("needs_verification", True) for c in careers),
    )
    r = client.get("/api/careers/categories")
    check("categories listed", r.status_code == 200 and len(r.json()) >= 12, str(len(r.json())))
    r = client.get("/api/careers", params={"q": "engineer"})
    check("career search filters", r.status_code == 200 and len(r.json()) >= 1)
    slug = careers[0]["slug"]
    r = client.get(f"/api/careers/{slug}")
    check("career detail loads", r.status_code == 200 and r.json()["slug"] == slug, r.text[:200])

    r = client.get("/api/resources")
    check("resources listed", r.status_code == 200 and len(r.json()) >= 40, str(len(r.json())))
    r = client.get("/api/scholarships")
    scholarships = r.json()
    check("scholarships listed", r.status_code == 200 and len(scholarships) >= 15)
    check(
        "every scholarship carries a disclaimer",
        all(s["disclaimer"] for s in scholarships),
    )
    check(
        "no scholarship claims to be verified",
        all(s["verified"] is False for s in scholarships),
    )
    r = client.get("/api/institutions")
    institutions = r.json()
    check("institutions listed", r.status_code == 200 and len(institutions) >= 15)
    sponsored_pos = [i for i, row in enumerate(institutions) if row["sponsored"]]
    unsponsored_pos = [i for i, row in enumerate(institutions) if not row["sponsored"]]
    check(
        "paid listings never outrank free ones",
        (not sponsored_pos) or (unsponsored_pos and min(sponsored_pos) > min(unsponsored_pos)),
        f"sponsored at {sponsored_pos}",
    )
    check(
        "sponsored rows disclose it",
        all(row["sponsorship_disclosure"] for row in institutions if row["sponsored"]),
    )
    r = client.get("/api/interests/prompts?language=en")
    prompts = r.json()["prompts"]
    check("interest prompts listed", r.status_code == 200 and len(prompts) >= 5, str(len(prompts)))
    check("interest prompts say they are not a test", "not a test" in r.json().get("note", "").lower())
    hindi = client.get("/api/interests/prompts?language=hi").json()["prompts"]
    check(
        "interest prompts localise to Devanagari on request",
        any("\u0900" <= ch <= "\u097f" for p in hindi for ch in p["question"]),
        hindi[0]["question"][:60],
    )
    check(
        "default interest prompts are Hinglish for now",
        client.get("/api/interests/prompts").json()["prompts"][0]["question"].startswith("Jab free time"),
    )
    r = client.get("/api/voice/voices")
    check("voice list served", r.status_code == 200 and r.json()["default_voice"], r.text[:200])

    section("Consent is enforced on the server")
    r = client.post("/api/auth/onboarding", json={**STUDENT, "consent_profile": False})
    check("onboarding without consent is refused", r.status_code == 400, r.text[:200])

    r = client.post("/api/auth/onboarding", json=STUDENT)
    check("student onboarding succeeds", r.status_code == 200, r.text[:300])
    body = r.json()
    student_token = body["token"]
    check("session returns profile and settings", body["profile"] and body["settings"])
    check(
        "token is not the user id",
        student_token not in {"1", "2"} and len(student_token) > 16,
    )

    r = client.get("/api/auth/me", headers=auth(student_token))
    check("me restores the session", r.status_code == 200 and r.json()["user"]["display_name"] == "Aarav")
    r = client.get("/api/auth/me")
    check("me without a token is rejected", r.status_code in (401, 422), r.text[:120])
    r = client.get("/api/auth/me", headers=auth("bogus-token-value"))
    check("a made-up token is rejected", r.status_code == 401)

    section("Conversation pipeline")
    r = client.post("/api/conversations", json={"kind": "chat"}, headers=auth(student_token))
    check("chat session starts", r.status_code == 201, r.text[:200])
    session_id = r.json()["id"]
    check("greeting is returned", bool(r.json().get("greeting")))

    turns = [
        "Mujhe drawing aur naye cheezein banana pasand hai",
        "Haan, main blocks aur machines ke drawings dekhta hoon",
        "Papa chahte hain engineer ban jaoon, mujhe pata nahi",
    ]
    last_stage = 0
    reply_seen = False
    for text in turns:
        r = client.post(
            f"/api/conversations/{session_id}/messages",
            json={"message": text, "speak": False},
            headers=auth(student_token),
        )
        if r.status_code != 200:
            check("message turn succeeded", False, r.text[:300])
            break
        data = r.json()
        reply_seen = reply_seen and bool(data["reply"]["content"])
        check("reply is non-empty", bool(data["reply"]["content"]), str(data)[:200])
        check(
            "demo replies are labelled",
            data["provider"] == "demo" and data["reply"]["demo_generated"] is True,
            str(data["provider"]),
        )
        check("stage only moves forward", data["stage"] >= last_stage)
        last_stage = data["stage"]

    r = client.get(f"/api/conversations/{session_id}/messages", headers=auth(student_token))
    check("transcript persists", r.status_code == 200 and len(r.json()) >= 1 + 2 * len(turns))

    r = client.post(
        f"/api/conversations/{session_id}/messages",
        json={"message": "Please do not tell anyone, my uncle hits me at home", "speak": False},
        headers=auth(student_token),
    )
    safety_body = r.json() if r.status_code == 200 else {}
    safety_text = (safety_body.get("reply") or {}).get("content", "").lower()
    check(
        "a distress disclosure gets a safety reply",
        "1098" in safety_text or "trusted adult" in safety_text,
        safety_text[:220],
    )
    # The verdict the chat screen draws the helpline card from, in the same reply
    # so no second request can decide whether help appears.
    check("the reply itself carries the support flag", safety_body.get("needs_support") is True,
          str(safety_body)[:200])
    r = client.post(
        f"/api/conversations/{session_id}/messages",
        json={"message": "I like building things with blocks", "speak": False},
        headers=auth(student_token),
    )
    check("an ordinary message does not raise the support flag",
          r.status_code == 200 and r.json()["needs_support"] is False, r.text[:200])

    section("the configured AI provider path, against a stand-in service")
    # The app ships in demo mode, so nothing here had ever exercised the real
    # provider call, and "just add a key and it works" was a guess. A local stub
    # answers as the provider instead, which also proves a distress disclosure is
    # still routed to the reviewed safety reply rather than to the model.
    import json
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    from app.config import get_settings  # noqa: PLC0415

    provider_calls: list[dict] = []

    class StubProvider(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            length = int(self.headers.get("Content-Length", 0))
            provider_calls.append(
                {
                    "body": json.loads(self.rfile.read(length)),
                    "auth": self.headers.get("Authorization", ""),
                }
            )
            payload = json.dumps(
                {"choices": [{"message": {"role": "assistant", "content": "Tell me more about that."}}]}
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
    settings = get_settings()

    def use_demo_provider() -> None:
        settings.ai_provider = "demo"
        settings.ai_api_key = ""
        settings.ai_model = ""
        settings.ai_base_url = "https://api.openai.com/v1"

    try:
        settings.ai_provider = "openai"
        settings.ai_api_key = "stub-key-never-a-real-one"
        settings.ai_model = "stub-model"
        settings.ai_base_url = f"http://127.0.0.1:{stub.server_address[1]}/v1"

        r = client.post(
            f"/api/conversations/{session_id}/messages",
            json={"message": "I like sketching maps of imaginary places", "speak": False},
            headers=auth(student_token),
        )
        body = r.json() if r.status_code == 200 else {}
        check(
            "an ordinary message reaches the configured provider",
            len(provider_calls) == 1 and body.get("provider") == "openai",
            f"{len(provider_calls)} calls, {str(body)[:160]}",
        )
        check(
            "and the model's own words come back, unlabelled as demo",
            body.get("reply", {}).get("content") == "Tell me more about that."
            and body.get("reply", {}).get("demo_generated") is False,
            str(body.get("reply"))[:160],
        )
        sent = provider_calls[0]["body"] if provider_calls else {}
        check(
            "the request carries the model and a system prompt",
            sent.get("model") == "stub-model"
            and bool(sent.get("messages"))
            and sent["messages"][0]["role"] == "system",
            str(sent)[:200],
        )
        check(
            "the key travels only as a header, never in the URL",
            provider_calls[0]["auth"] == "Bearer stub-key-never-a-real-one",
            provider_calls[0]["auth"] if provider_calls else "no call",
        )

        calls_before = len(provider_calls)
        r = client.post(
            f"/api/conversations/{session_id}/messages",
            json={"message": "Please do not tell anyone, my uncle hits me at home", "speak": False},
            headers=auth(student_token),
        )
        guarded = r.json() if r.status_code == 200 else {}
        guarded_text = (guarded.get("reply") or {}).get("content", "").lower()
        check(
            "a disclosure is answered by the reviewed reply, not the model",
            ("1098" in guarded_text or "trusted adult" in guarded_text)
            and guarded.get("needs_support") is True,
            guarded_text[:200],
        )
        check(
            "and nothing about it is sent to the provider",
            len(provider_calls) == calls_before,
            f"{len(provider_calls) - calls_before} extra calls",
        )

        # A provider that is configured but unreachable must degrade to the
        # labelled demo guide rather than fail the student's turn.
        settings.ai_base_url = "http://127.0.0.1:1/v1"
        r = client.post(
            f"/api/conversations/{session_id}/messages",
            json={"message": "I enjoy teaching my younger sister maths", "speak": False},
            headers=auth(student_token),
        )
        fell_back = r.json() if r.status_code == 200 else {}
        check(
            "an unreachable provider falls back, and says so",
            r.status_code == 200
            and fell_back.get("reply", {}).get("demo_generated") is True,
            str(fell_back)[:200],
        )
    finally:
        stub.shutdown()
        use_demo_provider()

    r = client.get("/api/recommendations", headers=auth(student_token))
    recs = r.json()
    check("recommendations returned", r.status_code == 200 and len(recs["recommendations"]) >= 1)
    check(
        "recommendations explain themselves",
        all(item["why"] for item in recs["recommendations"]),
    )
    check(
        "recommendations carry an evidence level",
        all(item["evidence_level"] in {"early", "some", "good"} for item in recs["recommendations"]),
    )
    check(
        "no recommendation is a life sentence",
        all(
            "impossible" not in str(item).lower() and "cannot become" not in str(item).lower()
            for item in recs["recommendations"]
        ),
    )

    r = client.post("/api/recommendations/persist", headers=auth(student_token))
    check("recommendations can be saved", r.status_code == 200)

    section("Interests, journey, plans")
    r = client.get("/api/interests/observations", headers=auth(student_token))
    check("interest themes were observed", r.status_code == 200 and len(r.json()) >= 1)
    r = client.get("/api/interests/summary", headers=auth(student_token))
    check(
        "interest summary disclaims assessment",
        "not" in r.json().get("note", "").lower(),
        str(r.json())[:200],
    )
    r = client.post(
        "/api/interests/answers",
        json={"prompt_id": prompts[0]["id"], "answer": "I sketch machines and take old radios apart"},
        headers=auth(student_token),
    )
    check("interest answer accepted", r.status_code in (200, 201), r.text[:200])

    r = client.get("/api/journey", headers=auth(student_token))
    check("journey stats load", r.status_code == 200 and "sessions_completed" in r.json())

    r = client.post(
        "/api/study-plans",
        json={"title": "Try design for two weeks", "goal": "Find out whether design work suits me", "career_id": recs["recommendations"][0]["career"]["id"]},
        headers=auth(student_token),
    )
    check("study plan created", r.status_code == 201, r.text[:200])
    plan = r.json()
    check("plan comes with steps", len(plan["items"]) >= 3)
    check(
        "plan steps mention free practice",
        any("free" in str(item).lower() for item in plan["items"]),
    )
    item_id = plan["items"][0]["id"]
    r = client.patch(
        f"/api/study-plans/{plan['id']}/items/{item_id}",
        json={"status": "completed"},
        headers=auth(student_token),
    )
    check("plan step can be completed", r.status_code == 200 and r.json()["status"] == "completed", r.text[:200])

    section("Report")
    # A report joins the student's saved careers, so save one first. Generating a
    # report for a student with nothing saved never exercised that query.
    pre_saved = careers[0]
    client.post(f"/api/careers/{pre_saved['id']}/save", headers=auth(student_token))
    r = client.post("/api/reports", headers=auth(student_token))
    check("report generated", r.status_code == 201, r.text[:200])
    report = r.json()["content"]
    check("report states it is not an aptitude test", "not" in report["framing"].lower())
    check("report lists what is still unknown", isinstance(report["unanswered_questions"], list))
    check("report includes next steps", len(report["next_steps"]) >= 1)
    check(
        "report carries the saved career through",
        any(row["id"] == pre_saved["id"] for row in report["saved_careers"]),
        str(report["saved_careers"])[:200],
    )
    r = client.get("/api/reports/latest", headers=auth(student_token))
    check("latest report retrievable", r.status_code == 200 and r.json())
    client.delete(f"/api/careers/{pre_saved['id']}/save", headers=auth(student_token))

    section("Saving careers")
    target = careers[1]
    r = client.post(f"/api/careers/{target['id']}/save", headers=auth(student_token))
    check("career saved", r.status_code == 201, r.text[:200])
    r = client.get("/api/careers/saved", headers=auth(student_token))
    check("saved list reflects it", any(row["career"]["id"] == target["id"] for row in r.json()))
    r = client.delete(f"/api/careers/{target['id']}/save", headers=auth(student_token))
    check("career un-saved", r.status_code == 204)

    section("Parent dashboard and cross-family protection")
    r = client.post(
        "/api/auth/onboarding",
        json={
            "role": "parent",
            "display_name": "Mrs. Sharma",
            "student_name": "Riya",
            "preferred_language": "en",
            "student_class_level": "class-8",
            "relationship": "mother",
            "financial_context": "We can manage a government college fee, not a private one.",
            "consent_profile": True,
            "consent_voice": False,
            "consent_age": "11-12",
        },
    )
    check("parent onboarding succeeds", r.status_code == 200, r.text[:200])
    parent_token = r.json()["token"]

    r = client.get("/api/parent/children", headers=auth(parent_token))
    check("parent sees their own child", r.status_code == 200 and len(r.json()) >= 1)
    own_child = r.json()[0]["student_id"]

    student_id_for_code = None
    r = client.get("/api/auth/me", headers=auth(student_token))
    student_id_for_code = r.json()["user"]["id"]

    r = client.get("/api/parent/summary", params={"student_id": student_id_for_code}, headers=auth(parent_token))
    check(
        "a parent cannot read an unrelated child by changing the id",
        r.status_code == 404,
        r.text[:200],
    )
    r = client.get("/api/parent/guidance", params={"student_id": student_id_for_code, "concern": "engineer"}, headers=auth(parent_token))
    check("guidance refuses for an unrelated child", r.status_code == 404)

    r = client.get("/api/parent/summary", params={"student_id": own_child}, headers=auth(parent_token))
    check("parent reads their linked child", r.status_code == 200, r.text[:200])
    summary = r.json()
    check("parent summary names the child", summary["student"]["display_name"] == "Riya", str(summary)[:200])
    check("parent summary is honest about evidence", "recommendations" in summary)
    r = client.get(
        "/api/parent/guidance",
        params={"student_id": own_child, "concern": "must become an engineer"},
        headers=auth(parent_token),
    )
    check("parent guidance returns the 7-part structure", r.status_code == 200, r.text[:200])
    guidance = r.json()
    for key in (
        "acknowledgement", "evidence", "what_remains_unclear", "routes_and_costs",
        "alternatives", "low_risk_tests", "discussion_prompt", "seek_help_from",
    ):
        check(f"guidance has '{key}'", key in guidance, str(list(guidance.keys())))

    r = client.get("/api/conversations", headers=auth(parent_token))
    check("parent cannot use student conversation area", r.status_code == 403, r.text[:200])
    r = client.get("/api/auth/me", headers=auth(parent_token))
    check("parent session resolves", r.status_code == 200 and r.json()["user"]["role"] == "parent")

    section("Voice consent gate")
    r = client.post(
        "/api/auth/onboarding",
        json={**STUDENT, "display_name": "No Voice", "consent_voice": False},
    )
    nv_token = r.json()["token"]
    r = client.post("/api/conversations", json={"kind": "voice"}, headers=auth(nv_token))
    check("voice call blocked without voice consent", r.status_code == 403, r.text[:200])
    r = client.post("/api/conversations", json={"kind": "chat"}, headers=auth(nv_token))
    check("text chat still allowed", r.status_code == 201)

    section("Share-code linking (student stays in control)")
    r = client.get("/api/auth/share-code", headers=auth(student_token))
    check("student has a share code", r.status_code == 200 and r.json()["code"], r.text[:200])
    code = r.json()["code"]
    r = client.post("/api/auth/link-child", json={"code": code, "relationship": "father"}, headers=auth(parent_token))
    check("parent links with the code", r.status_code == 200 and len(r.json()) == 2, r.text[:200])
    r = client.get("/api/parent/summary", params={"student_id": student_id_for_code}, headers=auth(parent_token))
    check("linked parent can now read the child", r.status_code == 200, r.text[:200])
    guardians = client.get("/api/auth/guardians", headers=auth(student_token)).json()
    check("student sees who is linked", len(guardians) >= 1)
    gid = guardians[0]["guardianship_id"]
    r = client.patch(
        f"/api/auth/guardians/{gid}/transcripts",
        json={"share_transcripts": True},
        headers=auth(student_token),
    )
    check("student can open transcript sharing", r.status_code == 200 and r.json()["can_see_transcripts"])
    r = client.patch(
        f"/api/auth/guardians/{gid}/transcripts",
        json={"share_transcripts": False},
        headers=auth(parent_token),
    )
    check("a parent cannot open their own access", r.status_code in (403, 404), r.text[:200])
    r = client.delete("/api/auth/share-code", headers=auth(student_token))
    check("student can switch the code off", r.status_code == 200 and r.json()["code"] is None)

    section("Transcript deletion")
    r = client.post(f"/api/conversations/{session_id}/clear", headers=auth(student_token))
    check("transcript cleared", r.status_code == 204)
    r = client.get(f"/api/conversations/{session_id}/messages", headers=auth(student_token))
    check("messages really gone", r.status_code == 200 and len(r.json()) == 0, str(r.json())[:120])

    section("Settings and accessibility")
    r = client.patch(
        "/api/auth/settings",
        json={"reduced_motion": True, "high_contrast": True, "language": "hi"},
        headers=auth(student_token),
    )
    check("settings saved", r.status_code == 200, r.text[:200])
    check("accessibility flags persisted", r.json()["reduced_motion"] is True and r.json()["language"] == "hi")
    latest = client.get("/api/reports/latest", headers=auth(student_token)).json()
    r = client.delete(f"/api/reports/{latest['id']}", headers=auth(student_token))
    check("report can be deleted", r.status_code == 204, r.text[:200])
    r = client.post("/api/auth/logout", headers=auth(student_token))
    check("logout succeeds", r.status_code == 204)
    r = client.get("/api/auth/me", headers=auth(student_token))
    check("token invalid after logout", r.status_code == 401, r.text[:120])

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("\nFAILED CHECKS:")
    for name in FAIL:
        print("  -", name)
sys.exit(1 if FAIL else 0)
