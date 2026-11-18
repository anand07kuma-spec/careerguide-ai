"""The chat and voice pipeline, end to end, with both outside services faked.

The product claim this suite protects:

* ten turns in one conversation all come from the configured provider,
* a voice turn gets that same answer read aloud — never an older or generic one,
* a provider failure is a retryable 503, not a scripted sentence in the model's
  voice,
* the reply is no longer held behind text-to-speech synthesis,
* conversation history survives every turn.

Every number printed at the end is measured here, on this machine, against a
provider stub with a fixed delay and a speech stub with a fixed delay. Nothing
leaves 127.0.0.1 and no real credential is used.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/chat_pipeline_test.py
"""

from __future__ import annotations

import asyncio
import json
import os
import pathlib
import statistics
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_chat_pipeline_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()

AI_DELAY = 0.12
TTS_DELAY = 0.25

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "openai"
os.environ["AI_API_KEY"] = "pipeline-stub-key-never-real"
os.environ["AI_MODEL"] = "stub-model"
os.environ["AI_BASE_URL"] = "http://127.0.0.1:1/v1"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["GEMINI_API_KEY"] = ""
os.environ["AZURE_SPEECH_KEY"] = ""

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n=== {title}")


calls: list[dict] = []
state: dict = {"mode": "ok"}


class StubProvider(BaseHTTPRequestHandler):
    """Answers like a chat model, echoing the question so a stale reply is visible."""

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        calls.append({"body": json.loads(body)})
        time.sleep(AI_DELAY)
        if state["mode"] == "error":
            payload = b'{"error": "upstream is down"}'
            self.send_response(503)
        else:
            messages = calls[-1]["body"]["messages"]
            last_user = next(
                (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
            )
            answer = f"You said: {last_user[:60]}. What did you enjoy most about it?"
            payload = json.dumps(
                {"choices": [{"message": {"role": "assistant", "content": answer}}]}
            ).encode()
            self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


class QuietServer(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        pass


stub = QuietServer(("127.0.0.1", 0), StubProvider)
threading.Thread(target=stub.serve_forever, daemon=True).start()
os.environ["AI_BASE_URL"] = f"http://127.0.0.1:{stub.server_address[1]}/v1"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ConversationSession  # noqa: E402
from app.services import profile_facts, tts  # noqa: E402
from app.services.recommender import build_recommendations  # noqa: E402

TTS_SEEN: list[str] = []


async def fake_synthesize(text: str, language: str = "en", voice: str | None = None) -> str:
    await asyncio.sleep(TTS_DELAY)
    TTS_SEEN.append(text)
    return "data:audio/wav;base64,UklGRiQAAABXQVZF"


tts.synthesize = fake_synthesize  # type: ignore[assignment]


def ms(value: float) -> int:
    return round(value * 1000)


with TestClient(app) as client:
    signup = client.post(
        "/api/auth/onboarding",
        json={
            "role": "student",
            "display_name": "Meera",
            "preferred_language": "en",
            "consent_profile": True,
            "consent_age": "9-10",
            "consent_voice": True,
        },
    )
    assert signup.status_code == 200, signup.text[:300]
    headers = {"Authorization": f"Bearer {signup.json()['token']}"}
    student_id = signup.json()["user"]["id"]
    started = client.post("/api/conversations", json={"kind": "voice"}, headers=headers)
    assert started.status_code == 201, started.text[:300]
    session_id = started.json()["id"]

    def send(text: str):
        return client.post(
            f"/api/conversations/{session_id}/messages",
            # `speak` is still sent, because a cached screen from before this change
            # still does. It must no longer make the request wait for speech.
            json={"message": text, "speak": True},
            headers=headers,
        )

    def speak_answer(answer: dict) -> tuple[dict, float]:
        began = time.perf_counter()
        response = client.post(
            "/api/voice/speak",
            json={"text": answer["reply"]["content"], "language": answer["language"]},
            headers=headers,
        )
        elapsed = time.perf_counter() - began
        assert response.status_code == 200, response.text[:300]
        return response.json(), elapsed

    warm = send("warm-up: I like drawing comics")
    assert warm.status_code == 200, warm.text[:300]

    section("1. ten voice turns, each from the real provider")
    message_ms: list[float] = []
    speak_ms: list[float] = []
    replies: list[dict] = []
    for turn in range(1, 11):
        began = time.perf_counter()
        response = send(f"turn {turn}: I enjoy drawing comics and building things")
        message_ms.append(time.perf_counter() - began)
        assert response.status_code == 200, response.text[:400]
        answer = response.json()
        replies.append(answer)

        check(
            f"turn {turn}: the provider wrote the reply",
            answer["provider"] == "openai" and answer["reply"]["demo_generated"] is False,
            answer.get("provider"),
        )
        check(f"turn {turn}: the reply belongs to this turn",
              f"turn {turn}:" in answer["reply"]["content"], answer["reply"]["content"][:60])
        check(f"turn {turn}: nothing waited for speech inside the reply",
              answer.get("audio_url") is None, answer.get("audio_url"))

        audio, elapsed = speak_answer(answer)
        speak_ms.append(elapsed)
        check(f"turn {turn}: the voice is made on request",
              audio["audio_url"].startswith("data:audio/wav"), audio["audio_url"][:30])
        check(f"turn {turn}: it reads this turn's answer, not an older one",
              TTS_SEEN[-1] == answer["reply"]["content"], TTS_SEEN[-1][:60])

    check("every turn called the provider exactly once",
          len(calls) == 11, len(calls))  # warm-up plus ten

    section("2. the conversation keeps its context")
    tenth_request = calls[-1]["body"]["messages"]
    check("the tenth turn still carries the first turn's words",
          any("turn 1:" in m["content"] for m in tenth_request if m["role"] == "user"),
          [m["content"][:40] for m in tenth_request[-4:]])
    check("all ten earlier answers are still in the thread",
          sum(1 for m in tenth_request if m["role"] == "assistant") == 10,
          sum(1 for m in tenth_request if m["role"] == "assistant"))
    stored = client.get(f"/api/conversations/{session_id}/messages", headers=headers).json()
    check("the greeting, every question and every answer are stored",
          len(stored) == 23, len(stored))  # greeting, warm-up, ten turns

    section("3. a provider failure is a retry, not a scripted answer")
    state["mode"] = "error"
    before = len(stored)
    failed = send("this turn should be retryable")
    check("the turn answers 503", failed.status_code == 503, failed.status_code)
    check("…with a sentence that offers a retry",
          "again" in failed.json().get("detail", "").lower(), failed.json().get("detail"))
    check("…and no reply body at all", "reply" not in failed.json(), str(failed.json())[:120])
    after = client.get(f"/api/conversations/{session_id}/messages", headers=headers).json()
    check("…and the transcript is untouched", len(after) == before, (before, len(after)))

    state["mode"] = "ok"
    recovered = send("I am ready to try again")
    check("the retry succeeds on the real provider",
          recovered.status_code == 200
          and recovered.json()["provider"] == "openai"
          and recovered.json()["reply"]["demo_generated"] is False,
          recovered.status_code)

    section("4. demo mode is a configuration, not a failure")
    # The replies above were produced while a provider was configured. Demo has its
    # own switch and its own label; nothing in the ten turns reached for it.
    check("no turn in this conversation is labelled demo",
          all(r["reply"]["demo_generated"] is False for r in replies))

    section("5. where the milliseconds go")
    db = SessionLocal()
    try:
        session = db.get(ConversationSession, session_id)
        began = time.perf_counter()
        history = list(session.messages)
        history_ms = ms(time.perf_counter() - began)
        began = time.perf_counter()
        build_recommendations(db, student_id, limit=3)
        recommendations_ms = ms(time.perf_counter() - began)
        began = time.perf_counter()
        profile_facts.asked_keys(history)
        asked_ms = ms(time.perf_counter() - began)
    finally:
        db.close()

    report = {
        "ai_stub_delay_ms": ms(AI_DELAY),
        "tts_stub_delay_ms": ms(TTS_DELAY),
        "reply_median_ms": ms(statistics.median(message_ms)),
        "reply_max_ms": ms(max(message_ms)),
        "voice_median_ms": ms(statistics.median(speak_ms)),
        "history_load_ms": history_ms,
        "recommendations_ms": recommendations_ms,
        "asked_facts_scan_ms": asked_ms,
    }
    print(json.dumps(report, indent=2))
    check("the reply no longer waits for the speech delay",
          report["reply_median_ms"] < report["tts_stub_delay_ms"] + 120,
          (report["reply_median_ms"], report["tts_stub_delay_ms"]))
    check("the speech request is where the speech delay lives",
          report["voice_median_ms"] >= report["tts_stub_delay_ms"],
          (report["voice_median_ms"], report["tts_stub_delay_ms"]))
    check("the provider call is the reply's dominant cost",
          report["reply_median_ms"] >= report["ai_stub_delay_ms"],
          (report["reply_median_ms"], report["ai_stub_delay_ms"]))

stub.shutdown()
stub.server_close()

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + ", ".join(FAIL))
    sys.exit(1)
