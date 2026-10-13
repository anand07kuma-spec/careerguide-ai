"""Microsoft Edge text-to-speech.

Edge TTS is an external online service. It is not an offline guarantee, so
every failure here surfaces as a readable error and the UI keeps the text.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import re

import edge_tts

from ..config import get_settings

log = logging.getLogger(__name__)

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

ALLOWED_VOICES = {v["id"] for group in VOICES.values() for v in group}


class TTSError(RuntimeError):
    pass


def voice_for(language: str, override: str | None = None) -> str:
    if override and override in ALLOWED_VOICES:
        return override
    settings = get_settings()
    if language == "hi" or language == "hinglish":
        return settings.tts_voice_hi if language == "hi" else settings.tts_voice_en
    return settings.tts_voice_en


async def _collect(communicate: edge_tts.Communicate) -> bytes:
    audio = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
    return bytes(audio)


async def synthesize_bytes(text: str, language: str, override_voice: str | None = None) -> bytes:
    """Speak `text` and return the mp3 bytes."""
    if not text or not text.strip():
        raise TTSError("There was nothing to read out.")

    voice = voice_for(language, override_voice)
    # edge-tts rejects markup, and long paragraphs sound exhausting when spoken.
    clean = re.sub(r"[#*_`]", "", text).strip()[:1200]
    settings = get_settings()

    try:
        communicate = edge_tts.Communicate(clean, voice)
        audio = await asyncio.wait_for(_collect(communicate), timeout=settings.tts_timeout_seconds)
    except asyncio.TimeoutError as exc:
        raise TTSError(
            "The speech service took too long to respond. You can read the reply, or try again."
        ) from exc
    except Exception as exc:  # edge-tts raises many network/protocol error types
        log.warning("Edge TTS failed for voice %s: %s", voice, exc)
        raise TTSError(
            "Voice audio is unavailable right now. The written reply is still here, and you can try again."
        ) from exc

    if not audio:
        raise TTSError("The speech service returned no audio.")
    return audio


async def synthesize(text: str, language: str, override_voice: str | None = None) -> str:
    """Speak `text` and return something an `<audio>` element can play directly.

    The clip comes back inside the reply as a data URL instead of a saved file:
    on serverless hosting a file written by one instance is invisible to the next
    request, and a path the browser has to fetch again would either need the
    reply's text in a logged URL or a signed-URL secret this app does not need
    yet.
    """
    audio = await synthesize_bytes(text, language, override_voice)
    return "data:audio/mpeg;base64," + base64.b64encode(audio).decode("ascii")


def voice_options() -> list[dict]:
    return [
        {"language": language, "voices": voices}
        for language, voices in VOICES.items()
    ]
