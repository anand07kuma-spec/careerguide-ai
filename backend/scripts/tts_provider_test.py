"""Test the text-to-speech layer without calling a paid service.

A TTS key turns the app's voice replies from "browser's own voice" into real
recorded speech, and a wrong setup here is invisible unless it is checked: a
missing region, a key that does not match its region, markup leaking into the
SSML, or a credential ending up in a log line all look like plain silence to a
student. So every request below is intercepted and inspected instead of sent.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/tts_provider_test.py

One live check runs only when this shell really has AZURE_SPEECH_KEY and
AZURE_SPEECH_REGION set; otherwise it reports itself as skipped.
"""

from __future__ import annotations

import asyncio
import base64
import os
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Never let an import of the app touch the real database file.
TEST_DB = pathlib.Path(tempfile.gettempdir()) / "careerguide_tts_test.db"
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"

from app.config import Settings  # noqa: E402
from app.services import tts  # noqa: E402

PASS, FAIL = [], []
KEY = "azure-key-that-must-never-be-logged"
# Grabbed before any test replaces it, so the optional live call is a real call.
REAL_CLIENT = tts.httpx.AsyncClient


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


def configure(**values) -> None:
    """Point the TTS service at one settings object for the next checks."""
    base = {
        "tts_provider": "auto",
        "azure_speech_key": "",
        "azure_speech_region": "",
        "tts_voice_hi": "hi-IN-SwaraNeural",
        "tts_voice_en": "en-IN-NeerjaNeural",
        "tts_timeout_seconds": 25,
    }
    base.update(values)
    settings = Settings(**base)
    tts.get_settings = lambda: settings


class Response:
    def __init__(self, status_code: int = 200, content: bytes = b"MP3DATA") -> None:
        self.status_code = status_code
        self.content = content

    @property
    def text(self) -> str:
        return self.content.decode("utf-8", "replace")


class Sent:
    """What the fake transport captured, so tests can inspect the real request."""

    def __init__(self) -> None:
        self.url = ""
        self.headers: dict[str, str] = {}
        self.body = b""
        self.reply: Response | None = None
        self.error: Exception | None = None


sent = Sent()


def install_transport(*, reply: Response | None = None, error: Exception | None = None) -> None:
    sent.url, sent.headers, sent.body = "", {}, b""
    sent.reply, sent.error = reply, error

    class FakeClient:
        def __init__(self, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc) -> bool:
            return False

        async def post(self, url, headers=None, content=None):
            sent.url, sent.headers, sent.body = url, dict(headers or {}), content or b""
            if sent.error:
                raise sent.error
            return sent.reply

    tts.httpx.AsyncClient = FakeClient


def run(coro):
    return asyncio.run(coro)


print("\n--- which service gets called ---")
configure()
check("no key: falls back to the free Edge endpoint", tts.provider() == tts.EDGE, tts.provider())
configure(azure_speech_key=KEY, azure_speech_region="eastus")
check("key + region: switches to Azure on its own", tts.provider() == tts.AZURE, tts.provider())
configure(tts_provider="edge", azure_speech_key=KEY, azure_speech_region="eastus")
check("TTS_PROVIDER=edge is honoured even with a key", tts.provider() == tts.EDGE, tts.provider())
configure(tts_provider="azure")
check("TTS_PROVIDER=azure without a key stays visible", tts.provider() == tts.AZURE)
try:
    run(tts.synthesize("hello", "en"))
    check("a forced-but-keyless Azure speaks loudly", False, "no error raised")
except tts.TTSError as exc:
    check(
        "a forced-but-keyless Azure names the missing variable",
        "AZURE_SPEECH_KEY" in str(exc),
        str(exc),
    )

print("\n--- the request that is built ---")
configure(azure_speech_key=KEY, azure_speech_region="East US")
check(
    "the region is the one the key belongs to",
    tts.azure_url() == "https://eastus.tts.speech.microsoft.com/cognitiveservices/v1",
    tts.azure_url(),
)
configure(azure_speech_key=KEY, azure_speech_region="Central India")
check("the portal's display name for a region works too",
      tts.azure_url().startswith("https://centralindia.tts.speech.microsoft.com/"), tts.azure_url())
configure(azure_speech_key=KEY, azure_speech_region="East US")
ssml = tts.build_ssml("Class 8? ठीक है & <b>bold</b> itna", "hi-IN-SwaraNeural")
check("markup in a reply cannot inject SSML", "<b>" not in ssml and "Class 8" in ssml, ssml)
check("an ampersand is escaped, or the request would be invalid XML", "&amp;" in ssml, ssml)
check("angle brackets become entities", "&lt;b&gt;" in ssml, ssml)
check("the Devanagari text is sent as-is", "ठीक" in ssml, ssml)
check("the locale comes from the voice", "xml:lang='hi-IN'" in ssml, ssml)
check("markdown the guide produced is not read out", tts.plain_text("# a *b* `c`") == "a b c",
      tts.plain_text("# a *b* `c`"))
check("a long reply is cut for listening, not truncated mid-word by the caller",
      len(tts.plain_text("x" * 1500)) == 1200)

install_transport(reply=Response())
url = run(tts.synthesize(" mujhe engineer बनना hai ", "hinglish"))
check("audio comes back playable in the reply",
      url == "data:audio/mpeg;base64," + base64.b64encode(b"MP3DATA").decode(), url[:40])
check("the key travels as a header, not in the URL",
      sent.headers.get("Ocp-Apim-Subscription-Key") == KEY and KEY not in sent.url, sent.url)
check("the key is not inside the spoken text", KEY not in sent.body.decode("utf-8", "replace"))
check("mp3 is what the browser is promised",
      sent.headers.get("X-Microsoft-OutputFormat") == "audio-24khz-48kbitrate-mono-mp3",
      sent.headers)
check("SSML is the content type", sent.headers.get("Content-Type") == "application/ssml+xml")
check("the default Indian English voice is used for hinglish",
      "en-IN-NeerjaNeural" in sent.body.decode(), sent.body[:160])

print("\n--- when the service answers badly ---")
install_transport(reply=Response(status_code=401, content=b'{"error":"key not found"}'))
try:
    run(tts.synthesize("hello", "en"))
    check("a rejected key is an error, not silence", False, "returned audio")
except tts.TTSError as exc:
    check("a rejected key tells the student audio is unavailable", "unavailable" in str(exc), str(exc))
    check("a rejected key does not repeat the reply text", "hello" not in str(exc), str(exc))
    check("a rejected key does not mention the credential", KEY not in str(exc))

install_transport(reply=Response(content=b""))
try:
    run(tts.synthesize("hello", "en"))
    check("an empty answer is refused", False, "returned audio")
except tts.TTSError as exc:
    check("an empty answer says there was no audio", "no audio" in str(exc), str(exc))

import httpx  # noqa: E402

install_transport(error=httpx.ConnectTimeout("failed to establish a new connection"))
try:
    run(tts.synthesize("hello", "en"))
    check("a timeout is reported", False, "no error")
except tts.TTSError as exc:
    check("a timeout tells the student to read or retry", "too long" in str(exc) or "try again" in str(exc), str(exc))

configure(azure_speech_key="", azure_speech_region="")
install_transport(reply=Response())
try:
    run(tts.synthesize("   ", "en"))
    check("nothing is sent for an empty reply", False, "sent anyway")
except tts.TTSError as exc:
    check("nothing is sent for an empty reply", "nothing to read out" in str(exc), str(exc))
check("an empty reply never reached the transport", sent.url == "")

print("\n--- voices and the note the student reads ---")
configure(azure_speech_key=KEY, azure_speech_region="eastus")
check("Hindi uses the Hindi voice", tts.voice_for("hi") == "hi-IN-SwaraNeural")
check("an unknown voice id cannot replace a known one",
      tts.voice_for("hi", "not-a-voice") == "hi-IN-SwaraNeural")
check("a known voice id can be chosen", tts.voice_for("hi", "hi-IN-MadhurNeural") == "hi-IN-MadhurNeural")
check("Azure's note says the text goes to Microsoft",
      "Azure" in tts.provider_note() and "sent to Microsoft" in tts.provider_note(),
      tts.provider_note())
configure()
check("Edge's note names the service it uses", "Edge TTS" in tts.provider_note())

print("\n--- what /api/health reports ---")
from app import main as app_main  # noqa: E402
from app.schemas import TTSIn  # noqa: E402

configure(azure_speech_key=KEY, azure_speech_region="eastus")
body = app_main.health()
check("health reports the service that will be called",
      body.tts_provider == tts.AZURE, body)
check("health says the voice is ready once a key exists", body.tts_ready is True, body)
configure(tts_provider="azure")
body = app_main.health()
check("health does not call a keyless Azure ready", body.tts_ready is False, body)
configure()
body = app_main.health()
check("health reports Edge when there is no key",
      body.tts_provider == tts.EDGE and body.tts_ready is True, body)

print("\n--- a long guide reply is shortened, not rejected ---")
long_reply = "karim " * 900  # longer than anything that is comfortable to listen to
try:
    accepted = TTSIn(text=long_reply, language="en")
    check("a long reply is accepted by the endpoint", len(accepted.text) > 4000,
          len(accepted.text))
except Exception as exc:  # noqa: BLE001
    check("a long reply is accepted by the endpoint", False, repr(exc))
check("only the first part of it is spoken",
      len(tts.plain_text(long_reply)) == tts.MAX_SPOKEN_CHARS,
      tts.MAX_SPOKEN_CHARS)

print("\n--- the Edge path still works ---")


class FakeCommunicate:
    def __init__(self, text: str, voice: str) -> None:
        self.text, self.voice = text, voice

    async def stream(self):
        yield {"type": "audio", "data": b"EDGE"}
        yield {"type": "WordBoundary", "data": b""}


tts.edge_tts.Communicate = FakeCommunicate
audio = run(tts.synthesize_bytes("hello", "en"))
check("Edge audio still returns bytes", audio == b"EDGE", audio)

print("\n--- what the last real call actually said ---")
attempt = tts.last_attempt()
check("a call that produced audio is remembered as working",
      attempt["ok"] is True and attempt["provider"] == tts.EDGE, attempt)
check("health carries that verdict next to the config flag",
      app_main.health().tts_last_attempt.ok is True, app_main.health().tts_last_attempt)


class SilentCommunicate:
    """The shape Edge TTS returns when its endpoint refuses this server."""

    def __init__(self, text: str, voice: str) -> None:
        self.text, self.voice = text, voice

    async def stream(self):
        for _ in ():
            yield _


tts.edge_tts.Communicate = SilentCommunicate
try:
    run(tts.synthesize_bytes("hello", "en"))
    check("a call that returns no audio fails", False, "returned audio")
except tts.TTSError:
    pass
attempt = tts.last_attempt()
check("a failed call is remembered as failed", attempt["ok"] is False, attempt)
check("and the verdict names the provider that failed",
      attempt["provider"] == tts.EDGE, attempt)
check("the spoken text is not kept in the verdict", "hello" not in str(attempt["reason"]),
      attempt["reason"])
check("health still reports the configuration as ready",
      app_main.health().tts_ready is True and app_main.health().tts_last_attempt.ok is False)

tts.edge_tts.Communicate = FakeCommunicate

print("\n--- live call ---")
if os.environ.get("AZURE_SPEECH_KEY", "").strip() and os.environ.get("AZURE_SPEECH_REGION", "").strip():
    tts.httpx.AsyncClient = REAL_CLIENT
    configure(
        tts_provider="azure",
        azure_speech_key=os.environ["AZURE_SPEECH_KEY"].strip(),
        azure_speech_region=os.environ["AZURE_SPEECH_REGION"].strip(),
    )
    live_url = run(tts.synthesize("नमस्कार, main CareerGuide hoon.", "hi"))
    check("a real Azure call returns playable audio", live_url.startswith("data:audio/mpeg;base64,"),
          live_url[:40])
    check("a real Azure call returned more than a header", len(live_url) > 5000, len(live_url))
else:
    print("  [SKIP] no AZURE_SPEECH_KEY / AZURE_SPEECH_REGION in this shell, nothing was sent "
          "to Microsoft for real")

if TEST_DB.exists():
    TEST_DB.unlink()

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("failed: " + ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
