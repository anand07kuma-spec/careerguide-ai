"""Bearer-token auth and server-side ownership checks.

Authorisation is enforced here, not in the frontend: a request can never reach
another family's data by substituting an id, because the student is always
resolved from the caller's own token.

There is no JWT here, on purpose. A session is 32 random bytes held by the browser — in a
cookie the page cannot read, and in a header for clients that name one — and looked up in
`auth_tokens`, which buys two things a signed token does not: a session can be ended from
the server the moment a child deletes their transcript, and there is no signing key on this
server to leak or to rotate. Verifying an email sign-in against Clerk is a different question
and lives in `services/clerk.py`.

There is one admin here, and it is not a role a person can sign up into: `is_admin` is a
column set by `scripts/admin_grant.py` on a database somebody already owns, and
`get_admin_user` below is the only thing that reads it.

A *school* has administrators too, and they are not that. `school_admin` and `counsellor`
are roles inside one organisation, held on a `memberships` row and checked by
`require_membership` at the bottom of this file. Neither grants anything outside that
organisation, neither can be asked for in a request body, and no route hands either to an
account that has not accepted an invite. `is_admin` stays the platform's own flag and the
only thing that opens an `/admin/` route.

What is stored, and what is not: a session token and a device id are both kept as sha256
digests, so reading this table no longer hands over a live session or the id that opens the
guest handshake. The token the browser holds is still exactly that — a bearer string the
browser will send to this API whatever page it was loaded from — so a copied token still
works until its day is up, and a device id copied out of a browser still reopens that
account. That is what the short window is for: a session now lasts a day of quiet rather
than a month, is extended only while it is in use, and stops being extendable thirty days
after the sign-in that started it. Where the token lives is the other half of the same
problem, and it is closed: a browser keeps its session in an `httpOnly` cookie set below,
which page script cannot read, so an XSS bug in the frontend is no longer a way to harvest
children's sessions. What no storage can fix is a token handed over by its own owner — a
student who pastes the value from `Set-Cookie` into a chat — and that is what the day is for.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import AuthToken, Guardianship, Membership, Organization, User, UserSettings

CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Please sign in again to continue.",
    headers={"WWW-Authenticate": "Bearer"},
)

# ------------------------------------------------------------------ come-back codes

# Read out loud or typed by a child, so no look-alike characters: no I, O, 0 or 1.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 15
# Stretched over ~100 ms per guess, which is what makes an online attack pointless
# without needing a rate limiter that serverless hosting can't keep honest anyway.
CODE_ITERATIONS = 210_000

BAD_CODE = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail=(
        "That code does not match an account. Codes never contain O, I, 0 or 1, so "
        "those letters may have been mistaken for a number."
    ),
)


def normalize_code(value: str) -> str:
    """Groups and case don't matter: ABCDE-FGHIJ-KLMNO is one code."""
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def format_code(code: str) -> str:
    """Shown in groups of five, which is far easier to copy by hand."""
    return "-".join(code[i : i + 5] for i in range(0, len(code), 5))


def new_code() -> str:
    # 15 characters over a 32-symbol alphabet is ~75 bits of entropy.
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def _code_index(normalized: str) -> str:
    # A deterministic lookup key, not the proof: it only says which row to check.
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:48]


def _hash_code(normalized: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", normalized.encode("utf-8"), salt, CODE_ITERATIONS)
    return f"pbkdf2_sha256${CODE_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_code(normalized: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        scheme, iterations, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256", normalized.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
    )
    return hmac.compare_digest(digest.hex(), digest_hex)


def set_code_for(db: Session, user: User) -> str:
    """Mint (or replace) the account's come-back code and return it in plaintext.

    This is the only moment the code exists as text on the server, so the caller
    has to show it immediately — it cannot be retrieved later.
    """
    code = new_code()
    user.comeback_index = _code_index(code)
    user.comeback_hash = _hash_code(code)
    db.commit()
    return code


def find_account_by_code(db: Session, value: str) -> User:
    normalized = normalize_code(value)
    if len(normalized) != CODE_LENGTH:
        raise BAD_CODE
    user = db.scalars(
        select(User).where(User.comeback_index == _code_index(normalized)).limit(1)
    ).first()
    if user is None or not user.is_active or not verify_code(normalized, user.comeback_hash):
        raise BAD_CODE
    return user


# ----------------------------------------------------------- the two browser values
#
# A request carries two things that this server uses to find a row: a device id, which
# answers "which account did this browser make", and a session token, which answers "may
# this request through". Both are credentials — one opens the guest handshake, the other
# opens everything after it — so neither is kept in the form it arrives in.
#
# An unsalted sha256 is the right tool here and the wrong tool for a come-back code, and
# the difference is entropy. A device id is 36 characters from `crypto.randomUUID()` and a
# session token is 32 random bytes: neither can be guessed, so a digest is a lookup key
# that reveals nothing, and the same is true of `_code_index` for the same reason. A
# come-back code is read out loud by a child and typed by hand, so it gets salted PBKDF2
# and 210,000 iterations above. What a hash buys is not secrecy from the browser that
# holds the value — it is that a database read, a `SELECT *` in an incident, a dump that
# leaves the machine, or a hosted provider's query log stops being a way to become any
# signed-in child on the site.

def device_hash_of(device_id: str) -> str:
    return hashlib.sha256(device_id.encode("utf-8")).hexdigest()


def token_hash_of(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_token(db: Session, user_id: int) -> str:
    """Start a session and return the only ever-plaintext copy of its token.

    The row keeps a digest, so the returned string exists in exactly two places after
    this returns: this response, and whatever the browser stored it in. Nothing on the
    server can read it back — which is why a session can be ended by whoever holds it and
    quietly rotated, but never resurrected from the database.
    """
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    db.add(
        AuthToken(
            token_hash=token_hash_of(token),
            user_id=user_id,
            expires_at=datetime.now(timezone.utc)
            + timedelta(hours=settings.session_token_ttl_hours),
        )
    )
    db.commit()
    return token


# --------------------------------------------------------------- the session cookie
#
# Two mechanisms deliver the same credential, and both stay because they serve different
# callers. A browser gets an `httpOnly` cookie it cannot read from page script; anything
# else — every script in `scripts/`, the mail worker, a curl on a laptop — names the token
# in an `Authorization` header. When a request carries both, the header wins: it is the
# credential the caller wrote out on purpose, and answering it from a jar that happens to
# hold an older session would be the quieter and worse failure.
#
# `Path=/` and no `Domain` on purpose. A host-only cookie is the narrower promise: putting
# a domain here would hand a child's session to every subdomain of the deployment,
# including ones nobody owns and none of which serve this API.


def cookie_is_secure(request: Request | None) -> bool:
    """Whether this cookie may carry `Secure`, decided by the request rather than by a setting.

    `X-Forwarded-Proto` is read without a trust flag, which is the opposite of the rule the
    rate limiter and the tenant middleware follow, and the asymmetry is why. Believing a
    forged "https" can only ever make the cookie *more* protected — and on a plain-http
    instance it then breaks that instance's login loudly, because a browser drops a `Secure`
    cookie it received over http. Ignoring the header on a real https deployment behind a
    proxy that does not set it is the silent half, so `AUTH_COOKIE_SECURE=true` covers that
    case by hand.
    """
    settings = get_settings()
    if settings.auth_cookie_secure == "true":
        return True
    if settings.auth_cookie_secure == "false":
        return False
    if request is None:
        return settings.public_site_url.lower().startswith("https://")
    forwarded = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    if forwarded:
        return forwarded == "https"
    if request.url.scheme == "https":
        return True
    # `localhost`, `127.0.0.1` and the `*.localhost` hosts the tenant portals use in
    # development are trustworthy origins to every current browser, and a dev server here
    # is plain http — without this, the whole site would run with nobody signed in.
    host = (request.url.hostname or "").lower()
    return host in {"localhost", "127.0.0.1", "[::1]"} or host.endswith(".localhost")


def cookie_samesite(secure: bool) -> str:
    """The mode this browser will actually accept.

    `SameSite=None` without `Secure` is not a looser cookie — it is a cookie the browser
    throws away and a login that silently never happened. So an instance where `Secure`
    cannot be honoured gets `Lax` instead, which still works for a page on
    `http://careerguide.localhost:3000` calling `http://localhost:8000` (a cookie's "site"
    ignores port and scheme) and which is the right answer for any single-origin deployment.
    `Strict` is never produced from here: a strict cookie is not attached to a cross-origin
    fetch at all, and every hosted version of this app is cross-origin.
    """
    mode = get_settings().auth_cookie_samesite
    if mode == "none" and not secure:
        return "lax"
    return mode


def attach_session_cookie(
    request: Request, response: Response, token: str, expires_at: datetime | None = None
) -> None:
    """Put a session where page script cannot reach it.

    The cookie's own lifetime mirrors the session row's rather than a constant, because the
    two must not disagree: a cookie that outlives its row is a browser faithfully sending a
    value that answers 401, and a cookie that dies first silently signs a child out of a
    session the server still considers live. `expires_at` is what `/api/auth/refresh` passes
    so the cookie rolls with the session; a freshly minted one just gets the TTL.
    """
    settings = get_settings()
    seconds = settings.session_token_ttl_hours * 3600
    if expires_at is not None:
        remaining = int((expires_at - datetime.now(timezone.utc)).total_seconds())
        seconds = max(60, min(seconds, remaining))
    secure = cookie_is_secure(request)
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=seconds,
        path="/",
        secure=secure,
        httponly=True,
        # Capitalised on the way out: a browser matches the value case-insensitively, but
        # `SameSite=None` is the form every proxy, log and security scanner shows, and a
        # policy that reads like the specification is one a reviewer can check by eye.
        samesite=cookie_samesite(secure).capitalize(),  # type: ignore[arg-type]
    )


def clear_session_cookie(request: Request, response: Response) -> None:
    """Expire the cookie with the attributes it was set with.

    A deletion has to match the original `Path` (and `Secure`/`SameSite`, which browsers also
    compare) or the browser keeps the live copy and signs the child back in on the next page
    load — which is exactly the outcome `logout` exists to prevent.
    """
    settings = get_settings()
    secure = cookie_is_secure(request)
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path="/",
        secure=secure,
        httponly=True,
        samesite=cookie_samesite(secure).capitalize(),  # type: ignore[arg-type]
    )


def session_cookie_value(request: Request) -> str | None:
    """The session this browser holds in its jar, if it holds one.

    `/api/auth/refresh` needs the value to write the cookie again with the session's new
    expiry, and needs to know whether there is a cookie to write at all: a caller that
    authenticated with a header has no jar to keep in step, and minting one for it would
    be a second credential nobody asked for.
    """
    value = (request.cookies.get(get_settings().auth_cookie_name) or "").strip()
    return value or None


# A session token is only ever something this file issued: 32 random bytes written
# as a URL-safe string, which is 43 characters of letters, digits, dash and
# underscore. Checking the shape before the lookup means the database is never
# asked about a header that could not have come from here — including a device id,
# which is the value people most often try.
TOKEN_SHAPE = re.compile(r"[A-Za-z0-9_-]{20,64}")


def _bearer_or_raise(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise CREDENTIALS_EXC
    raw = authorization.split(" ", 1)[1].strip()
    if not TOKEN_SHAPE.fullmatch(raw):
        raise CREDENTIALS_EXC
    return raw


def _presented_token(request: Request, authorization: str | None) -> str:
    """The session this request claims: its header if it wrote one, else its cookie.

    A header that is present but unusable is a refusal, not a cue to try the jar. Falling
    back there would mean a typo in an `Authorization` line silently authenticates as
    whoever the browser also happens to be, and the caller would never know which of the
    two the answer came from.
    """
    if authorization:
        return _bearer_or_raise(authorization)
    cookie = (request.cookies.get(get_settings().auth_cookie_name) or "").strip()
    if cookie and TOKEN_SHAPE.fullmatch(cookie):
        return cookie
    raise CREDENTIALS_EXC


def get_current_session(
    request: Request,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthToken:
    """The session row behind this request, or a 401.

    Its own dependency because two things need the *session* rather than the person:
    `/api/auth/refresh`, which moves an expiry, and any answer to "when was this
    sign-in minted". `get_current_user` is built on this, so every route that reads a
    user gets the same lookup and the same expiry check.
    """
    record = db.get(AuthToken, token_hash_of(_presented_token(request, authorization)))
    if record is None or record.expires_at < datetime.now(timezone.utc):
        raise CREDENTIALS_EXC
    return record


def renew_session(db: Session, record: AuthToken) -> AuthToken:
    """Push this session's expiry out, but never past the ceiling for that sign-in.

    Rolling with a cap, because the two failure modes are equally bad. A flat 24 hours
    would cut a child off in the middle of a questionnaire they started this morning;
    an unlimited roll would turn a session into a permanent credential that merely
    happens to carry a date. So: a day of quiet ends the session, and a month of
    continuous use ends it too, whichever comes first.

    At the ceiling it changes nothing and returns the row as it stands, which is the
    signal the caller turns into words — "this sign-in has reached its limit", not a
    silent extension.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    extends_to = now + timedelta(hours=settings.session_token_ttl_hours)
    if record.created_at is not None:
        ceiling = record.created_at + timedelta(hours=settings.session_absolute_ttl_hours)
        if extends_to > ceiling:
            extends_to = ceiling
    if record.expires_at is not None and extends_to <= record.expires_at:
        return record
    record.expires_at = extends_to
    db.commit()
    db.refresh(record)
    return record


def get_current_user(
    record: AuthToken = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise CREDENTIALS_EXC
    # Rolling renewal happens here rather than only on the refresh route, because a
    # student who never leaves the app should not be signed out by a clock they cannot
    # see. It is written only for the last half of the window, so the database sees at
    # most one extra UPDATE per session per half-TTL rather than one per request.
    settings = get_settings()
    if record.expires_at - datetime.now(timezone.utc) < timedelta(
        hours=settings.session_token_ttl_hours / 2
    ):
        renew_session(db, record)
    return user


def revoke_session(db: Session, raw_token: str) -> None:
    """End a session on the server, from the token as the browser holds it."""
    record = db.get(AuthToken, token_hash_of(raw_token))
    if record is not None:
        db.delete(record)
        db.commit()


def device_owner(db: Session, device_id: str, *, active_only: bool = False) -> User | None:
    """Whose account this browser's device id belongs to, if anyone's.

    Compared on the digest, so the plaintext id is never a value this database holds or
    matches against. What a database reader gets from `users` is therefore not a list of
    credentials for the guest handshake.
    """
    clause = User.device_hash == device_hash_of(device_id)
    query = select(User).where(clause)
    if active_only:
        query = query.where(User.is_active.is_(True))
    return db.scalars(query.order_by(User.id).limit(1)).first()



def get_raw_token(request: Request, authorization: str | None = Header(default=None)) -> str:
    """The session string itself, for the one route that must revoke it.

    Read the same way every other authenticated route reads it, so signing out of a cookie
    session ends that session rather than refusing with a 401 first.
    """
    return _presented_token(request, authorization)


def get_student_user_id(user: User) -> int:
    """Students act on themselves; parents act on their linked child."""
    if user.role == "student":
        return user.id
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="This area is for a student account. Open the parent dashboard instead.",
    )


def require_student(user: User = Depends(get_current_user)) -> int:
    return get_student_user_id(user)


def require_parent(user: User = Depends(get_current_user)) -> User:
    if user.role != "parent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This area is only available to a parent or guardian account.",
        )
    return user


# ------------------------------------------------------------------------ admin

NOT_ADMIN = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail=(
        "This screen belongs to whoever runs the site, and this account is not that. "
        "The flag is set in the database by scripts/admin_grant.py; there is no way to "
        "ask for it from a page."
    ),
)


def get_admin_user(user: User = Depends(get_current_user)) -> User:
    """The one dependency every admin route is built on.

    It is a dependency rather than a check inside each route so that forgetting it is
    impossible in the common way — a route without it cannot get a user at all. What it
    checks is the `is_admin` column and nothing else: not a role in a token, not a
    header, not a claim a client can make. NULL counts as not-an-admin, which is what
    makes widening an existing database safe: every account that predates the flag is
    refused by it.

    `is_active` is checked by `get_current_user` already, so a closed account cannot
    reach this even with the flag set.
    """
    if not user.is_admin:
        raise NOT_ADMIN
    return user


def linked_student_ids(db: Session, parent_id: int) -> list[int]:
    return list(
        db.scalars(
            select(Guardianship.student_id).where(Guardianship.parent_id == parent_id)
        )
    )


def resolve_child(db: Session, parent: User, student_id: int) -> int:
    """A parent may only ever address a student explicitly linked to them."""
    if student_id not in linked_student_ids(db, parent.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No linked child profile was found for this account.",
        )
    return student_id


def ensure_settings(db: Session, user_id: int) -> UserSettings:
    existing = db.get(UserSettings, user_id)
    if existing is not None:
        return existing
    created = UserSettings(user_id=user_id)
    db.add(created)
    db.commit()
    db.refresh(created)
    return created


# --------------------------------------------------------------- organisations

# Everything below is the same ownership check the student routes have always done — a
# caller can only ever address their own half of the data — applied to a school or a
# practice. Two properties carry through all of it:
#
# * **A role is read off the membership row, never off the request.** No route takes an
#   `org_role`, and the bearer string carries nothing but a pointer to a user. Changing
#   one's own role is not a thing a member can ask for; it is written by a member who
#   already holds the right to add it, or by the accept route for the kind that was
#   invited.
# * **An `invited` membership is not a membership.** Every function here asks for
#   `status = "active"`, so an organisation that has invited a class and been ignored has
#   no route through which it can read that class. That is the one rule the whole portal
#   feature is built on, and it is enforced in these eight functions rather than in each
#   caller remembering it.

NO_ORGANIZATION = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail=(
        "No portal by that name is open here. A school's address is spelled in lower "
        "case with hyphens, and a portal the platform has closed answers the same way."
    ),
)

NOT_A_MEMBER = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail=(
        "This account is not a member of that organisation. An invitation opens nothing "
        "until the person it was sent to accepts it from their own browser - that is "
        "deliberate, and there is no route that lets a school accept on a student's "
        "behalf."
    ),
)

WRONG_ROLE = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail=(
        "Your place in that organisation does not include this. A school's roster, "
        "invites and settings are managed by its administrators; a counsellor sees the "
        "clients assigned to them."
    ),
)

STAFF_ROLES = ("school_admin", "counsellor")


def invite_digest(token: str) -> str:
    """The lookup key for an invite link: a digest of the token, never the token.

    Same reasoning as `users.email_confirm_hash` — a row that held the plaintext token
    would be a row from which a single UPDATE could hand somebody a membership without
    going through the route that checks who is asking.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_organization(db: Session, slug: str) -> Organization:
    org = db.scalars(
        select(Organization).where(Organization.slug == slug, Organization.is_active.is_(True))
        .limit(1)
    ).first()
    if org is None:
        raise NO_ORGANIZATION
    return org


def active_membership(db: Session, org_id: int, user_id: int) -> Membership | None:
    """This account's own place in that organisation, if it has joined it."""
    return db.scalars(
        select(Membership)
        .where(
            Membership.organization_id == org_id,
            Membership.user_id == user_id,
            Membership.status == "active",
        )
        .limit(1)
    ).first()


def memberships_of(db: Session, user_id: int) -> list[Membership]:
    """Every organisation this account has joined, for the app shell to offer."""
    return list(
        db.scalars(
            select(Membership)
            .where(Membership.user_id == user_id, Membership.status == "active")
            .order_by(Membership.joined_at)
        )
    )


def require_membership(
    db: Session, user: User, slug: str, roles: tuple[str, ...] | None = None
) -> tuple[Organization, Membership]:
    """The organisation named in the path, and this account's membership in it.

    `roles` narrows the call to the members who may make it. Passing nothing means "any
    joined member", which is what a portal's own front page needs: a student is allowed
    to see that they are on the school's list, they simply cannot see anyone else's.
    """
    org = get_organization(db, slug)
    membership = active_membership(db, org.id, user.id)
    if membership is None:
        raise NOT_A_MEMBER
    if roles is not None and membership.org_role not in roles:
        raise WRONG_ROLE
    return org, membership


def require_staff(db: Session, user: User, slug: str) -> tuple[Organization, Membership]:
    """A counsellor or an administrator of this organisation.

    Both may list members and write notes; what they may *read* about a child is decided
    by `client_is_visible` below, not by this function.
    """
    return require_membership(db, user, slug, STAFF_ROLES)


def can_manage(org: Organization, membership: Membership) -> bool:
    """Whether this member runs the organisation, as opposed to working inside it.

    An administrator of a school is obvious. A counsellor who owns a practice is less so,
    and needs it: the brief's "custom branding" and "bulk invite" are the owner's own
    tools, and a solo practice whose owner cannot rename it or change its colour is a
    feature that does not work. The two roles are not merged, though — a counsellor
    *employed by a school* fails this test, because `org.kind` is `school` there, which
    is what keeps their power over the branding, the roster and the seats with the school.
    """
    if membership.org_role == "school_admin":
        return True
    return org.kind == "counsellor" and membership.org_role == "counsellor"


def require_admin(db: Session, user: User, slug: str) -> tuple[Organization, Membership]:
    """Whoever is allowed to invite, assign, or change a portal's name and look.

    Staff roles only, so that a student member asking to rename their school is refused
    for being a student rather than for a reason that reads like a bug.
    """
    org, membership = require_membership(db, user, slug, STAFF_ROLES)
    if not can_manage(org, membership):
        raise WRONG_ROLE
    return org, membership


def client_is_visible(org: Organization, viewer: Membership, client: Membership) -> bool:
    """Whether one member of an organisation may see another member's roster row.

    The three cases are the three things a school and a practice actually are:

    * **Nobody sees nobody while they are still `invited`.** Checked first, and the only
      answer a `school_admin` gets about a student who has not accepted is that a place
      is reserved — which is why the roster screen reads from `display_label` and not
      from anything else.
    * **An administrator sees their own organisation's members.** A school runs the
      roster it was given; a practice with several counsellors has to be able to see the
      whole client list in order to assign it.
    * **A counsellor in a school sees only the students assigned to them.** A school that
      hands a counsellor four children has not handed over the other three hundred, and
      the assignment lives on the child's own row. A counsellor in a *practice* sees that
      practice's clients, because being a member of it is what "their client" means
      there.
    """
    if client.status != "active":
        return False
    # A student or a guardian never reads another member's row, in either kind of
    # organisation. Without this line the two branches below would answer "yes" to a
    # joined student asking about the class.
    if viewer.org_role not in STAFF_ROLES:
        return False
    if viewer.org_role == "school_admin":
        return True
    if org.kind == "counsellor":
        return client.org_role in ("student", "parent")
    return client.assigned_counsellor_id == viewer.id
