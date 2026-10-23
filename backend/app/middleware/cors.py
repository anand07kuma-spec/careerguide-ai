"""Which browsers may call this API.

The rule is a list, never a wildcard. `*` is refused here rather than trusted,
because this API answers with a child's conversations — and because requests now
carry a session cookie, a wildcard would be a foreign page reading whatever its
visitor's cookie can open. `allow_credentials` is therefore the setting that makes
the exactness of this list load-bearing rather than merely tidy: it is only ever
true beside a list of named origins, and `browser_origins` below keeps it that way.

Origins come from `FRONTEND_URL` first — the one setting that says where the site is
actually served from — then `CORS_ORIGINS` for the additional origins a deployment may
have (a school portal's own subdomain), then the site's own public address, so that a
deployment which has set `PUBLIC_SITE_URL` cannot be left in the common broken state
where the page loads and every request inside it fails. With no `FRONTEND_URL` at all the
list falls back to the local dev pair and a warning names every origin it guessed.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..config import Settings, frontend_origins

log = logging.getLogger(__name__)

# Both credentials now, deliberately. The `httpOnly` session cookie only travels if
# the fetch asks for it and this reply allows it, and the `Authorization` header the
# CLI scripts and the mail worker use needs the same allow line on a preflight to
# reach this API from a page at all.
#
# `PUT` is here because a portal's branding is replaced as a whole document by the
# admin who owns it. A method missing from this list fails in the least obvious way
# possible: the browser's preflight is refused, so the request never leaves and the
# screen reports the server as unreachable while `GET` on the same path still works.
ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
ALLOWED_HEADERS = ["Authorization", "Content-Type"]


def browser_origins(settings: Settings) -> list[str]:
    """Every origin a browser may call from, deduplicated, `*` never among them."""
    kept: list[str] = []

    def add(origin: str) -> None:
        cleaned = origin.strip().rstrip("/")
        if not cleaned:
            return
        if cleaned == "*":
            log.warning(
                "An origin of '*' was configured — ignored. This API answers with a "
                "child's conversations and takes a session cookie; list the origins."
            )
            return
        if cleaned not in kept:
            kept.append(cleaned)

    for origin in frontend_origins(settings.frontend_url):
        add(origin)
    for origin in settings.cors_origins.split(","):
        add(origin)

    site = settings.public_site_url.strip().rstrip("/")
    # `https` only, and only this one: a public URL typed as plain http is a mistake,
    # and quietly allowing it would mean a page whose own origin is not trusted here
    # could still read a session.
    if site.startswith("https://"):
        add(site)
    return kept


def configure_cors(app: FastAPI, settings: Settings) -> None:
    origins = browser_origins(settings)
    if not origins:
        log.warning(
            "No browser origin is allowed (FRONTEND_URL and CORS_ORIGINS are both "
            "empty), so a page on any origin will be refused. Non-browser clients "
            "are unaffected."
        )
    if settings.frontend_url.strip() == "" and settings.cors_origins.strip() == "":
        log.warning(
            "FRONTEND_URL is unset and CORS_ORIGINS is empty, so this deployment is "
            "answering to the local dev origins only — %s. Set FRONTEND_URL to the "
            "site's own origin before a family opens it.",
            ", ".join(origins) or "(none)",
        )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        # `browser_origins()` has already dropped any `*` in the list, which is the
        # only reason this line is safe to write: a credentialed wildcard is the one
        # combination that turns a browser into a way to read any family's data.
        allow_credentials=True,
        allow_methods=ALLOWED_METHODS,
        allow_headers=ALLOWED_HEADERS,
    )
    log.info(
        "CORS: %d origin(s) allowed to call this API from a browser — %s",
        len(origins),
        ", ".join(origins) or "none",
    )
