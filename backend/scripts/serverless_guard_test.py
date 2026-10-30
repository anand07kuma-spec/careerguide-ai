"""Test what the API does when it is deployed without a real database.

Vercel runs this app as a short-lived function whose disk is wiped between
requests, so a SQLite file there would accept a child's account and then lose it.
The app must refuse to read or write data in that shape — but say so clearly
instead of crashing, because a dead function looks to a browser like a network
problem and the real reason never reaches anyone.

The same hazard exists on any host that rebuilds a container on every push, and
such a host sets no environment flag of its own. Render is that case, so the guard
has a second trigger — `REQUIRE_POSTGRES` — and this file checks both: the refusal
with the flag and no `VERCEL`, and a plain local run that keeps its SQLite file.

Runs against a throwaway database, never `careerguide.db`.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/serverless_guard_test.py
"""

from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import _console  # noqa: E402,F401 -- utf-8 stdout, see _console.py

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_serverless_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()

ORIGIN = "https://careerguide-web.vercel.app"

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py
os.environ["CORS_ORIGINS"] = ORIGIN
# The signal that this is serverless hosting rather than someone's laptop.
os.environ["VERCEL"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


with TestClient(app) as client:
    health = client.get("/api/health", headers={"Origin": ORIGIN})
    check("boots instead of crashing", health.status_code == 200, health.status_code)
    check("health admits the database is missing",
          health.json().get("storage") == "unconfigured", health.json())

    signup = client.post(
        "/api/auth/onboarding",
        headers={"Origin": ORIGIN},
        json={
            "role": "student",
            "preferred_language": "hinglish",
            "consent_profile": True,
            "consent_voice": False,
            "consent_age": "13-15",
        },
    )
    check("a data route is refused", signup.status_code == 503, signup.status_code)
    detail = signup.json().get("detail", "")
    check("says which setting to fix", "DATABASE_URL" in detail, detail)
    check("says Postgres, not 'something went wrong'", "Postgres" in detail, detail)
    check("refusal carries CORS headers",
          signup.headers.get("access-control-allow-origin") == ORIGIN, dict(signup.headers))
    check("nothing was written to the ephemeral disk", not DB_PATH.exists())

    catalogue = client.get("/api/careers", headers={"Origin": ORIGIN})
    check("read-only routes are refused too", catalogue.status_code == 503, catalogue.status_code)

    docs = client.get("/docs")
    check("non-API paths still serve", docs.status_code == 200, docs.status_code)

# Two shapes of the same question, asked of a fresh process each time because the
# guard is decided at import: a host that sets no flag of its own but does say the
# disk is temporary (`REQUIRE_POSTGRES`), and a laptop, which is none of those things.
CHILD = """
import os, pathlib, sys, tempfile
ROOT, require_pg = sys.argv[1], sys.argv[2]
sys.path.insert(0, ROOT)
db = pathlib.Path(tempfile.gettempdir()) / "careerguide_local_check.db"
if db.exists():
    db.unlink()
os.environ["DATABASE_URL"] = "sqlite:///" + db.as_posix()
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py
if require_pg == "1":
    # The switch a Render-style deployment flips, with no vendor flag present.
    os.environ["REQUIRE_POSTGRES"] = "true"
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as c:
    h = c.get("/api/health")
    r = c.get("/api/careers")
    print(h.json().get("storage"), r.status_code)
    db.unlink(missing_ok=True)
"""
def _run(require_pg: str) -> str:
    # Neither vendor flag is passed down: the parent process runs with `VERCEL=1`, and
    # each child decides for itself which trigger, if any, it is testing.
    child_env = {k: v for k, v in os.environ.items() if k not in {"VERCEL", "REQUIRE_POSTGRES"}}
    child = subprocess.run(
        [sys.executable, "-c", CHILD, str(ROOT), require_pg],
        capture_output=True, text=True, env=child_env, cwd=str(ROOT),
    )
    lines = child.stdout.strip().splitlines()
    return lines[-1] if lines else child.stderr[-200:]


hosted = _run("1")
check(
    "`REQUIRE_POSTGRES` is the guard on a host that sets no flag of its own",
    hosted == "unconfigured 503",
    hosted,
)

# The same SQLite file is correct on a laptop, so the guard must stay off there.
last = _run("0")
check("local run keeps using its SQLite file", last == "ready 200", last)

if DB_PATH.exists():
    DB_PATH.unlink()

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("failed: " + ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
