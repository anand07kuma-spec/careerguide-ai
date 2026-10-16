"""Text-to-speech.

Speech always comes from an external online service here — none of this is an
offline guarantee — so every failure surfaces as a readable error and the UI
keeps the written reply. Three transports, two voice lists:

* `google-gemini-tts` — Gemini's speech model. Answers from a datacenter IP and
  speaks Hindi, English and Hinglish in one natural voice.
* `microsoft-azure-tts` — Microsoft's own Speech REST API with the deployment's
  key. Also answers from a datacenter IP.
* `microsoft-edge-tts` — the free Edge read-aloud endpoint the `edge-tts` package
  drives. Works from a home connection, and returns 403 from cloud egress IPs.

The two Microsoft services return mp3 and Gemini returns a complete WAV, so the
data URL says which one it holds and the browser player works out the rest.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from datetime import datetime, timezone
from xml.sax.saxutils import escape as xml_escape

import edge_tts
import httpx

from ..config import get_settings

log = logging.getLogger(__name__)

GEMINI = "google-gemini-tts"
AZURE = "microsoft-azure-tts"
EDGE = "microsoft-edge-tts"

# What is actually sent to the speech service. A guide reply can run longer than
# a comfortable sentence to listen to, so the tail is dropped rather than
# rejected — see `plain_text`.
MAX_SPOKEN_CHARS = 1200
# Gemini answers as uncompressed WAV, roughly four times the bytes of the mp3s
# for the same seconds of speech, so its spoken tail is cut sooner. A longer
# reply would turn into a megabyte of audio carried inside the reply itself.
GEMINI_MAX_SPOKEN_CHARS = 650

# A plain mp3 at the bitrate Edge already used, so the audio the student hears
# does not change size or shape when a key is added.
AZURE_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"

GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)
# Gemini reads a bare sentence flatly. Its own documentation asks for a spoken
# style lead-in, which directs the delivery rather than adding words to say.
GEMINI_STYLE_LEAD = "Say warmly and naturally, like a friend talking to a student: "

VOICES = {
    "hi": [
        {"id": "hi-IN-SwaraNeural", "label": "Swara (Hindi, female)"},
        {"id": "hi-IN-MadhurNeural", "label": "Madhur (Hindi, male)"},
    ],
    "en": [
        {"id": "en-IN-NeerjaNeural", "label": "Neerja (Indian English, female)"},
        {"id": "en-IN-PrabhatNeural", "label": "Prabhat (Indian English, male)"},
        {"id": "en-GB-SoniaNeural", "label": "Sonia (British English, female)"},
    ],
}

# Google does not label these voices as male or female, so each label says what
# the voice sounds like and the student picks by ear. One list serves every
# language, because the model reads the script of the text it is given.
GEMINI_VOICE_CHOICES = [
    {"id": "Sulafat", "label": "Sulafat (warm)"},
    {"id": "Achird", "label": "Achird (friendly)"},
    {"id": "Puck", "label": "Puck (upbeat)"},
    {"id": "Leda", "label": "Leda (youthful)"},
    {"id": "Charon", "label": "Charon (calm)"},
    {"id": "Aoede", "label": "Aoede (breezy)"},
]

GEMINI_VOICES = {"hi": GEMINI_VOICE_CHOICES, "en": GEMINI_VOICE_CHOICES}


class TTSError(RuntimeError):
    pass


UNAVAILABLE = (
    "Voice audio is unavailable right now. The written reply is still here, "
    "and you can try again."
)
TOO_SLOW = "The speech service took too long to respond. You can read the reply, or try again."

# Only the outcome of a real call is kept, never the text that was spoken: a
# configuration flag cannot tell a student whether the service answers this
# server, and `/api/health` claiming otherwise is what made a blocked service
# look working.
_attempt: dict = {
    "checked_at": None,
    "ok": None,
    "provider": None,
    "reason": None,
}


def record_attempt(ok: bool, used_provider: str, reason: str | None = None) -> None:
    _attempt.update(
        checked_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        ok=ok,
        provider=used_provider,
        reason=None if ok else (reason or UNAVAILABLE),
    )


def last_attempt() -> dict:
    """Carries the provider it was made against, so a verdict recorded for Edge
    is not read as a verdict about Azure after a key is added."""
    return dict(_attempt)


def voices_for(used: str) -> dict[str, list[dict]]:
    """The Microsoft list or the Gemini list, never a mix of the two."""
    return GEMINI_VOICES if used == GEMINI else VOICES


def voice_for(language: str, override: str | None = None) -> str:
    settings = get_settings()
    used = provider()
    allowed = {v["id"] for group in voices_for(used).values() for v in group}
    if override and override in allowed:
        return override
    # A voice chosen while one service was configured is ignored by the next one,
    # rather than sent to it as an unknown name.
    if used == GEMINI:
        return settings.gemini_voice.strip() or "Sulafat"
    if language == "hi":
        return settings.tts_voice_hi
    return settings.tts_voice_en


def azure_ready() -> bool:
    settings = get_settings()
    return bool(settings.azure_speech_key.strip() and settings.azure_speech_region.strip())


def gemini_ready() -> bool:
    return bool(get_settings().gemini_api_key.strip())


def configured(used: str) -> bool:
    """Whether this service can be called with what the server holds."""
    if used == GEMINI:
        return gemini_ready()
    if used == AZURE:
        return azure_ready()
    return True


def provider() -> str:
    """Which service will be called next time."""
    choice = (get_settings().tts_provider or "auto").strip().lower()
    if choice in ("azure", AZURE):
        return AZURE
    if choice in ("edge", EDGE, "edge-tts"):
        return EDGE
    if choice in ("gemini", GEMINI, "google"):
        return GEMINI
    if choice != "auto":
        # An unrecognised name must not quietly pick a service nobody asked for.
        log.warning("TTS_PROVIDER=%r is not a known provider; using auto", choice)
    # Gemini is the friendliest sounding of the three, so it leads when a key
    # exists. Edge is last because a datacenter IP cannot reach it.
    if gemini_ready():
        return GEMINI
    return AZURE if azure_ready() else EDGE


def provider_note() -> str:
    used = provider()
    if used == GEMINI:
        return (
            "Audio is generated by Google Gemini TTS, an online service called with the "
            "server's key. The reply text is sent to Google to make the audio. It needs "
            "internet access and can be unavailable at times, so every reply also stays "
            "readable as text."
        )
    if used == AZURE:
        return (
            "Audio is generated by Microsoft Azure Speech, an online service called with "
            "the server's key. The reply text is sent to Microsoft to make the audio. It "
            "needs internet access and can be unavailable at times, so every reply also "
            "stays readable as text."
        )
    return (
        "Audio is generated by Microsoft Edge TTS, an online service. It needs internet "
        "access and can be unavailable at times, so every reply also stays readable as text."
    )


def plain_text(text: str, limit: int = MAX_SPOKEN_CHARS) -> str:
    """Markup the guide may have produced is read out as noise, and long
    paragraphs are exhausting to listen to.

    The cut happens here rather than as a request limit: a request validator
    would reject a full guide reply with a 422, which reads as "the voice is
    broken" when the intended behaviour is "listen to the first part".
    """
    return re.sub(r"[#*_`]", "", text).strip()[:limit]


def build_ssml(text: str, voice: str) -> str:
    # `text` is conversation content; `voice` comes from the provider's own list.
    locale = "-".join(voice.split("-")[:2])
    return (
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' "
        f"xml:lang='{locale}'><voice name='{voice}'>{xml_escape(text)}</voice></speak>"
    )


def azure_url() -> str:
    # The portal labels a Speech resource's region as "Central India" while the
    # host wants `centralindia`, so the display name is accepted as well.
    region = get_settings().azure_speech_region.strip().lower().replace(" ", "").replace("-", "")
    return f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"


async def _azure_bytes(text: str, voice: str) -> bytes:
    settings = get_settings()
    headers = {
        "Ocp-Apim-Subscription-Key": settings.azure_speech_key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": AZURE_OUTPUT_FORMAT,
        "User-Agent": "CareerGuideAI",
    }
    try:
        async with httpx.AsyncClient(timeout=settings.tts_timeout_seconds) as client:
            response = await client.post(
                azure_url(), headers=headers, content=build_ssml(text, voice).encode("utf-8")
            )
    except httpx.TimeoutException as exc:
        raise TTSError(TOO_SLOW) from exc
    except httpx.HTTPError as exc:
        log.warning("Azure Speech request failed: %s", type(exc).__name__)
        raise TTSError(UNAVAILABLE) from exc

    if response.status_code != 200:
        # The body can repeat back the SSML, which holds conversation text, so
        # only the status and the size of the answer are logged.
        log.warning(
            "Azure Speech answered %s with %d bytes", response.status_code, len(response.content)
        )
        raise TTSError(UNAVAILABLE)

    audio = response.content
    if not audio:
        raise TTSError("The speech service returned no audio.")
    return audio


def gemini_url() -> str:
    model = get_settings().gemini_tts_model.strip() or "gemini-3.8-flash-tts"
    return GEMINI_ENDPOINT.format(model=model)


def gemini_body(text: str, voice: str) -> dict:
    """The speech request: audio only, in one named voice.

    `voice` comes from GEMINI_VOICE_CHOICES or the server's default, never from
    anything a student typed.
    """
    return {
        "contents": [{"parts": [{"text": GEMINI_STYLE_LEAD + text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }


def gemini_audio(payload: dict) -> bytes:
    """Pull the audio out of a generateContent answer.

    A model that refuses the sentence answers with no audio part and no error
    code, which would otherwise read as a call that worked and produced silence.
    """
    block = payload.get("promptFeedback") or payload.get("prompt_feedback") or {}
    if block.get("blockReason") or block.get("block_reason"):
        raise TTSError("The speech service refused this sentence. Please try again.")
    candidates = payload.get("candidates") or []
    parts = (candidates[0].get("content") or {}).get("parts") if candidates else None
    for part in parts or []:
        inline = part.get("inlineData") or part.get("inline_data") or {}
        data = inline.get("data")
        if data:
            try:
                return base64.b64decode(data)
            except (ValueError, TypeError) as exc:
                raise TTSError("The speech service returned audio it could not decode.") from exc
    raise TTSError("The speech service returned no audio.")


async def _gemini_bytes(text: str, voice: str) -> bytes:
    settings = get_settings()
    headers = {
        # The key travels in a header: in a URL it would land in access logs.
        "x-goog-api-key": settings.gemini_api_key,
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=settings.tts_timeout_seconds) as client:
            response = await client.post(
                gemini_url(),
                headers=headers,
                content=json.dumps(gemini_body(text, voice)).encode("utf-8"),
            )
    except httpx.TimeoutException as exc:
        raise TTSError(TOO_SLOW) from exc
    except httpx.HTTPError as exc:
        log.warning("Gemini TTS request failed: %s", type(exc).__name__)
        raise TTSError(UNAVAILABLE) from exc

    if response.status_code != 200:
        # An error body can quote the sentence it was given, so only the status
        # and the size of the answer are written down.
        log.warning(
            "Gemini TTS answered %s with %d bytes", response.status_code, len(response.content)
        )
        raise TTSError(UNAVAILABLE)

    try:
        payload = response.json()
    except ValueError as exc:
        log.warning("Gemini TTS answered 200 with something that was not JSON")
        raise TTSError(UNAVAILABLE) from exc

    audio = gemini_audio(payload)
    if not audio:
        raise TTSError("The speech service returned no audio.")
    return audio


async def _collect(communicate: edge_tts.Communicate) -> bytes:
    audio = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
    return bytes(audio)


async def _edge_bytes(text: str, voice: str) -> bytes:
    settings = get_settings()
    try:
        communicate = edge_tts.Communicate(text, voice)
        audio = await asyncio.wait_for(_collect(communicate), timeout=settings.tts_timeout_seconds)
    except asyncio.TimeoutError as exc:
        raise TTSError(TOO_SLOW) from exc
    except Exception as exc:  # edge-tts raises many network/protocol error types
        log.warning("Edge TTS failed for voice %s: %s", voice, exc)
        raise TTSError(UNAVAILABLE) from exc

    if not audio:
        raise TTSError("The speech service returned no audio.")
    return audio


# A forced choice whose key is missing should say so, not quietly fall back to a
# service that will refuse this host.
MISSING_KEY = {
    GEMINI: (
        "Speech is set to Gemini but GEMINI_API_KEY is not set on the server, so "
        "nothing can be spoken."
    ),
    AZURE: (
        "Speech is set to Azure but AZURE_SPEECH_KEY or AZURE_SPEECH_REGION is not "
        "set on the server, so nothing can be spoken."
    ),
}

CALLS = {GEMINI: _gemini_bytes, AZURE: _azure_bytes, EDGE: _edge_bytes}


async def synthesize_bytes(text: str, language: str, override_voice: str | None = None) -> bytes:
    """Speak `text` and return the audio bytes.

    Every outcome is recorded (`record_attempt`) because the three services fail
    in different places: Edge answers from a home connection and returns 403 from
    a datacenter IP, while Gemini and Azure answer wherever they are called from
    as long as the key is valid. Only a real call can say which one this server
    is on.
    """
    if not text or not text.strip():
        raise TTSError("There was nothing to read out.")

    used = provider()
    if not configured(used):
        raise TTSError(MISSING_KEY[used])

    limit = GEMINI_MAX_SPOKEN_CHARS if used == GEMINI else MAX_SPOKEN_CHARS
    clean = plain_text(text, limit)
    voice = voice_for(language, override_voice)

    try:
        audio = await CALLS[used](clean, voice)
    except TTSError as exc:
        record_attempt(False, used, str(exc))
        raise
    record_attempt(True, used)
    return audio


def data_url(audio: bytes) -> str:
    """Microsoft answers as mp3 and Gemini as a complete RIFF/WAVE file, so the
    URL has to say which one the browser is being handed."""
    mime = "audio/wav" if audio[:4] == b"RIFF" else "audio/mpeg"
    return f"data:{mime};base64," + base64.b64encode(audio).decode("ascii")


async def synthesize(text: str, language: str, override_voice: str | None = None) -> str:
    """Speak `text` and return something an `<audio>` element can play directly.

    The clip comes back inside the reply as a data URL instead of a saved file:
    on serverless hosting a file written by one instance is invisible to the next
    request, and a path the browser has to fetch again would either need the
    reply's text in a logged URL or a signed-URL secret this app does not need
    yet.
    """
    return data_url(await synthesize_bytes(text, language, override_voice))


def voice_options() -> list[dict]:
    return [
        {"language": language, "voices": voices}
        for language, voices in voices_for(provider()).items()
    ]
