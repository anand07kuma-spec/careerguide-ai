"""CareerGuide AI backend.

FastAPI + SQLAlchemy, on SQLite (default) or Postgres. Run with:
    uvicorn app.main:app --reload --port 8000

Deployed to Vercel it becomes one Python function: same app, no local disk, so
`DB_AUTO_SETUP=false` there and the schema is prepared once with
`scripts/db_init.py`.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .database import Base, SessionLocal, engine
from .routers import auth, catalogue, careers, conversations, interests
from .routers import journey, recommendations, reports, study_plans, voice
from .schema_sync import add_missing_columns
from .seed import seed_if_empty
from .services import tts

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("careerguide")

settings = get_settings()

# Serverless hosting wipes the disk between requests, so a file-based database up
# there would silently lose accounts and conversations. Rather than crash the
# whole function, the app boots, answers /api/health, and refuses to read or write
# anything else until a real database is configured.
storage_unusable = bool(os.environ.get("VERCEL")) and settings.database_url.startswith("sqlite")

STORAGE_UNAVAILABLE_DETAIL = (
    "This deployment has no database attached yet, so nothing can be saved or read. "
    "Whoever runs this site needs to point DATABASE_URL at a Postgres database."
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if storage_unusable:
        log.error(
            "DATABASE_URL points at SQLite on serverless hosting. Every data "
            "endpoint answers 503 until a Postgres database is configured."
        )
    elif settings.db_auto_setup:
        Base.metadata.create_all(bind=engine)
        added = add_missing_columns(engine)
        if added:
            log.info("Added missing columns to an existing schema: %s", added)
        with SessionLocal() as db:
            counts = seed_if_empty(db)
        if counts:
            log.info("Seeded catalogue: %s", counts)
    else:
        log.info("DB_AUTO_SETUP is off: expecting an already prepared schema.")
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


# Registered before CORSMiddleware on purpose: Starlette makes the most recently
# added middleware the outer one, and a 503 without CORS headers cannot be read by
# a browser — it surfaces as a bogus "server unreachable" instead of this message.
@app.middleware("http")
async def refuse_without_storage(request: Request, call_next):
    if (
        storage_unusable
        and request.url.path.startswith("/api")
        and request.url.path != "/api/health"
    ):
        return JSONResponse(status_code=503, content={"detail": STORAGE_UNAVAILABLE_DETAIL})
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

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
        "storage": "unconfigured" if storage_unusable else "ready",
        "ai_provider": "configured" if settings.ai_configured else "demo",
        "ai_configured": settings.ai_configured,
        # Which service will be called, and whether it can actually be called —
        # the check a person runs after pasting a TTS key.
        "tts_provider": tts.provider(),
        "tts_ready": tts.provider() != tts.AZURE or tts.azure_ready(),
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
