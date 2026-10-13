"""Prepare a database once, so the app itself never has to.

Creates every table and seeds the career catalogue if it is empty. Run this
against the database you are about to deploy to, then set `DB_AUTO_SETUP=false`
there so a serverless cold start does not run schema DDL on every new instance.

Flags:

    --from-vercel          read DATABASE_URL from the `.env.local` that
                           `vercel env pull` writes and insist on TLS
    --recreate-if-empty    drop and rebuild the tables, but only while every one of
                           them holds zero rows

The connection string is masked in the output; the password never prints.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/db_init.py --from-vercel --recreate-if-empty
"""

from __future__ import annotations

import os
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

if "--from-vercel" in sys.argv:
    # `vercel env pull` writes `.env.local`, which the app itself never loads. The
    # URL inside needs no driver fixing — app/config.py puts the shipped psycopg
    # driver on any bare Postgres URL — but a host that does not insist on TLS
    # still gets asked for it, because these databases refuse plain connections.
    raw = (ROOT / ".env.local").read_text(encoding="utf-8")
    found = re.search(r'^DATABASE_URL="?([^"\n]+)"?$', raw, re.M)
    if not found:
        sys.exit("No DATABASE_URL in .env.local — run `npx vercel env pull .env.local` first.")
    url = found.group(1)
    if "sslmode" not in url:
        url += ("&" if "?" in url else "?") + "sslmode=require"
    os.environ["DATABASE_URL"] = url
    print("--from-vercel: using the URL from .env.local\n")

from sqlalchemy import inspect, text  # noqa: E402

from app import models  # noqa: E402, F401  (registers every table on Base.metadata)
from app.database import Base, SessionLocal, engine, settings  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402
from app.schema_sync import add_missing_columns  # noqa: E402


def mask(url: str) -> str:
    """Keep the host and database name, hide the credential."""
    if url.startswith("sqlite"):
        return url
    head, _, tail = url.partition("://")
    creds, _, rest = tail.rpartition("@")
    host, _, query = rest.partition("?")
    user, _, _ = creds.partition(":")
    return f"{head}://{user}:****@{host}{('?' + query) if query else ''}"


print("DATABASE_URL :", mask(settings.database_url))

if "--recreate-if-empty" in sys.argv:
    # `create_all` never ALTERs a table it already made, so a column whose length
    # changed stays wrong on an existing database. Rebuilding is only offered while
    # every table is still empty — the moment there are rows, this refuses.
    existing = inspect(engine).get_table_names()
    with engine.connect() as conn:
        rows = {
            name: conn.execute(text(f'select count(*) from "{name}"')).scalar() for name in existing
        }
    occupied = {k: v for k, v in rows.items() if v}
    if occupied:
        sys.exit(f"Refusing to recreate: these tables already hold rows — {occupied}")
    if existing:
        Base.metadata.drop_all(bind=engine)
        print(f"recreated    : dropped {len(existing)} empty tables")

Base.metadata.create_all(bind=engine)
print(f"tables       : {len(inspect(engine).get_table_names())} created or confirmed")

added = add_missing_columns(engine)
if added:
    print("columns      : " + ", ".join(added))

with SessionLocal() as db:
    counts = seed_if_empty(db)
print("seeded       :", counts if counts else "catalogue already had rows")

# The app's own first query should work on the finished database.
with engine.connect() as conn:
    careers = conn.execute(text('select count(*) from careers')).scalar()
print("careers rows :", careers)
print("\nNow set DB_AUTO_SETUP=false in the deployed environment.")
