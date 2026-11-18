"""Prove the chat guide uses the configured model, and says so when it does not.

The product claim is narrow: when a real provider is configured, the student's
reply comes from it, and when it is not — missing key, missing model, unreachable,
slow, empty, or a malformed body — the reply comes from the built-in guide and the
response says which. The failure this suite is written against is the quiet one: a
scripted sentence shown as if a model wrote it, or a key that leaks into a response.

Every provider call is served by a stub on 127.0.0.1, so no paid API is contacted
and no real credential is needed. The timeout check is short (one second) because
the point is which branch runs, not how long a real model takes.

Runs against a throwaway database, never `careerguide.db`.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/ai_provider_test.py
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_ai_provider_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py

from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402

PASS, FAIL = [], []

# A value with the shape of a key and a marker nothing else contains, so "was it sent?"
# and "was it returned?" are both answerable by a substring search.
KEY = "stub-key-must-never-reach-the-browser"
REPLY = "That sounds fun. What did you enjoy most about it?"


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n=== {title}")


calls: list[dict] = []
state: dict = {"mode": "ok", "reply": REPLY, "delay": 0.0}


class StubProvider(BaseHTTPRequestHandler):
    """One OpenAI-compatible endpoint whose answer the checks below choose."""

    def do_POST(self):  # noqa: N802
        mode, reply, delay = state["mode"], state["reply"], state["delay"]
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        calls.append(
            {
                "path": self.path,
                "auth": self.headers.get("Authorization", ""),
                "body": json.loads(body),
                "raw": body.decode("utf-8", "replace"),
            }
        )
        if delay:
            time.sleep(delay)
        retry_after = None
        if mode == "error":
            payload = b'{"error": "upstream is having a bad day"}'
            self.send_response(500)
        elif mode == "ratelimit_once" and state.get("hits", 0) == 0:
            # The provider's first "not now", then a normal answer: the retry this
            # suite checks for is one stretch of patience, not a loop.
            state["hits"] = 1
            payload = b'{"error": "slow down"}'
            self.send_response(429)
            retry_after = "0"
        elif mode == "empty":
            payload = b'{"choices": [{"message": {"role": "assistant", "content": ""}}]}'
            self.send_response(200)
        elif mode == "malformed":
            payload = b'{"unexpected": true}'
            self.send_response(200)
        else:
            payload = json.dumps(
                {"choices": [{"message": {"role": "assistant", "content": reply}}]}
            ).encode()
            self.send_response(200)
        self.send_header("Content-Type", "application/json")
        if retry_after is not None:
            self.send_header("Retry-After", retry_after)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


class QuietServer(ThreadingHTTPServer):
    """A timed-out client leaves the stub writing to a closed socket; that is the
    point of the check, not a failure worth a traceback."""

    daemon_threads = True

    def handle_error(self, request, client_address):
        pass


stub = QuietServer(("127.0.0.1", 0), StubProvider)
threading.Thread(target=stub.serve_forever, daemon=True).start()
BASE_URL = f"http://127.0.0.1:{stub.server_address[1]}/v1"

settings = get_settings()


def configure(**values) -> None:
    """Point the app at one provider setup for the next check.

    `mode` is not a setting: it is what the stub should answer with, so it is
    separated from the values written onto the settings object.
    """
    base = {
        "ai_provider": "openai",
        "ai_api_key": KEY,
        "ai_model": "stub-model",
        "ai_base_url": BASE_URL,
        "ai_timeout_seconds": 5,
    }
    base.update(values)
    mode = base.pop("mode", "ok")
    for name, value in base.items():
        setattr(settings, name, value)
    state.update(mode=mode, reply=REPLY, delay=0.0, hits=0)


def reset() -> None:
    configure(ai_provider="demo", ai_api_key="", ai_model="")


try:
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
        assert signup.status_code == 200, signup.text[:300]
        headers = {"Authorization": f"Bearer {signup.json()['token']}"}
        started = client.post("/api/conversations", json={"kind": "chat"}, headers=headers)
        assert started.status_code == 201, started.text[:300]
        session_id = started.json()["id"]

        def say(text: str) -> tuple[dict, str]:
            response = client.post(
                f"/api/conversations/{session_id}/messages",
                json={"message": text},
                headers=headers,
            )
            assert response.status_code == 200, response.text[:400]
            return response.json(), response.text

        def attempt(text: str):
            return client.post(
                f"/api/conversations/{session_id}/messages",
                json={"message": text},
                headers=headers,
            )

        def stored_messages() -> list[dict]:
            response = client.get(f"/api/conversations/{session_id}/messages", headers=headers)
            assert response.status_code == 200, response.text[:200]
            return response.json()

        section("0. a provider needs a name, a key and a model")
        reset()
        check("demo mode is what an unconfigured app reports",
              settings.ai_configured is False and client.get("/api/health").json()["demo_mode"] is True)
        configure(ai_api_key="", ai_model="stub-model")
        check("a provider with no key is not configured", settings.ai_configured is False)
        configure(ai_api_key=KEY, ai_model="")
        check("a key with no model is not configured either", settings.ai_configured is False)
        check("…so health still says demo mode, not a broken AI",
              client.get("/api/health").json()["demo_mode"] is True)
        configure()
        check("name, key and model together count as configured", settings.ai_configured is True)
        check("…and health stops claiming demo mode",
              client.get("/api/health").json()["demo_mode"] is False)

        section("1. a configured provider writes the reply")
        configure()
        before = len(calls)
        answer, raw = say("I like drawing comics after school")
        check("the reply is the model's own sentence", answer["reply"]["content"] == REPLY, answer)
        check("…not labelled demo", answer["reply"]["demo_generated"] is False, answer["reply"])
        check("…and the provider is named honestly",
              answer["provider"] == "openai" and answer["error"] is None, answer)
        check("exactly one provider call was made", len(calls) == before + 1, len(calls) - before)
        sent = calls[-1]
        check("the call goes to the base URL's /chat/completions",
              sent["path"].endswith("/chat/completions"), sent["path"])
        check("the model the app was told to use is the one asked for",
              sent["body"].get("model") == "stub-model", sent["body"].get("model"))
        check("the completion budget leaves room for a reasoning model",
              sent["body"].get("max_tokens", 0) >= 1024, sent["body"].get("max_tokens"))
        check("the key travels only as a bearer header",
              sent["auth"] == f"Bearer {KEY}" and KEY not in sent["raw"], sent["auth"])
        check("the reply itself carries no key", KEY not in raw, raw[:200])
        system = sent["body"]["messages"][0]
        check("a system prompt opens the call", system["role"] == "system", system["role"])
        check("…carrying the guide's rules",
              "Ask exactly one question" in system["content"]
              and "Never use markdown" in system["content"], system["content"][:160])
        check("…and the student's own name, not a form field",
              "Riya" in system["content"], system["content"][:160])
        check("the student's words are the last thing sent",
              sent["body"]["messages"][-1] == {"role": "user", "content": "I like drawing comics after school"},
              sent["body"]["messages"][-1])

        section("2. the model's turn is followed by the thread it answered")
        configure()
        answer, _ = say("The parts where the hero makes a mistake")
        history = [m["content"] for m in calls[-1]["body"]["messages"]]
        check("the earlier answer is sent back as context", REPLY in history, history[:4])
        check("assistant and user roles are kept",
              [m["role"] for m in calls[-1]["body"]["messages"]][-3:] == ["user", "assistant", "user"],
              [m["role"] for m in calls[-1]["body"]["messages"]])
        check("a real reply is still a real reply", answer["reply"]["demo_generated"] is False, answer)

        section("3. an unconfigured app is demo mode, not a failed AI")
        for label, values in (
            ("no key", {"ai_api_key": ""}),
            ("no model", {"ai_model": ""}),
            ("provider still demo", {"ai_provider": "demo"}),
        ):
            configure(**values)
            before = len(calls)
            answer, raw = say("What should I try next?")
            check(f"{label}: the built-in guide answers", answer["provider"] == "demo", answer["provider"])
            check(f"{label}: labelled demo", answer["reply"]["demo_generated"] is True, answer["reply"])
            check(f"{label}: no failure is claimed", answer["error"] is None, answer["error"])
            check(f"{label}: no provider is contacted", len(calls) == before, len(calls) - before)
            check(f"{label}: no key in the response", KEY not in raw, raw[:160])

        section("4. a provider failure is a retry, never a scripted reply")
        for label, values, expected_calls in (
            # The 500 is retried once before the turn is given up on.
            ("HTTP 500", {"mode": "error"}, 2),
            ("an empty completion", {"mode": "empty"}, 1),
            ("a body with no choices", {"mode": "malformed"}, 1),
            ("a blank base URL", {"ai_base_url": ""}, 0),
        ):
            configure(**values)
            before = len(calls)
            before_history = stored_messages()
            response = attempt("I want to ask about the plan")
            body = response.json()
            check(f"{label}: the turn fails as a retryable error",
                  response.status_code == 503, response.status_code)
            check(f"{label}: …and says it can be sent again",
                  "again" in str(body.get("detail", "")).lower(), body.get("detail"))
            check(f"{label}: no scripted answer is returned",
                  "reply" not in body, str(body)[:160])
            check(f"{label}: nothing is written to the transcript",
                  stored_messages() == before_history, len(stored_messages()))
            check(f"{label}: the call count matches", len(calls) - before == expected_calls,
                  len(calls) - before)
            check(f"{label}: the key is still not in the response", KEY not in response.text,
                  response.text[:160])

        section("4b. one 429 is survived without the student seeing it")
        configure(mode="ratelimit_once")
        before = len(calls)
        answer, raw = say("I want to ask about the plan")
        check("a single throttle is retried", len(calls) - before == 2, len(calls) - before)
        check("…and the model's own reply arrives", answer["reply"]["content"] == REPLY, answer)
        check("…unlabelled as demo", answer["reply"]["demo_generated"] is False, answer["reply"])
        check("…and no key leaks", KEY not in raw, raw[:160])

        section("5. a slow provider is a retry, not a blank screen")
        configure(ai_timeout_seconds=1)
        state.update(mode="ok", delay=2.0)
        before_history = stored_messages()
        response = attempt("Which subject should I focus on?")
        body = response.json()
        check("the timeout branch answers 503", response.status_code == 503, response.status_code)
        check("…saying it took too long",
              "took too long" in str(body.get("detail", "")), body.get("detail"))
        check("…no scripted reply is passed off as the model",
              "reply" not in body, str(body)[:160])
        check("…and the transcript is unchanged", stored_messages() == before_history)
        check("…and no key leaks", KEY not in response.text, response.text[:160])

        section("5b. ten consecutive turns stay on the real provider")
        configure()
        started_again = client.post(
            "/api/conversations", json={"kind": "chat"}, headers=headers
        )
        assert started_again.status_code == 201, started_again.text[:300]
        long_id = started_again.json()["id"]

        def long_say(text: str) -> dict:
            response = client.post(
                f"/api/conversations/{long_id}/messages",
                json={"message": text},
                headers=headers,
            )
            assert response.status_code == 200, response.text[:400]
            return response.json()

        first_words = "turn one: I like drawing comics after school"
        replies = [long_say(first_words)]
        for index in range(2, 11):
            replies.append(long_say(f"turn {index}: I also enjoy building things"))
        check("ten turns all come from the configured provider",
              all(r["provider"] == "openai" for r in replies),
              sorted({r["provider"] for r in replies}))
        check("…and none of them is labelled demo",
              all(r["reply"]["demo_generated"] is False for r in replies),
              [r["reply"]["demo_generated"] for r in replies])
        tenth = calls[-1]["body"]["messages"]
        check("the tenth turn still carries how the conversation began",
              any(first_words in m["content"] for m in tenth if m["role"] == "user"),
              [m["content"][:40] for m in tenth[-4:]])
        stored = client.get(
            f"/api/conversations/{long_id}/messages", headers=headers
        ).json()
        check("all twenty-one messages (greeting, ten of each role) are stored",
              len(stored) == 21, len(stored))

        section("6. a disclosure of harm is never sent to a model")
        configure()
        before = len(calls)
        answer, raw = say("my uncle hits me at home and I am scared")
        check("the reviewed safety reply is used",
              answer["needs_support"] is True and "Childline" in answer["reply"]["content"], answer)
        check("…from the built-in guide, labelled demo", answer["reply"]["demo_generated"] is True, answer["reply"])
        check("…and nothing was sent to the provider", len(calls) == before, len(calls) - before)
        check("…nor the key returned", KEY not in raw, raw[:160])

        section("7. what the student's own browser can read back")
        reset()
        answer, _ = say("hello again")
        stored = client.get(f"/api/conversations/{session_id}/messages", headers=headers)
        check("the history route answers", stored.status_code == 200, stored.text[:200])
        messages = stored.json()
        check("demo replies stay labelled in the stored thread",
              messages[-1]["role"] == "assistant" and messages[-1]["demo_generated"] is True,
              messages[-1] if messages else [])
        check("no key is stored in a message",
              all(KEY not in message["content"] for message in messages), messages[-1:])
        response, raw = say("and what about next week?")
        check("a demo-mode turn carries no error", response["error"] is None, response["error"])

finally:
    reset()
    stub.shutdown()
    stub.server_close()

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + ", ".join(FAIL))
    sys.exit(1)
