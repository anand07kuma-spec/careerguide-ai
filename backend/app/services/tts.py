"""Microsoft Edge text-to-speech.

Edge TTS is an external online service. It is not an offline guarantee, so
every failure here surfaces as a readable error and the UI keeps the text.
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from pathlib import Path

import edge_tts

from ..config import get_settings

log = logging.getLogger(__name__)

MEDIA_DIR = Path(__file__).resolve().parents[2] / "media" / "tts"

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

_SAFE = re.compile(r"[^A-Za-z0-9]+")


class TTSError(RuntimeError):
    pass


def voice_for(language: str, override: str | None = None) -> str:
    if override and override in ALLOWED_VOICES:
        return override
    settings = get_settings()
    if language == "hi" or language == "hinglish":
        return settings.tts_voice_hi if language == "hi" else settings.tts_voice_en
    return settings.tts_voice_en


def _slug(text: str) -> str:
    cleaned = _SAFE.sub("-", text.strip().lower()).strip("-")
    return cleaned[:48] or "speech"


async def synthesize(text: str, language: str, override_voice: str | None = None) -> str:
    """Speak `text` and return a URL path the browser can play."""
    if not text or not text.strip():
        raise TTSError("There was nothing to read out.")

    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    voice = voice_for(language, override_voice)
    # edge-tts rejects markup, and long paragraphs sound exhausting when spoken.
    clean = re.sub(r"[#*_`]", "", text).strip()[:1200]
    filename = f"{_slug(voice)}-{uuid.uuid4().hex[:12]}.mp3"
    target = MEDIA_DIR / filename
    settings = get_settings()

    try:
        communicate = edge_tts.Communicate(clean, voice)
        await asyncio.wait_for(communicate.save(str(target)), timeout=settings.tts_timeout_seconds)
    except asyncio.TimeoutError as exc:
        raise TTSError(
            "The speech service took too long to respond. You can read the reply, or try again."
        ) from exc
    except Exception as exc:  # edge-tts raises many network/protocol error types
        log.warning("Edge TTS failed for voice %s: %s", voice, exc)
        raise TTSError(
            "Voice audio is unavailable right now. The written reply is still here, and you can try again."
        ) from exc

    if not target.exists() or target.stat().st_size == 0:
        raise TTSError("The speech service returned no audio.")

    return f"/media/tts/{filename}"


def voice_options() -> list[dict]:
    return [
        {"language": language, "voices": voices}
        for language, voices in VOICES.items()
    ]
