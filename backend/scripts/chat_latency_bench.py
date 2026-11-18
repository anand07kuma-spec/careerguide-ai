"""Measure where a chat turn's seconds actually go.

Runs the real FastAPI app against a local OpenAI-compatible stub and a stubbed
speech service, each with a fixed delay, so every number below is the app's own
work plus a delay this script chose. It is deliberately written against the
public endpoints only, so the same file runs on the old code and the new code and
the two tables can be compared.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/chat_latency_bench.py

Nothing leaves the machine: the provider is 127.0.0.1 and TTS is monkeypatched.
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

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_latency_bench.db"
if DB_PATH.exists():
    DB_PATH.unlink()

AI_DELAY = float(os.environ.get("BENCH_AI_DELAY_MS", "300")) / 1000
TTS_DELAY = float(os.environ.get("BENCH_TTS_DELAY_MS", "600")) / 1000
REPLY = "That sounds fun. What did you enjoy most about it?"

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "openai"
os.environ["AI_API_KEY"] = "bench-key-never-real"
os.environ["AI_MODEL"] = "bench-model"
os.environ["AI_BASE_URL"] = "http://127.0.0.1:1/v1"  # replaced below once the port exists
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["GEMINI_API_KEY"] = ""
os.environ["AZURE_SPEECH_KEY"] = ""


class StubProvider(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", 0))
        self.rfile.read(length)
        time.sleep(AI_DELAY)
        payload = json.dumps(
            {"choices": [{"message": {"role": "assistant", "content": REPLY}}]}
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

TTS_TEXT: list[str] = []


async def fake_synthesize(text: str, language: str = "en", voice: str | None = None) -> str:
    await asyncio.sleep(TTS_DELAY)
    TTS_TEXT.append(text)
    return "data:audio/wav;base64,UklGRiQAAABXQVZF"


tts.synthesize = fake_synthesize  # type: ignore[assignment]


def ms(seconds: float) -> int:
    return round(seconds * 1000)


def timed(fn) -> float:
    started = time.perf_counter()
    fn()
    return time.perf_counter() - started


with TestClient(app) as client:
    signup = client.post(
        "/api/auth/onboarding",
        json={
            "role": "student",
            "display_name": "Bench",
            "preferred_language": "en",
            "consent_profile": True,
            "consent_age": "9-10",
        },
    )
    signup.raise_for_status()
    headers = {"Authorization": f"Bearer {signup.json()['token']}"}
    student_id = signup.json()["user"]["id"]
    started = client.post("/api/conversations", json={"kind": "chat"}, headers=headers)
    started.raise_for_status()
    session_id = started.json()["id"]

    def say(text: str) -> dict:
        response = client.post(
            f"/api/conversations/{session_id}/messages",
            json={"message": text, "speak": True},
            headers=headers,
        )
        response.raise_for_status()
        return response.json()

    say("warm up the connection and the database")  # not measured

    if os.environ.get("BENCH_PROFILE") == "1":
        import cProfile
        import pstats

        profiler = cProfile.Profile()
        profiler.enable()
        say("profile this turn")
        profiler.disable()
        pstats.Stats(profiler).sort_stats("cumulative").print_stats(18)

    turns: list[dict] = []
    for index in range(3):
        began = time.perf_counter()
        answer = say(f"Benchmark turn {index}: I like drawing comics after school")
        message_seconds = time.perf_counter() - began

        began = time.perf_counter()
        spoken = client.post(
            "/api/voice/speak",
            json={"text": answer["reply"]["content"], "language": "en"},
            headers=headers,
        )
        speak_seconds = time.perf_counter() - began
        spoken.raise_for_status()

        turns.append(
            {
                "message_ms": ms(message_seconds),
                "inline_audio_ms": ms(message_seconds) if answer.get("audio_url") else 0,
                "separate_speak_ms": ms(speak_seconds),
            }
        )

    db = SessionLocal()
    try:
        session = db.get(ConversationSession, session_id)
        history_seconds = timed(lambda: list(session.messages))
        recommendations_seconds = timed(lambda: build_recommendations(db, student_id, limit=3))
        history = list(session.messages)
        asked_seconds = timed(lambda: profile_facts.asked_keys(history))
    finally:
        db.close()

print(
    json.dumps(
        {
            "provider_delay_ms": ms(AI_DELAY),
            "tts_delay_ms": ms(TTS_DELAY),
            "turns": turns,
            "turns_median_message_ms": statistics.median(t["message_ms"] for t in turns),
            "turns_median_separate_speak_ms": statistics.median(
                t["separate_speak_ms"] for t in turns
            ),
            "inline_audio_in_message": any(t["inline_audio_ms"] for t in turns),
            "stage_ms": {
                "history_load": ms(history_seconds),
                "recommendations": ms(recommendations_seconds),
                "asked_facts_scan": ms(asked_seconds),
            },
        },
        indent=2,
    )
)

stub.shutdown()
stub.server_close()
