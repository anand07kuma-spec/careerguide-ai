"""Throttling, with slowapi.

Two guards, covering different risks:

* **Named buckets on the routes that cost something.** A conversation message and a
  spoken reply each cost a call to an outside AI service, a questionnaire sitting costs
  marking work, the sign-in routes are the only places an attacker gets to make unlimited
  guesses at something secret, and the routes that create a portal, an invitation or a
  payment either spend money or change something a child will be shown. Each gets its own
  rule below.
* **One shared bucket on every other request** (`RATE_LIMIT_READ`, sixty a minute), so a
  stolen session cannot quietly page through a whole database. It is deliberately a brake
  on a script rather than on a student: sixty reads a minute is one screen a second, and
  no keyboard works that fast. The routes a page load or a server render depends on, and
  every route that answers the same for a stranger as for the family, are exempt — see
  `_READ_EXEMPT`.

Two things a reader should know before trusting this file:

* **The counter lives in this process's memory** unless `RATE_LIMIT_REDIS_URL` is set.
  One instance, honest limits. Serverless hosting starts several instances and a visitor
  can be routed between them, so the real ceiling on a hosted deployment is the rule times
  however many instances are warm. It is a brake, not a wall — which is why the come-back
  code is stretched through 210,000 PBKDF2 rounds in `security.py` instead of relying
  on this file to stop guessing.
* **A write bucket is keyed on the bearer header or the address, never on the session
  cookie.** A school or a family behind one router would otherwise be limited as if it
  were one student — but a cookie is a string the caller types, so a bucket that believed
  it is a bucket a script can refill at will (`client_identity`). Where there is no bearer
  yet, it falls back to the address, and to the *socket's* address unless
  `RATELIMIT_TRUST_FORWARDED_FOR` is set, because a header anyone can write is a header
  anyone can use to jump the queue.
* **The read bucket does honour the session cookie** (`read_identity`), because reading is
  where forty students behind one school router would otherwise queue together, and an
  invented session there buys the caller a fresh bucket of 401s rather than anybody's data.

A throttled request answers 429 with a sentence a family can act on, never with
slowapi's "Rate limit exceeded: 20 per 1 minute".
"""

from __future__ import annotations

import hashlib
import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from limits import parse
from limits.strategies import FixedWindowRateLimiter
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from ..config import get_settings
from ..security import TOKEN_SHAPE

log = logging.getLogger(__name__)


def _digest(value: str) -> str:
    return "session:" + hashlib.sha256(value.encode("utf-8")).hexdigest()[:32]


def _presented_bearer(request: Request) -> str:
    authorization = (request.headers.get("authorization") or "").strip()
    if authorization.lower().startswith("bearer "):
        raw = authorization.split(" ", 1)[1].strip()
        if raw:
            return _digest(raw)
    return ""


def _address(request: Request) -> str:
    if get_settings().rate_limit_trust_forwarded_for:
        forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        if forwarded:
            return "address:" + forwarded
    return "address:" + get_remote_address(request)


def client_identity(request: Request) -> str:
    """Whoever wrote a bearer string gets their own bucket; anyone else shares the address
    bucket, which is the best that can be done before a token exists.

    Deliberately blind to the session cookie, even though the cookie is what a browser
    normally sends. A cookie is a string the caller types, not a proof: a script rotating
    `cg_session=<random 43 characters>` per request would get a fresh bucket for every
    guess at a come-back code, a fresh quota for every invitation it mails, and a fresh
    room in which to hammer `/api/email`. Addressing is the only key it cannot forge, so
    every bucket that guards a *write* stays keyed on it. Reads get their own function —
    see `read_identity`.
    """
    return _presented_bearer(request) or _address(request)


def read_identity(request: Request) -> str:
    """Whose read budget this request spends: the session it presents, cookie included.

    Reading is the case the address bucket was never meant for. A school behind one NAT
    has forty students loading their own dashboards, and a per-address queue of sixty
    reads a minute would punish all forty for one classroom opening a page at once — the
    exact failure this module's docstring says the session key exists to prevent.

    Forgery costs nothing here, which is why this one can trust the cookie where
    `client_identity` cannot. A request that invents a session-shaped cookie gets a fresh
    bucket *and a 401*, because it holds no session: every route whose answer depends on
    who is asking is authenticated, and the routes that answer the same for anyone are
    exempt from this bucket anyway (`_READ_EXEMPT`).
    """
    presented = _presented_bearer(request)
    if presented:
        return presented
    # The header is checked first because that order is what `security._presented_token`
    # does, and a bucket that disagrees with the credential that will actually be believed
    # is a bucket someone else's jar can spend.
    cookie = (request.cookies.get(get_settings().auth_cookie_name) or "").strip()
    if cookie and TOKEN_SHAPE.fullmatch(cookie):
        return _digest(cookie)
    return _address(request)


_settings = get_settings()

# Blank means `memory://`, which is what this file has always been: one process, its
# own counters. A Redis URL is only worth setting when the API runs as several workers
# or several containers — see `RATE_LIMIT_REDIS_URL` in `app/config.py`.
_REDIS = _settings.rate_limit_redis_url.strip()

limiter = Limiter(
    key_func=client_identity,
    # The rules are per route below, so nothing is added automatically to every
    # request; a default limit would throttle a page load nobody asked for. The read
    # bucket further down does cover every GET that has no rule of its own — as its own
    # counter over this limiter's storage, because putting it here instead would also put
    # `/api/health` behind the queue it is meant to diagnose.
    default_limits=[],
    # A throttle response says nothing useful to the browser, and how much room a
    # caller has left is information about the guard rather than about their own
    # work — so no X-RateLimit-* headers, and endpoints need no `response` param.
    headers_enabled=False,
    enabled=_settings.rate_limit_enabled,
    key_prefix="careerguide",
    storage_uri=_REDIS or "memory://",
    # A Redis that is down, mid-restart, or wrong in the environment must not turn
    # into a 500 in front of a student who is only trying to send a message. The
    # counters fall back to this process — the old behaviour, and a weaker guard, which
    # is why the deployment screen reports which of the two is actually running.
    #
    # `in_memory_fallback` is deliberately left alone: slowapi reads that list as
    # *limit strings* to substitute, not as storage URLs. Passing it the Redis URL
    # here made every throttled route raise `couldn't parse rate limit string`, which
    # is a worse outage than the one the fallback exists to avoid.
    in_memory_fallback_enabled=bool(_REDIS),
)

if _REDIS:
    log.info("Rate limit counters are held in Redis, so every worker shares them.")
else:
    log.info("Rate limit counters live in this process's memory.")


def _rule(attribute: str, fallback: str) -> str:
    return getattr(get_settings(), attribute) or fallback


# One decorator per area, each with the sentence its caller will see. A student who
# is typing fast must not feel blamed, and must not lose work they were told to do.
chat_limit = limiter.limit(
    _rule("rate_limit_chat", "20 per minute"),
    error_message=(
        "That was a lot of messages at once. Give it a minute and send it again — "
        "nothing you wrote has been lost."
    ),
)
speak_limit = limiter.limit(
    _rule("rate_limit_speak", "20 per minute"),
    error_message=(
        "Too many requests to read text aloud at once. Wait a minute, or turn "
        "spoken replies off for a while in Settings."
    ),
)
assessment_limit = limiter.limit(
    _rule("rate_limit_assessment", "10 per minute"),
    error_message=(
        "The questionnaires are being asked about a lot right now. Wait a minute "
        "and start or finish your sitting — answers already given are saved."
    ),
)
# A sitting saves every answer as it is chosen, and the longest questionnaire has
# thirty items, so this bucket has to fit a whole sitting in one minute plus a
# retry. Ten would cut a quick student off mid-test, which is the failure this
# guard must never cause.
answer_limit = limiter.limit(
    _rule("rate_limit_answer", "40 per minute"),
    error_message=(
        "Answers are coming faster than they can be saved. Pause for a moment — "
        "everything saved so far is still here."
    ),
)
auth_limit = limiter.limit(
    _rule("rate_limit_auth", "5 per minute"),
    error_message=(
        "Too many attempts in a minute. Wait a moment and try again. If this "
        "device belongs to more than one person, that is likely why."
    ),
)
guest_limit = limiter.limit(
    _rule("rate_limit_guest", "30 per minute"),
    error_message=(
        "This page asked for the account too many times in a minute. Wait a "
        "moment and reload — nothing has been lost."
    ),
)
# Only the two routes that talk to the payment provider. `GET /api/payments/plans`
# is deliberately not throttled: it is the static price list the public pricing page
# reads, and a school's shared network would trip a per-caller bucket just by opening
# the page. The webhook is not throttled either — Razorpay retries a delivery it
# cannot get through, and a 429 there reads as a broken endpoint to the provider.
payment_limit = limiter.limit(
    _rule("rate_limit_payment", "6 per minute"),
    error_message=(
        "Too many payment attempts in a minute. Wait a moment before trying the "
        "card again — if a payment did go through, it is already on your billing "
        "page and you will not be charged twice by waiting."
    ),
)
# Everything under /api/email that can cause a message to leave the building:
# attaching an address, asking for a copy of a result, inviting a guardian. The
# confirm link route is in this bucket too and is the reason it exists — that one is
# public by necessity, since it is opened from a mail on a phone that is not signed
# in, and an unthrottled public route that spends another person's email quota is an
# open door.
email_limit = limiter.limit(
    _rule("rate_limit_email", "10 per minute"),
    error_message=(
        "That was too many email requests in a minute. Wait a moment — an address "
        "you already typed is still saved, and nothing has been sent twice."
    ),
)
# Everything under /api/organizations that *changes* a portal: starting one, renaming it,
# changing its look, adding or removing a member. This bucket is not about cost — an
# organisation row is a page a child can be sent to, and a script that could make ten of
# them a minute could dress up as ten schools.
org_limit = limiter.limit(
    _rule("rate_limit_org", "5 per minute"),
    error_message=(
        "Too many portal changes in a minute. Wait a moment and try again — the portal "
        "you already made is still there, and nothing was half-saved."
    ),
)
# The routes that create a membership, and therefore can make mail leave the building. A
# bulk invite is a single request, so this is a per-caller guard rather than a
# per-address one: it stops a script from filling a school's places with guesses, which
# would leave the real class no room and the platform paying for the stamps.
org_invite_limit = limiter.limit(
    _rule("rate_limit_org_invite", "10 per minute"),
    error_message=(
        "That was too many invitations in a minute. Wait a moment and send the rest — "
        "anyone already on the roster has not been invited twice."
    ),
)


# The public study-abroad enquiry form. There is no session in front of it, so this is
# the one bucket in the file that is genuinely per address, and it is the looser of the
# two public-write guards on purpose: a school's counselling office sending a class's
# enquiries behind one router is the normal case, not an attack.
lead_limit = limiter.limit(
    _rule("rate_limit_lead", "10 per hour"),
    error_message=(
        "Too many enquiries from this network in the last hour. Nothing was lost — "
        "if you sent one that worked, it is already with us, and one reply covers "
        "the rest."
    ),
)
# Only the operator's own *writes*. Their reads are not left wide open — they fall into
# the shared read bucket like every other authenticated route — but they are not given a
# bucket of their own, for the same reason `GET /api/payments/plans` is not: the numbers on
# a dashboard are the cheap half, and a second per-caller ceiling there would lock an
# operator out of their own screen for reloading it while a page renders. What is guarded
# here is a loop that could grant the flag to every account, close them all, or rewrite the
# question bank or the exam catalogue while a class is using it.
admin_limit = limiter.limit(
    _rule("rate_limit_admin", "10 per minute"),
    error_message=(
        "Too many changes from this account in a minute. Wait a moment and do the next "
        "one — the change you already made is saved, and nothing was half-applied."
    ),
)


# ------------------------------------------------------------------ the read bucket
#
# Every `GET` this file has not already given its own rule. Written as one bucket over the
# limiter's own storage rather than as `default_limits` on the `Limiter`, for two reasons:
# `scripts/security_test.py` asserts that nothing is throttled by default, because a
# default rule would put `/api/health` — the endpoint a person checks when everything else
# is broken — behind the same queue as the traffic that woke it up; and a default rule
# would be keyed by slowapi's route name, which a page load of server-rendered data would
# spend from one container address for every visitor at once.
_READ_RULE = parse(_rule("rate_limit_read", "60 per minute"))
_READ_RULE.namespace = "read"
# `limiter._storage` is private, and reusing it on purpose rather than calling
# `storage_from_string` again: a second `memory://` would be a second set of counters that
# quietly disagrees with the named buckets, and a second Redis URL would be a second
# connection pool for the same database.
_reads = FixedWindowRateLimiter(limiter._storage)

# Reads that are not throttled, and why. Each entry is either a route whose answer is the
# same for a stranger as for the family — so throttling it defends nothing — or a request
# an ordinary page load or server render makes on somebody else's behalf, where the caller
# is a Next.js container rather than a person and one shared bucket would be one shared
# lockout for every visitor that afternoon.
_READ_EXEMPT = (
    # Not a student's request: a monitoring call, and the first thing anyone reaches for
    # when the limits themselves are suspected of causing the outage.
    "/api/health",
    # The payment provider retries a delivery it cannot get through, and a 429 there reads
    # as a broken endpoint to them. Nothing here is a GET today; the prefix is exempt so
    # the next webhook does not arrive already throttled.
    "/api/webhooks",
    # Public catalogue, read by server-rendered pages: careers, the exam list, the
    # resources and scholarship tables, the study-abroad country and university pages.
    # `/api/careers/saved` is the one authenticated route under these prefixes, so it is
    # named back below.
    "/api/careers",
    "/api/exams",
    "/api/resources",
    "/api/scholarships",
    "/api/institutions",
    "/api/study-abroad/countries",
    "/api/study-abroad/universities",
    "/api/study-abroad/services",
    "/api/study-abroad/stories",
    # The static price list, and the two public halves of a school portal: which tiers
    # exist and what a portal looks like before anybody signs in.
    "/api/payments/plans",
    "/api/organizations/tiers",
    "/api/organizations/portal",
    # A page's own bookkeeping: what this session is, which voice engine this browser can
    # use, which starter questions to show before there is a conversation to ask about.
    # `me` is asked on every mount by the session guard, so counting it would charge a
    # student for opening the app twice.
    "/api/auth/me",
    "/api/voice/voices",
    "/api/interests/prompts",
)

# Authenticated routes sitting under an exempt catalogue prefix, put back in the bucket:
# the rows a person saved for themselves, and the operator's side of the exam table, which
# lists rows a child is not shown.
_READ_KEPT = (
    "/api/careers/saved",
    "/api/exams/admin",
)


def _under(path: str, prefix: str) -> bool:
    return path == prefix or path.startswith(prefix + "/")


def _read_exempt(path: str) -> bool:
    if any(_under(path, kept) for kept in _READ_KEPT):
        return False
    return any(_under(path, prefix) for prefix in _READ_EXEMPT)


READ_LIMIT_MESSAGE = (
    "This page asked for a lot of information at once. Wait a minute and it will load "
    "again — nothing you had saved has been lost, and nothing you are reading has changed."
)


async def throttle_reads(request: Request, call_next):
    """One shared read budget per caller, answered in the same shape as a 429 anywhere else."""
    if (
        limiter.enabled
        and request.method == "GET"
        and request.url.path.startswith("/api")
        and not _read_exempt(request.url.path)
    ):
        try:
            allowed = _reads.hit(_READ_RULE, read_identity(request))
        except Exception as exc:  # noqa: BLE001 - a counter that is down is not a 500
            # Same judgement as `in_memory_fallback_enabled` on the limiter: a Redis that
            # is restarting must not turn into an outage in front of a student who is only
            # trying to open their dashboard. The guard gets weaker for that minute.
            log.warning("Read throttle is not counting (%s); letting the read through.", exc)
            allowed = True
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": READ_LIMIT_MESSAGE},
                headers={"Retry-After": str(max(1, int(_READ_RULE.get_expiry())))},
            )
    return await call_next(request)


def register_rate_limiting(app: FastAPI) -> None:
    """Give slowapi the app (it reads `app.state.limiter`) and own the 429 body."""
    app.state.limiter = limiter
    # auto_check inside the decorator injects no request here, so the exception
    # reaches FastAPI's handler for RateLimitExceeded directly.
    app.add_exception_handler(RateLimitExceeded, _rate_limited)
    # Registered as a plain function rather than with a decorator, so this file stays the
    # one place that says what is throttled. Outermost-vs-innermost does not matter here:
    # the response this one returns is a 429 with a body, which CORSMiddleware will
    # decorate like any other.
    app.middleware("http")(throttle_reads)


async def _rate_limited(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """429 with Retry-After, in the same shape as every other error on this API."""
    item = exc.limit.limit
    window = item.GRANULARITY.seconds * item.multiples
    return JSONResponse(
        status_code=429,
        content={"detail": exc.detail},
        headers={"Retry-After": str(max(1, int(window)))},
    )
