"""Signing in with Google, on top of the account model this app already has.

The browser's device id and its session cookie are still how an account works: Google
adds a *verified identity* that can open that same account from a new phone, and it
adds a way to make an account without the old onboarding form. It does not replace the
session, and it is never the only door.

The flow is the server-side OAuth one, in three parts:

1. `/start` mints `state`, a PKCE verifier and a nonce, puts them in a short-lived
   `httpOnly` cookie signed with the client secret, and sends the browser to Google.
   The role chosen on the previous screen travels inside that signed cookie.
2. Google sends the browser back to `/callback` with a one-time code.
3. This server exchanges the code (sending the PKCE verifier), then verifies the
   identity token: RS256 signature against Google's published keys, `iss`, `aud`,
   `exp`/`iat` and the nonce. Only then is the subject id read.

What is deliberately *not* trusted:

* `?role=` on the callback — it is not accepted at all. A role exists only inside the
  signed state cookie, and only for an account that does not exist yet.
* an account's existing role — a Google sign-in never changes it, so a parent who
  signs in still lands on the parent dashboard.
* an email address — it is not stored and is never a matching key. An identity is
  matched by Google's `sub`, which Google has signed. No account is merged on an
  email claim.
* the browser's word that it owns an account — linking to an existing account needs
  either an existing session for it or the device id that already *is* its credential.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from datetime import datetime, timezone
from functools import lru_cache
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import frontend_origins, get_settings
from ..database import get_db
from ..middleware.rate_limit import auth_limit
from ..models import AuthToken, ConsentRecord, StudentProfile, User, UserSettings
from ..schemas import GoogleStatusOut
from ..security import (
    TOKEN_SHAPE,
    cookie_is_secure,
    device_hash_of,
    device_owner,
    session_cookie_value,
    token_hash_of,
)
from .auth import new_share_code, start_session

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth/google", tags=["auth"])

STATE_COOKIE = "cg_oauth_state"
STATE_TTL_SECONDS = 600

# Google's two spellings of the issuer. Anything else — including a token signed for a
# different product, or one this server minted — is refused before a subject is read.
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
SCOPES = "openid email profile"


class GoogleAuthError(Exception):
    """A sign-in that cannot be trusted. The message stays in the log, never the URL."""


# ------------------------------------------------------------------ the state cookie
#
# The cookie is `httpOnly`, so page script cannot read the verifier or forge a state,
# and it is signed so a tampered cookie is refused rather than parsed. The signature key
# is derived from the client secret, which means a deployment with no Google credentials
# also has no way to validate a flow — which is the same answer as "not configured".


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _signature(payload: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _issue_state(
    request: Request,
    response: RedirectResponse,
    *,
    settings,
    state: str,
    verifier: str,
    nonce: str,
    role: str | None,
    device_id: str | None,
) -> None:
    body = json.dumps(
        {
            "s": state,
            "v": verifier,
            "n": nonce,
            "r": role,
            "d": device_id,
            "e": int(time.time()) + STATE_TTL_SECONDS,
        },
        separators=(",", ":"),
    ).encode("utf-8")
    response.set_cookie(
        STATE_COOKIE,
        value=f"{_b64(body)}.{_signature(body, settings.google_client_secret)}",
        max_age=STATE_TTL_SECONDS,
        path="/api/auth/google",
        httponly=True,
        secure=cookie_is_secure(request),
        # `Lax` is required rather than a looser choice: Google returns to this server
        # by a top-level GET, which Lax sends, while a cross-site form post does not.
        samesite="lax",
    )


def _read_state(request: Request, settings) -> dict:
    raw = request.cookies.get(STATE_COOKIE) or ""
    if "." not in raw:
        raise GoogleAuthError("no state cookie")
    encoded, signature = raw.rsplit(".", 1)
    try:
        body = _unb64(encoded)
    except ValueError as exc:
        raise GoogleAuthError("unreadable state cookie") from exc
    if not hmac.compare_digest(signature, _signature(body, settings.google_client_secret)):
        raise GoogleAuthError("state cookie signature did not match")
    try:
        pending = json.loads(body)
    except ValueError as exc:
        raise GoogleAuthError("state cookie was not JSON") from exc
    if not isinstance(pending, dict) or not isinstance(pending.get("e"), int):
        raise GoogleAuthError("state cookie had the wrong shape")
    if pending["e"] < int(time.time()):
        raise GoogleAuthError("state cookie expired")
    for key in ("s", "v", "n"):
        if not isinstance(pending.get(key), str) or not pending[key]:
            raise GoogleAuthError("state cookie was incomplete")
    return pending


def _clear_state(request: Request, response: RedirectResponse) -> None:
    response.delete_cookie(
        STATE_COOKIE,
        path="/api/auth/google",
        httponly=True,
        secure=cookie_is_secure(request),
        samesite="lax",
    )


# --------------------------------------------------------------------- the provider


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> PyJWKClient:
    """One client per key set URL, because it caches Google's keys between sign-ins."""
    return PyJWKClient(url, cache_keys=True, lifespan=3600)


def _exchange_code(code: str, verifier: str, settings) -> dict:
    payload = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
        "code_verifier": verifier,
    }
    try:
        with httpx.Client(timeout=settings.google_timeout_seconds) as client:
            response = client.post(
                settings.google_token_url,
                data=payload,
                headers={"Accept": "application/json"},
            )
    except httpx.HTTPError as exc:
        raise GoogleAuthError("the token exchange could not be reached") from exc
    if response.status_code != 200:
        raise GoogleAuthError(f"the token exchange answered {response.status_code}")
    try:
        body = response.json()
    except ValueError as exc:
        raise GoogleAuthError("the token exchange sent no JSON") from exc
    if not isinstance(body, dict) or not isinstance(body.get("id_token"), str):
        raise GoogleAuthError("the token exchange sent no identity token")
    return body


def _verify_id_token(value: str, nonce: str, settings) -> dict:
    """Everything a decoded token is not: signature, issuer, audience, time and nonce.

    `verify_iss` is off only so both of Google's spellings are accepted by the explicit
    check below; every other claim is enforced by the library, including `exp`, `iat`
    and `aud`. `leeway` covers a server clock that is a minute slow, not an expired
    credential.
    """
    try:
        signing_key = _jwks_client(settings.google_jwks_url).get_signing_key_from_jwt(value)
        claims = jwt.decode(
            value,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            options={
                "require": ["exp", "iat", "aud", "iss", "sub"],
                "verify_iss": False,
            },
            leeway=60,
        )
    except jwt.PyJWTError as exc:
        raise GoogleAuthError("the identity token did not verify") from exc
    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise GoogleAuthError("the identity token named another issuer")
    presented_nonce = str(claims.get("nonce") or "")
    if not nonce or not hmac.compare_digest(presented_nonce, nonce):
        raise GoogleAuthError("the identity token did not carry this sign-in's nonce")
    if not isinstance(claims.get("sub"), str) or not claims["sub"]:
        raise GoogleAuthError("the identity token named no subject")
    return claims


# ------------------------------------------------------------------------ the routes


@router.get("/status", response_model=GoogleStatusOut)
def google_status() -> GoogleStatusOut:
    """Whether this server can complete a sign-in, asked before anything is clicked."""
    return GoogleStatusOut(configured=get_settings().google_configured)


@router.get("/start")
@auth_limit
def google_start(
    request: Request,
    role: str | None = None,
    consent: str = "",
    device_id: str | None = None,
) -> RedirectResponse:
    """Send the browser to Google with a state, a PKCE challenge and a nonce.

    `consent=1` is the page's own notice, carried into the request so a server that
    never saw the notice cannot be asked to create an account. `role` decides only
    what a *new* account is; it is signed into the state cookie and never read from a
    query string on the way back.
    """
    settings = get_settings()
    if not settings.google_configured:
        raise HTTPException(
            status_code=503,
            detail=(
                "Google sign-in is not configured on this server. Set GOOGLE_CLIENT_ID, "
                "GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to enable it."
            ),
        )
    if consent != "1":
        raise HTTPException(
            status_code=400,
            detail="Please read and accept the privacy note before continuing with Google.",
        )

    chosen = role if role in {"student", "parent"} else None
    # A device id that is not the shape this app mints is dropped rather than stored:
    # the state cookie is not the place to carry arbitrary text into a later request.
    device = device_id if device_id and TOKEN_SHAPE.fullmatch(device_id) else None

    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = _b64(hashlib.sha256(verifier.encode("ascii")).digest())
    nonce = secrets.token_urlsafe(32)

    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": SCOPES,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "nonce": nonce,
            "prompt": "select_account",
        }
    )
    response = RedirectResponse(f"{settings.google_auth_url}?{query}", status_code=303)
    _issue_state(
        request,
        response,
        settings=settings,
        state=state,
        verifier=verifier,
        nonce=nonce,
        role=chosen,
        device_id=device,
    )
    return response


def _session_user(request: Request, db: Session) -> User | None:
    """Who this browser is already signed in as, read the same way every route does.

    Only the cookie is considered: this request is a top-level redirect from Google, so
    there is no `Authorization` header to read. A token that cannot be shaped like one
    this server issued is ignored rather than looked up.
    """
    raw = session_cookie_value(request)
    if not raw or not TOKEN_SHAPE.fullmatch(raw):
        return None
    record = db.get(AuthToken, token_hash_of(raw))
    if record is None or record.expires_at < datetime.now(timezone.utc):
        return None
    user = db.get(User, record.user_id)
    if user is None or not user.is_active or user.erased_at is not None:
        return None
    return user


def _display_name(claims: dict, role: str) -> str:
    """A first name is enough, and guessing one is better than asking for a surname.

    Google's `given_name` is the profile field that matches this app's rule — a first
    name or nickname, never a full legal name. When it is absent the full `name` is
    trimmed to the same column width, and when both are absent the account is called
    what the previous onboarding screen would have called it.
    """
    for claim in ("given_name", "name"):
        value = claims.get(claim)
        if isinstance(value, str) and value.strip():
            return value.strip()[:80]
    return "Parent" if role == "parent" else "Student"


def _finish_to_login(request: Request, code: str) -> RedirectResponse:
    """A refusal the browser can see: back to the login page, with a code not a story.

    The detail of *why* stays in the server log. A page that printed "audience mismatch"
    would help somebody probing the callback and would mean nothing to the family
    reading it.
    """
    origin = frontend_origins(get_settings().frontend_url)[0]
    response = RedirectResponse(f"{origin}/login?error={code}", status_code=303)
    _clear_state(request, response)
    return response


@router.get("/callback")
def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    settings = get_settings()
    if not settings.google_configured:
        return _finish_to_login(request, "google_unavailable")

    try:
        pending = _read_state(request, settings)
    except GoogleAuthError as exc:
        log.info("Google sign-in refused: %s", exc)
        return _finish_to_login(request, "google_state")

    if error:
        # `access_denied` is a person changing their mind on Google's screen, which is
        # not an error this app should phrase as a failure.
        log.info("Google sign-in did not complete: %s", error)
        return _finish_to_login(request, "google_cancelled" if error == "access_denied" else "google_failed")

    if not code or not state or not hmac.compare_digest(state, pending["s"]):
        log.warning("Google sign-in refused: state did not match this browser's")
        return _finish_to_login(request, "google_state")

    try:
        tokens = _exchange_code(code, pending["v"], settings)
        claims = _verify_id_token(tokens["id_token"], pending["n"], settings)
    except GoogleAuthError as exc:
        log.warning("Google sign-in refused: %s", exc)
        return _finish_to_login(request, "google_failed")

    subject = claims["sub"]
    now = datetime.now(timezone.utc)
    user = db.scalars(select(User).where(User.google_sub == subject).limit(1)).first()

    if user is not None:
        if not user.is_active or user.erased_at is not None:
            log.warning("Google sign-in refused: the linked account is not active")
            return _finish_to_login(request, "google_unavailable")
        # The account decides the role. Nothing from the URL, and nothing from the
        # state cookie, is allowed to change a role that already exists.
    else:
        # An existing session, or the device id that already *is* an account's
        # credential, is what may attach a Google identity to a row. A Google account
        # alone never reaches somebody else's work.
        current = _session_user(request, db)
        if current is None and pending.get("d"):
            current = device_owner(db, pending["d"], active_only=True)

        if current is not None:
            if current.google_sub and current.google_sub != subject:
                log.warning("Google sign-in refused: this account already has another Google identity")
                return _finish_to_login(request, "google_conflict")
            if not current.is_active or current.erased_at is not None:
                return _finish_to_login(request, "google_unavailable")
            current.google_sub = subject
            current.google_linked_at = now
            user = current
        else:
            role = pending.get("r") if pending.get("r") in {"student", "parent"} else "student"
            user = User(
                role=role,
                display_name=_display_name(claims, role),
                preferred_language="hinglish",
            )
            db.add(user)
            db.flush()
            if role == "student":
                # The shell the rest of the app expects, including the sharing code a
                # parent would need. Class, age and interests are not asked for here;
                # the guide learns them inside the conversation.
                db.add(
                    StudentProfile(
                        user_id=user.id,
                        share_code=new_share_code(db),
                        interest_areas=[],
                    )
                )
            # The notice on the login page is the consent this row records. It is the
            # same scope the old onboarding form wrote, and it can be withdrawn from
            # Settings exactly as before.
            db.add(
                ConsentRecord(
                    user_id=user.id,
                    scope="profile",
                    granted=True,
                    note="Consent given on the Google sign-in page before the account was created.",
                )
            )
            db.add(UserSettings(user_id=user.id, language="hinglish"))
            user.google_sub = subject
            user.google_linked_at = now

    if pending.get("d") and user.device_hash is None:
        claim = device_owner(db, pending["d"])
        if claim is None or claim.id == user.id:
            user.device_hash = device_hash_of(pending["d"])
    db.commit()

    origin = frontend_origins(settings.frontend_url)[0]
    response = RedirectResponse(f"{origin}/auth/google/finish", status_code=303)
    # The session is minted on this response so the cookie lands in the same hop that
    # returns the browser to the app. The finish page then reads it — or falls back to
    # the device id, for a browser that refuses the cross-site cookie.
    start_session(request, response, db, user)
    _clear_state(request, response)
    return response
