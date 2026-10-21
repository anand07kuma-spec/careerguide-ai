"""Talking to Clerk, and only the two things this app needs it for.

Clerk is an *optional* upgrade here. The account a student actually uses is the
one this browser made for itself (see `security.py`), and nothing in this file
changes that: a Clerk session can only ever be *attached* to an account that is
already signed in, or used to fetch a token for an account that already has one.
Every read of a child's data still goes through this app's own bearer token, so a
Clerk session on its own reaches nothing.

Two rules shape the design:

* **No secret is stored that Clerk already holds.** No password, no email, no
  name. The only thing written to this database is Clerk's user id, because a
  pointer is what makes "open my work on a new phone" possible. So there is no
  user record to keep in sync — which is why `verify_webhook` below is about
  *removal*, not copying.
* **An unconfigured deployment says so.** Every entry point here raises or returns
  a 503 naming the missing variable instead of inventing a success, because a
  silent fallback would look like an account was created when nothing was.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import HTTPException, status

from ..config import get_settings

log = logging.getLogger(__name__)

NOT_CONFIGURED = HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    detail=(
        "Email sign-in is not switched on for this deployment. Whoever runs this "
        "site needs to set CLERK_SECRET_KEY on the server. Until then this app "
        "keeps working exactly as it does now — this browser is still the account, "
        "and nothing has been lost."
    ),
)

# A Clerk session token is the `__session` cookie's value: a Client Request JSON
# the browser hands over, which only Clerk's own API can check. It is a few
# hundred bytes of base64 wrapped in JSON, so a request that carries something
# absurd is not a Clerk token at all and is not worth sending anywhere.
MAX_SESSION_TOKEN = 8_192


def configured() -> bool:
    """Whether this deployment can ask Clerk anything at all."""
    return bool(get_settings().clerk_secret_key.strip())


def require_configured() -> None:
    if not configured():
        raise NOT_CONFIGURED


def verify_session_token(session_token: str) -> str:
    """Return Clerk's user id for a session token, or raise 401.

    The token is sent to Clerk's `POST /v1/tokens/verify` and its answer is the
    only thing trusted here. Verifying it locally would mean checking a JWT
    against Clerk's keys — same trust, one more dependency and a cache that can
    go stale, so the single HTTP call is the honest shape for a request that
    happens a handful of times per account.
    """
    require_configured()
    settings = get_settings()
    token = session_token.strip()
    if not token or len(token) > MAX_SESSION_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="That sign-in could not be checked. Please sign in again.",
        )

    try:
        response = httpx.post(
            f"{settings.clerk_api_base.rstrip('/')}/v1/tokens/verify",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key.strip()}"},
            json={"session": token},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        log.warning("Clerk token verification could not reach Clerk: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "The sign-in service could not be reached, so this sign-in was not "
                "accepted. Nothing was changed — please try again."
            ),
        ) from exc

    if response.status_code != 200:
        # Clerk answers 401 for a dead or forged session. The reason it gives is
        # its own vocabulary and means nothing to a family, so it is logged and a
        # plain sentence is shown instead.
        log.info("Clerk refused a session token with %s", response.status_code)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="That sign-in is no longer valid. Please sign in again.",
        )

    try:
        body: Any = response.json()
    except ValueError as exc:
        log.warning("Clerk answered token verification with a body that was not JSON")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The sign-in service answered in a form this app does not understand.",
        ) from exc

    # `status` is Clerk's own yes/no; `user_id` is the only identity taken from
    # the response, and both are required so a half-formed answer links nothing.
    if body.get("status") is not True or not isinstance(body.get("user_id"), str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="That sign-in is no longer valid. Please sign in again.",
        )
    return body["user_id"]


def webhook_configured() -> bool:
    return bool(get_settings().clerk_webhook_signing_secret.strip())


class WebhookRejected(Exception):
    """The payload did not carry a signature this deployment can vouch for."""


def verify_webhook(raw_body: bytes, headers: dict[str, str]) -> dict[str, Any]:
    """Return the event, but only if its Svix signature checks out.

    A webhook URL that accepts unsigned JSON is a door into which anyone can walk
    and say "delete that account". The signature is checked over the exact bytes
    received — never a re-serialised body, which is how these checks usually end
    up passing for the wrong reason.
    """
    if not webhook_configured():
        raise WebhookRejected(
            "CLERK_WEBHOOK_SIGNING_SECRET is not set, so no webhook can be trusted here."
        )
    # Imported lazily: an unconfigured deployment must still boot without it.
    from svix import Webhook

    try:
        message = Webhook(get_settings().clerk_webhook_signing_secret.strip()).verify(
            raw_body, headers
        )
    except Exception as exc:  # svix raises a bare Exception for every rejection
        raise WebhookRejected("The signature on this delivery does not match.") from exc
    if not isinstance(message, dict):
        raise WebhookRejected("The signed payload was not an object.")
    return message
