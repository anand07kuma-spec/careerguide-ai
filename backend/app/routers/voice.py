"""Text-to-speech endpoints. Speech recognition runs in the browser."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import User
from ..schemas import TTSIn, VoiceInfoOut
from ..security import get_current_user
from ..services import tts

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.get("/voices", response_model=VoiceInfoOut)
def voices() -> VoiceInfoOut:
    settings = get_settings()
    return VoiceInfoOut(
        voices=tts.voice_options(),
        provider=tts.provider(),
        note=tts.provider_note(),
        default_voice=settings.tts_voice_en,
    )


@router.post("/speak")
async def speak(
    payload: TTSIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        url = await tts.synthesize(payload.text, payload.language, payload.voice)
    except tts.TTSError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"audio_url": url, "provider": tts.provider()}
