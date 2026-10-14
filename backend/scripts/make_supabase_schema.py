"""Regenerate `supabase_schema.sql` from the models, so it cannot drift from them.

    cd backend && ./.venv/Scripts/python.exe scripts/make_supabase_schema.py

The output is the PostgreSQL dialect SQLAlchemy would emit for `create_all`, plus
the row-level-security lines that keep Supabase's auto-generated REST API out of the
data. Nothing here touches a database: the schema is read off `Base.metadata`.
"""

from __future__ import annotations

import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("DATABASE_URL", "sqlite:///./_schema_dump.db")

from sqlalchemy.dialects import postgresql  # noqa: E402
from sqlalchemy.schema import CreateIndex, CreateTable  # noqa: E402

from app import models  # noqa: E402, F401  (registers every table on Base.metadata)
from app.database import Base  # noqa: E402

HEADER = """-- CareerGuide AI on Supabase: every table the app writes to.
--
-- Generated from the models, not typed by hand:
--     cd backend && ./.venv/Scripts/python.exe scripts/make_supabase_schema.py
-- Regenerate it after changing app/models.py.
--
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- It creates the schema only. The career, scholarship, resource and institution
-- reference content is inserted by application code, because those rows carry
-- Python-side column defaults and JSON lists:
--     ./.venv/Scripts/python.exe scripts/db_init.py
--
-- The app connects with the pooler URI from Project Settings -> Database ->
-- Connection string -> URI, in this shape (sslmode=require is mandatory):
--     postgresql://postgres.PROJECT-REF:DB-PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require
-- The SQL editor runs as the same role the app logs in as, so the tables it creates
-- here are already owned by it and need no GRANT lines.
"""

RLS_INTRO = """
-- Keep Supabase's auto-generated REST API from reading the children's data.
--
-- Every table in the public schema is reachable through PostgREST with the anon key,
-- and the app never uses that door: it talks to PostgreSQL directly with psycopg.
-- Enabling row level security with no policies means the anon and authenticated roles
-- see zero rows, while the app is unaffected because it logs in as postgres, the owner
-- of these tables, and a table owner is not subject to RLS.
--
-- This is a second lock on the front door, not the permission model. Which family may
-- read which student is still decided by the backend routes, against the session token.
"""


def ddl(tables) -> str:
    dialect = postgresql.dialect()
    parts: list[str] = []
    for table in tables:
        parts.append(str(CreateTable(table).compile(dialect=dialect)).strip())
        for index in sorted(table.indexes, key=lambda item: item.name or ""):
            parts.append(str(CreateIndex(index).compile(dialect=dialect)).strip())
    return ";\n\n".join(parts) + ";"


def rls(tables) -> str:
    return "\n".join(f'ALTER TABLE "{table.name}" ENABLE ROW LEVEL SECURITY;' for table in tables)


tables = Base.metadata.sorted_tables
target = ROOT / "scripts" / "supabase_schema.sql"
target.write_text(
    HEADER + "\n" + ddl(tables) + "\n" + RLS_INTRO + "\n" + rls(tables) + "\n", encoding="utf-8"
)
print(f"{target.name}: {len(tables)} tables, {len(target.read_text(encoding='utf-8'))} characters")
