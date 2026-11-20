"""Prove the CSRF guard refuses foreign pages and keeps every real caller working.

The session is an httpOnly cookie sent `SameSite=None`, so the browser attaches it to
requests a foreign page starts. CORS stops that page *reading* the answer; this suite
is about the other half — the write actually happening. Each class below is a request
shape a browser can produce, and the expected answer is either "carried out" or the
guard's 403 with the same sentence every time.

What is deliberately *not* asserted: that CORS and the guard share one allowlist
directly (they call the same function), or anything about a real browser's behaviour —
that half is verified in the browser and recorded in docs/ARCHITECTURE_AND_TESTS.md §5.

Runs against a throwaway database, never ``careerguide.db``.

Run from ``backend/``:

    .venv/Scripts/python.exe scripts/csrf_test.py
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

TEST_DB = pathlib.Path(tempfile.gettempdir()) / "careerguide_csrf_test.db"
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{TEST_DB.as_posix()}",
        "AI_PROVIDER": "demo",
        "DB_AUTO_SETUP": "false",
        "RATE_LIMIT_ENABLED": "false",
        # One exact origin and nothing else: an unset FRONTEND_URL would add the local
        # development pair, and every refusal below would be measured against a
        # different list than the one this file writes down.
        "FRONTEND_URL": "http://localhost:3000",
        "CORS_ORIGINS": "https://family.example",
        "PUBLIC_SITE_URL": "",
    }
)

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.middleware.csrf import CSRF_DETAIL  # noqa: E402

# After `app.main` (which imports every router, and so every model) so `Base.metadata`
# knows all the tables; before the first request.
Base.metadata.create_all(bind=engine)

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


client = TestClient(app)

ALLOWED = "http://localhost:3000"
GUEST = {"device_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7"}


def refused(response) -> bool:
    return response.status_code == 403 and response.json().get("detail") == CSRF_DETAIL


def section(title: str) -> None:
    print(f"\n== {title} ==")


section("An origin this site serves from is carried out")
ok = client.post("/api/auth/guest", json=GUEST, headers={"Origin": ALLOWED})
check("allowlisted origin on a JSON POST passes the guard", ok.status_code != 403, str(ok.status_code))
check("and the route really ran", ok.status_code == 200, str(ok.status_code))
trailing = client.post("/api/auth/guest", json=GUEST, headers={"Origin": ALLOWED + "/"})
check("an origin with a trailing slash is the same origin", trailing.status_code != 403, str(trailing.status_code))
second = client.post("/api/auth/guest", json=GUEST, headers={"Origin": "https://family.example"})
check("every allowlisted origin passes, not just the first", second.status_code != 403, str(second.status_code))

section("A foreign origin is refused before the route runs")
foreign = client.post("/api/auth/guest", json=GUEST, headers={"Origin": "https://evil.example"})
check("a foreign origin gets 403", refused(foreign), f"{foreign.status_code} {foreign.text[:120]}")
check("the body is the same sentence, not a stack trace", CSRF_DETAIL in foreign.text)
check("the body does not name the allowlist", "localhost" not in foreign.text and "family.example" not in foreign.text)
check("Origin: null is not an origin", refused(
    client.post("/api/auth/guest", json=GUEST, headers={"Origin": "null"})
))
check("a suffix of an allowed origin is refused", refused(
    client.post("/api/auth/guest", json=GUEST, headers={"Origin": "https://family.example.evil.com"})
))
check("a longer port on an allowed host is refused", refused(
    client.post("/api/auth/guest", json=GUEST, headers={"Origin": "http://localhost:30000"})
))
check("a different scheme on an allowed host is refused", refused(
    client.post("/api/auth/guest", json=GUEST, headers={"Origin": "https://localhost:3000"})
))

section("Sec-Fetch-Site decides when there is no Origin")
check("same-origin POST passes", client.post(
    "/api/auth/guest", json=GUEST, headers={"Sec-Fetch-Site": "same-origin"}
).status_code != 403)
check("a user-initiated (none) POST passes", client.post(
    "/api/auth/guest", json=GUEST, headers={"Sec-Fetch-Site": "none"}
).status_code != 403)
check("cross-site with no Origin is refused", refused(
    client.post("/api/auth/guest", json=GUEST, headers={"Sec-Fetch-Site": "cross-site"})
))
check("same-site with no Origin is refused", refused(
    client.post("/api/auth/guest", json=GUEST, headers={"Sec-Fetch-Site": "same-site"})
))
check("a non-browser client (no Origin, no Sec-Fetch-Site) is allowed", client.post(
    "/api/auth/guest", json=GUEST
).status_code != 403)
check("an allowlisted Origin beats a cross-site label", client.post(
    "/api/auth/guest", json=GUEST, headers={"Origin": ALLOWED, "Sec-Fetch-Site": "cross-site"}
).status_code != 403)

section("Reads are not writes")
check("GET with a foreign origin is not refused by this guard",
      client.get("/api/careers", headers={"Origin": "https://evil.example"}).status_code != 403)
check("OPTIONS with a foreign origin is left to CORS",
      client.options("/api/auth/guest", headers={
          "Origin": "https://evil.example",
          "Access-Control-Request-Method": "POST",
      }).status_code != 403)

section("Body-less and multipart writes are covered, not just JSON")
logout = client.post("/api/auth/logout", headers={"Origin": "https://evil.example"})
check("a body-less logout from a foreign page is refused", refused(logout), str(logout.status_code))
logout_ok = client.post("/api/auth/logout", headers={"Origin": ALLOWED})
check("the same logout from the site itself is not refused", logout_ok.status_code != 403, str(logout_ok.status_code))

photo = client.post(
    "/api/profile/photo",
    files={"photo": ("me.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    headers={"Origin": "https://evil.example"},
)
check("a multipart upload from a foreign page is refused", refused(photo), str(photo.status_code))
photo_ok = client.post(
    "/api/profile/photo",
    files={"photo": ("me.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    headers={"Origin": ALLOWED},
)
check("the same upload from the site itself is not refused by this guard", photo_ok.status_code != 403,
      str(photo_ok.status_code))

section("Provider webhooks are exempt by exact path, and only that path")
razorpay = client.post("/api/payments/webhook", content=b"{}", headers={"Origin": "https://evil.example"})
check("the Razorpay webhook is not refused by the CSRF guard", not refused(razorpay), str(razorpay.status_code))
clerk = client.post("/api/webhooks/clerk", content=b"{}", headers={"Origin": "https://evil.example"})
check("the Clerk webhook is not refused by the CSRF guard", not refused(clerk), str(clerk.status_code))
near = client.post("/api/payments/webhook/again", content=b"{}", headers={"Origin": "https://evil.example"})
check("a route beside a webhook does not inherit the exemption", refused(near), str(near.status_code))

section("A bearer token does not bypass the guard")
bearer = client.post(
    "/api/auth/logout",
    headers={"Origin": "https://evil.example", "Authorization": "Bearer " + "a" * 43},
)
check("a foreign page cannot act by presenting a header it cannot set", refused(bearer), str(bearer.status_code))

print()
if FAIL:
    print(f"{len(PASS)} passed, {len(FAIL)} failed")
    for label in FAIL:
        print(f"  failed: {label}")
    raise SystemExit(1)
print(f"{len(PASS)} passed, 0 failed")
