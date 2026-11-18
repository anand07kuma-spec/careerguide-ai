"""Prove which connection string the API picks, and from which variable.

Vercel's Prisma Postgres integration injects `DATABASE_URL` and refuses to let
anyone edit or delete it. The deployment therefore names its own Neon string
`CAREERGUIDE_DATABASE_URL`, which has to win when both are present — otherwise the
API keeps reading the integration's stale database and every sign-in answers 500.
A laptop that sets neither must keep its SQLite file, and a blank preferred value
must not shadow the fallback that is actually filled in.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/database_url_test.py
"""

from __future__ import annotations

import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import Settings  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


BOTH = ("CAREERGUIDE_DATABASE_URL", "DATABASE_URL")


def built(**env: str) -> Settings:
    """Settings from exactly `env` — no .env file, no leftover process variables."""
    saved = {name: os.environ.get(name) for name in BOTH}
    try:
        for name in BOTH:
            os.environ.pop(name, None)
        os.environ.update(env)
        # The repository's own backend/.env would otherwise decide the answer.
        return Settings(_env_file=None)
    finally:
        for name in BOTH:
            os.environ.pop(name, None)
            if saved[name] is not None:
                os.environ[name] = saved[name]


print("\n[1] Which variable supplies the connection string")

check(
    "neither variable still means the local SQLite file",
    built().database_url == "sqlite:///./careerguide.db",
    built().database_url,
)
check(
    "`DATABASE_URL` alone is still honoured, as it always was",
    built(DATABASE_URL="sqlite:///./from-fallback.db").database_url
    == "sqlite:///./from-fallback.db",
)
check(
    "`CAREERGUIDE_DATABASE_URL` alone is used",
    built(CAREERGUIDE_DATABASE_URL="sqlite:///./from-named.db").database_url
    == "sqlite:///./from-named.db",
)
named_wins = built(
    CAREERGUIDE_DATABASE_URL="sqlite:///./neon.db",
    DATABASE_URL="sqlite:///./prisma.db",
).database_url
check(
    "when both exist, the named Neon string wins",
    named_wins == "sqlite:///./neon.db",
    named_wins,
)
check(
    "a blank named variable does not shadow a working fallback",
    built(
        CAREERGUIDE_DATABASE_URL="", DATABASE_URL="sqlite:///./prisma.db"
    ).database_url
    == "sqlite:///./prisma.db",
)
check(
    "a whitespace-only named variable never becomes an empty URL",
    built(
        CAREERGUIDE_DATABASE_URL="   ", DATABASE_URL="sqlite:///./prisma.db"
    ).database_url
    == "sqlite:///./careerguide.db",
    built(CAREERGUIDE_DATABASE_URL="   ", DATABASE_URL="sqlite:///./prisma.db").database_url,
)
check(
    "a blank named variable with no fallback keeps the local default",
    built(CAREERGUIDE_DATABASE_URL="").database_url == "sqlite:///./careerguide.db",
    built(CAREERGUIDE_DATABASE_URL="").database_url,
)

print("\n[2] The rest of the settings behaviour is unchanged")

check(
    "the field name is still accepted by the constructor",
    Settings(database_url="sqlite:///./from-constructor.db", _env_file=None).database_url
    == "sqlite:///./from-constructor.db",
)
hosted = built(
    CAREERGUIDE_DATABASE_URL="postgresql://u:p@neon.example:5432/neondb"
).database_url
check(
    "the chosen URL still gets the shipped driver and TLS",
    hosted.startswith("postgresql+psycopg://") and "sslmode=require" in hosted,
    hosted,
)

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("failed: " + ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
