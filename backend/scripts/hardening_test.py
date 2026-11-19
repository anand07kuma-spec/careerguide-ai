"""Regression tests for the audit hardening pass.

Covers, in one place, the small reliability and exposure fixes that do not belong to
any single feature suite:

* `/api/health` answers `HEAD` as well as `GET`, with no body and the same status.
* Every reply — including a CORS preflight, which `CORSMiddleware` answers without
  reaching a route — carries `X-Content-Type-Options: nosniff`.
* The interactive API docs are served on a laptop and closed on a hosted deployment,
  with `API_DOCS_ENABLED=true` able to publish them deliberately.
* `GET /api/auth/me` answers a browser that presented **no** credential with 204, so a
  first page load is not a logged 401 — while a token that was presented and rejected
  still answers 401.
* The guest handshake writes nothing for a device the database has never seen.
* An unusable `RATE_LIMIT_REDIS_URL` is ignored with a log line instead of stopping the
  API at import.

Runs against a throwaway database. Run from `backend/`:

    .venv/Scripts/python.exe scripts/hardening_test.py
"""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import tempfile
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_hardening_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()

ORIGIN = "https://careerguide-web.vercel.app"

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["CORS_ORIGINS"] = ORIGIN
# This file proves the laptop branch of the docs decision, so the hosted signals and
# any explicit override must not leak in from the machine running the tests.
for name in ("VERCEL", "REQUIRE_POSTGRES", "API_DOCS_ENABLED"):
    os.environ.pop(name, None)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.middleware.rate_limit import validate_redis_url  # noqa: E402
from app.models import User  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n=== {title}")


def user_count() -> int:
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(User)) or 0


settings = get_settings()
COOKIE = settings.auth_cookie_name
BOGUS_TOKEN = "A" * 43

with TestClient(app) as client:
    section("Health answers GET and HEAD")
    got = client.get("/api/health")
    check("GET /api/health is 200", got.status_code == 200, got.status_code)
    check("GET still returns the health payload", got.json().get("status") == "ok", got.text[:200])
    check("GET carries the nosniff header",
          got.headers.get("x-content-type-options") == "nosniff",
          dict(got.headers))
    head = client.head("/api/health")
    check("HEAD /api/health is 200", head.status_code == 200, head.status_code)
    check("HEAD has no body", head.content == b"", head.content[:40])
    check("HEAD still names its media type",
          head.headers.get("content-type", "").startswith("application/json"),
          head.headers.get("content-type"))
    check("HEAD carries the nosniff header",
          head.headers.get("x-content-type-options") == "nosniff",
          dict(head.headers))

    section("Every reply, preflight included, carries nosniff")
    preflight = client.options(
        "/api/auth/guest",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    check("the preflight is answered", preflight.status_code == 200, preflight.status_code)
    check("CORS still names the allowed origin",
          preflight.headers.get("access-control-allow-origin") == ORIGIN,
          dict(preflight.headers))
    check("CORS still allows credentials",
          preflight.headers.get("access-control-allow-credentials") == "true",
          dict(preflight.headers))
    check("the preflight carries nosniff",
          preflight.headers.get("x-content-type-options") == "nosniff",
          dict(preflight.headers))

    refused = client.options(
        "/api/auth/guest",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    check("a foreign origin is still refused", refused.status_code == 400, refused.status_code)
    check("the refusal carries nosniff too",
          refused.headers.get("x-content-type-options") == "nosniff",
          dict(refused.headers))

    section("An anonymous session probe is not a failure")
    anonymous = client.get("/api/auth/me")
    check("no credential at all is answered 204", anonymous.status_code == 204, anonymous.status_code)
    check("…with no body", anonymous.content == b"", anonymous.content[:40])

    wrong_cookie = client.get("/api/auth/me", cookies={COOKIE: BOGUS_TOKEN})
    check("a cookie that is not a session is still refused",
          wrong_cookie.status_code == 401, wrong_cookie.status_code)

    wrong_bearer = client.get("/api/auth/me", headers={"Authorization": f"Bearer {BOGUS_TOKEN}"})
    check("a bearer string that is not a session is still refused",
          wrong_bearer.status_code == 401, wrong_bearer.status_code)

    malformed = client.get("/api/auth/me", headers={"Authorization": "Bearer short"})
    check("a malformed bearer header is refused, not treated as anonymous",
          malformed.status_code == 401, malformed.status_code)

    basic = client.get("/api/auth/me", headers={"Authorization": "Basic abc"})
    check("a non-bearer Authorization header is refused",
          basic.status_code == 401, basic.status_code)

    created = client.post(
        "/api/auth/onboarding",
        json={
            "role": "student",
            "display_name": "Hardening",
            "preferred_language": "hinglish",
            "consent_profile": True,
            "consent_voice": False,
            "consent_age": "11-12",
        },
    )
    check("a real account can still be created", created.status_code == 200, created.text[:200])
    token = created.json().get("token", "")
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    check("a presented session is still answered 200", me.status_code == 200, me.status_code)
    check("…with the account it belongs to",
          me.json().get("user", {}).get("display_name") == "Hardening", me.text[:200])

    section("The guest handshake writes nothing for an unknown device")
    before = user_count()
    new_device = uuid.uuid4().hex
    guest = client.post("/api/auth/guest", json={"device_id": new_device})
    check("an unknown device is answered", guest.status_code == 200, guest.text[:200])
    check("…and told it is unknown", guest.json().get("known") is False, guest.text[:200])
    check("…and handed no session", guest.json().get("session") is None, guest.text[:200])
    check("…and no user row was created", user_count() == before, (before, user_count()))

    section("Docs stay available on a laptop")
    for path in ("/docs", "/redoc", "/openapi.json"):
        response = client.get(path)
        check(f"GET {path} is served locally", response.status_code == 200, response.status_code)


section("An unusable Redis URL falls back instead of stopping the API")
check("a blank value keeps memory storage", validate_redis_url("") == "", validate_redis_url(""))
check("a redis URL is passed through",
      validate_redis_url("redis://localhost:6379/0") == "redis://localhost:6379/0",
      validate_redis_url("redis://localhost:6379/0"))
check("a TLS redis URL is passed through",
      validate_redis_url("rediss://cache.example:6379/0") == "rediss://cache.example:6379/0",
      validate_redis_url("rediss://cache.example:6379/0"))
check("a redis URL with no host is rejected", validate_redis_url("redis://") == "",
      validate_redis_url("redis://"))
check("an http URL is rejected", validate_redis_url("http://localhost:6379") == "",
      validate_redis_url("http://localhost:6379"))
check("a value that is not a URL is rejected", validate_redis_url("not-a-url") == "",
      validate_redis_url("not-a-url"))


# The docs decision is made at import, so each hosted shape gets its own process.
CHILD = """
import json, os, pathlib, sys, tempfile
ROOT = sys.argv[1]
sys.path.insert(0, ROOT)
db = pathlib.Path(tempfile.gettempdir()) / ("careerguide_hardening_child_" + os.getpid().__str__() + ".db")
if db.exists():
    db.unlink()
os.environ["DATABASE_URL"] = "sqlite:///" + db.as_posix()
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as c:
    result = {
        "docs": c.get("/docs").status_code,
        "redoc": c.get("/redoc").status_code,
        "openapi": c.get("/openapi.json").status_code,
        "health": c.get("/api/health").status_code,
        "head": c.head("/api/health").status_code,
    }
print("RESULT " + json.dumps(result))
db.unlink(missing_ok=True)
"""


def run_child(extra_env: dict[str, str]) -> dict[str, int]:
    child_env = {
        key: value
        for key, value in os.environ.items()
        if key not in {"VERCEL", "REQUIRE_POSTGRES", "API_DOCS_ENABLED"}
    }
    child_env.update(extra_env)
    child = subprocess.run(
        [sys.executable, "-c", CHILD, str(ROOT)],
        capture_output=True,
        text=True,
        env=child_env,
        cwd=str(ROOT),
    )
    for line in child.stdout.splitlines():
        if line.startswith("RESULT "):
            return json.loads(line[len("RESULT "):])
    detail = (child.stderr or child.stdout or "").strip()[-400:]
    raise RuntimeError(f"child did not report: {detail}")


section("Docs are closed on a hosted deployment")
hosted = run_child({"VERCEL": "1"})
check("VERCEL: /docs is closed", hosted.get("docs") == 404, hosted)
check("VERCEL: /redoc is closed", hosted.get("redoc") == 404, hosted)
check("VERCEL: /openapi.json is closed", hosted.get("openapi") == 404, hosted)
check("VERCEL: health still answers", hosted.get("health") == 200, hosted)
check("VERCEL: HEAD health still answers", hosted.get("head") == 200, hosted)

render = run_child({"REQUIRE_POSTGRES": "true"})
check("REQUIRE_POSTGRES: /docs is closed", render.get("docs") == 404, render)

override = run_child({"VERCEL": "1", "API_DOCS_ENABLED": "true"})
check("API_DOCS_ENABLED=true publishes the docs on a host", override.get("docs") == 200, override)

if DB_PATH.exists():
    # SQLite keeps the file open in the connection pool on Windows.
    engine.dispose()
    DB_PATH.unlink(missing_ok=True)

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("failed: " + ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
