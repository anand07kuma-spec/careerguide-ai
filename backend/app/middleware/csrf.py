"""Proof that a state-changing request came from this site's own pages.

The session lives in an httpOnly cookie sent with `SameSite=None`, because the
frontend and the API are served from different origins. That cookie travels on
cross-site requests too, and CORS only stops a foreign page from *reading* the
answer — it does not stop a cross-site form post, a multipart upload, or a body-less
POST from *doing* something. This middleware is the other half.

Policy for a state-changing `/api` request, in order:

* `GET`, `HEAD`, `OPTIONS` and `TRACE` pass: they change nothing here.
* Non-`/api` paths pass: they are static files, not this application's data.
* Each provider webhook passes, matched as an exact path: Razorpay's and Clerk's
  deliveries are not browsers, carry no session cookie, and are authenticated by a
  signature over the raw body instead (`/api/payments/webhook`, `/api/webhooks/clerk`).
* If `Origin` is present, it must equal one origin from the same exact allowlist
  CORS uses — no `*`, no suffix match, no host that merely starts with an allowed
  one. `Origin: null` (a sandboxed frame or a file:// page) is not an origin and is
  refused.
* If `Origin` is absent, `Sec-Fetch-Site` decides: `same-origin` and `none` pass,
  because no other site's page can produce them; `same-site` and `cross-site` are
  refused.
* A request with neither header is a non-browser client — curl, the CLI scripts, the
  mail worker — and is allowed. Every browser attaches `Origin` to a cross-origin
  POST and `Sec-Fetch-Site` to every request it makes, so this cannot be reached from
  a web page.

A refused request never reaches a route, and the body says why without naming the
allowlist: the caller does not need to know the deployment's addresses to understand
that they may not change data from here.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from ..config import Settings
from .cors import browser_origins

log = logging.getLogger(__name__)

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})

# Exact paths, never prefixes: a prefix exemption is how the next route added beside a
# webhook quietly loses the guard.
UNPROTECTED_PATHS = frozenset(
    {
        "/api/payments/webhook",
        "/api/webhooks/clerk",
    }
)

# Values of `Sec-Fetch-Site` that only a page on another site can produce.
FOREIGN_FETCH_SITES = frozenset({"same-site", "cross-site"})

CSRF_DETAIL = (
    "This request did not come from the CareerGuide AI site, so it was not carried "
    "out. Reload the page and try again; nothing was changed."
)


def _origin_allowed(origin: str, allowed: frozenset[str]) -> bool:
    return origin.rstrip("/") in allowed


def configure_csrf(app: FastAPI, settings: Settings) -> None:
    """Install the guard with the same allowlist CORS answers to.

    The middleware is registered before `configure_cors` in `main.py`, which makes it
    the inner one: a 403 then leaves through CORS and carries the headers a browser
    needs to read it, instead of failing as an opaque network error.
    """
    allowed = frozenset(browser_origins(settings))

    @app.middleware("http")
    async def csrf_origin_guard(request: Request, call_next):
        if request.method not in SAFE_METHODS:
            path = request.url.path
            if path.startswith("/api") and path not in UNPROTECTED_PATHS:
                origin = (request.headers.get("origin") or "").strip()
                if origin:
                    permitted = _origin_allowed(origin, allowed)
                else:
                    site = (request.headers.get("sec-fetch-site") or "").strip().lower()
                    permitted = site not in FOREIGN_FETCH_SITES
                if not permitted:
                    log.info(
                        "Refused %s %s: origin %r is not one this site serves from "
                        "(Sec-Fetch-Site %r).",
                        request.method,
                        path,
                        origin or "(none)",
                        (request.headers.get("sec-fetch-site") or "(none)"),
                    )
                    return JSONResponse(
                        status_code=403,
                        content={"detail": CSRF_DETAIL},
                        headers={"Vary": "Origin"},
                    )
        return await call_next(request)
