"""Verify which database the app is actually talking to.

Prints the dialect, the server version, the tables it sees and a row count per
table. The connection string is masked — the password never reaches the console,
so this output is safe to paste into a bug report.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/db_check.py
"""

from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import inspect, text  # noqa: E402

# Importing the models registers every table on Base.metadata, so the count
# below can be compared against what the database actually holds.
from app import models  # noqa: E402, F401
from app.database import Base, engine, settings  # noqa: E402


def mask(url: str) -> str:
    """Keep the host and database name, hide the credential."""
    if url.startswith("sqlite"):
        return url
    head, _, tail = url.partition("://")
    creds, _, host = tail.rpartition("@")
    user, _, _ = creds.partition(":")
    return f"{head}://{user}:****@{host}{('?' + tail.split('?', 1)[1]) if '?' in tail else ''}"


print("DATABASE_URL :", mask(settings.database_url))
print("dialect      :", engine.dialect.name)
print("driver       :", engine.dialect.driver)

try:
    with engine.connect() as conn:
        if engine.dialect.name == "sqlite":
            version = conn.execute(text("select sqlite_version()")).scalar()
            print(f"server       : SQLite {version}")
            print("file         :", engine.url.database)
        else:
            print(f"server       : {conn.execute(text('select version()')).scalar()}")
except Exception as exc:  # noqa: BLE001
    print("\nCONNECTION FAILED — the app would not start with this URL either.")
    print(f"{type(exc).__name__}: {str(exc).splitlines()[0]}")
    sys.exit(1)

tables = inspect(engine).get_table_names()
print(f"tables       : {len(tables)} (expected {len(Base.metadata.tables)})")

with engine.connect() as conn:
    for name in sorted(tables):
        count = conn.execute(text(f'select count(*) from "{name}"')).scalar()
        print(f"  {count:>6}  {name}")

missing = sorted(set(Base.metadata.tables) - set(tables))
if missing:
    print("\nMissing tables (start the app once to create them):", ", ".join(missing))
else:
    print("\nAll models have tables in this database.")
