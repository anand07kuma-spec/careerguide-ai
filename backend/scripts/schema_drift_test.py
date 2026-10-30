"""Test what happens when the code is ahead of the database it is pointed at.

`Base.metadata.create_all` builds tables but never widens one it built earlier, which is
what `app/schema_sync.py` is for — and why a deployment that turns it off
(`DB_AUTO_SETUP=false`, which is how this app runs on Vercel) has to be told when the
schema it was handed is behind the code running on it. Without that notice a column added
to a model stays invisible until a student opens a page: the SELECT names a column the
database does not have, the route answers 500, and `/api/health` goes on reporting
`ready` because a connection is not a schema.

The drift is reproduced by dropping the three columns revision `0016_career_source` adds,
which is the state of a live database the day after that revision is written and before
anybody runs it.

Runs against a throwaway database, never `careerguide.db`.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/schema_drift_test.py
"""

from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_schema_drift_test.db"

# (table, column) from `migrations/versions/20261023-0016_career_source.py`. All three
# are nullable, which is what makes them safe for `add_missing_columns` to attach and
# what makes their absence a 500 rather than a startup error.
DROPPED = [
    ("careers", "source_url"),
    ("careers", "verified_at"),
    ("scholarships", "source_url"),
]


def build_drifted_db() -> None:
    """A complete schema with revision 0016's columns taken back out."""
    if DB_PATH.exists():
        DB_PATH.unlink()
    os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
    os.environ["AI_PROVIDER"] = "demo"
    os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py
    from sqlalchemy import text

    # Importing the models is what registers them on `Base.metadata`; `app.database`
    # alone hands over an empty one and a `create_all` that builds nothing.
    import app.models  # noqa: F401
    from app.database import Base, engine

    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        for table, column in DROPPED:
            conn.execute(text(f'ALTER TABLE "{table}" DROP COLUMN "{column}"'))
    engine.dispose()


def columns_of(table: str) -> set[str]:
    from sqlalchemy import inspect

    from app.database import engine

    names = {item["name"] for item in inspect(engine).get_columns(table)}
    engine.dispose()
    return names


CHILD = """
import os, sys
ROOT, url, auto_setup = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, ROOT)
os.environ["DATABASE_URL"] = url
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["DB_AUTO_SETUP"] = auto_setup
from fastapi.testclient import TestClient
from app.main import app
# The 500 below is the app's own masked answer to a broken SELECT. Left at the default,
# TestClient re-raises the server exception after the response is built, which would
# report this run as a crash instead of the status code a browser actually sees.
with TestClient(app, raise_server_exceptions=False) as c:
    health = c.get("/api/health")
    careers = c.get("/api/careers")
    print(health.status_code, health.json().get("storage"), careers.status_code)
"""


def run(auto_setup: str) -> str:
    child = subprocess.run(
        [sys.executable, "-c", CHILD, str(ROOT), f"sqlite:///{DB_PATH.as_posix()}", auto_setup],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
    )
    lines = child.stdout.strip().splitlines()
    return lines[-1] if lines else child.stderr[-300:]


PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


build_drifted_db()
drifted = run("false")
check(
    "a deployment with DB_AUTO_SETUP off still boots",
    drifted.startswith("200 "),
    drifted,
)
check("health stops calling a stale schema ready", drifted.split()[1] == "schema_outdated", drifted)
check("the route that really is broken answers 500", drifted.split()[2] == "500", drifted)

# The same database through the path that is allowed to write: nothing to report once
# the columns exist, and the screens work again.
build_drifted_db()
healed = run("true")
check("DB_AUTO_SETUP on repairs it and says so", healed == "200 ready 200", healed)
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
present = columns_of("careers") | columns_of("scholarships")
check("the widened columns are back", {"source_url", "verified_at"} <= present, sorted(present))

DB_PATH.unlink(missing_ok=True)

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("failed: " + ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
