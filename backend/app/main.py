"""CareerGuide AI backend.

FastAPI + SQLAlchemy + SQLite. Run with:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import Base, SessionLocal, engine
from .routers import auth, catalogue, careers, conversations, interests
from .routers import journey, recommendations, reports, study_plans, voice
from .seed import seed_if_empty
from .services.tts import MEDIA_DIR

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("careerguide")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        counts = seed_if_empty(db)
    if counts:
        log.info("Seeded catalogue: %s", counts)
    if not settings.ai_configured:
        log.warning(
            "AI provider is running in DEMO MODE with a scripted guide. "
            "Set AI_PROVIDER, AI_API_KEY and AI_MODEL in .env to use a real model."
        )
    yield


app = FastAPI(
    title="CareerGuide AI API",
    version="1.0.0",
    description="Career exploration and guidance backend for students and parents.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.mount("/media", StaticFiles(directory=str(Path(MEDIA_DIR).parent)), name="media")

for module in (
    auth,
    careers,
    conversations,
    voice,
    interests,
    recommendations,
    journey,
    study_plans,
    catalogue,
    reports,
):
    app.include_router(module.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {
        "status": "ok",
        "ai_provider": "configured" if settings.ai_configured else "demo",
        "ai_configured": settings.ai_configured,
        "tts_provider": "microsoft-edge-tts",
        "demo_mode": not settings.ai_configured,
    }


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    """Errors must never leak internals or crash the client into a dead screen."""
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Something went wrong on our side. Your work is still here, please try again."
        },
    )
