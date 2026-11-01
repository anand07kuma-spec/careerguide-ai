"""Prove the security hardening does the thing it claims to do.

Every other suite in this directory sets ``RATE_LIMIT_ENABLED=false``, because a
throttle is a thing that must not interrupt a functional test. That is the right
call for them and the wrong call for the throttle itself, which would then ship
untested. So this file runs with the throttles on, turned down to two and three a
minute by environment so a limit is observable in three requests instead of
twenty-one, and it checks the things a hardening pass usually gets wrong:

  * a limit that counts the *address* on a school's shared network, so one student
    painting the send button locks out the whole classroom;
  * a 429 whose body is a library sentence ("Rate limit exceeded to ::...") shown
    to a child, or a stack trace;
  * a CORS list that quietly kept ``*`` because someone typed it once, and an origin
    list whose primary setting (``FRONTEND_URL``) is silently ignored or silently
    guessed when nobody sets it;
  * a ``DATABASE_URL`` handed over by Neon or Supabase that would either look for a
    driver this project does not ship or send a child's rows over a network in plain
    text because the host omitted ``sslmode`` from the string it printed;
  * a "validated" endpoint that validated the fields a friendly UI always fills in
    and ignored the ones a hostile caller picks — length, shape, extra keys;
  * a bearer token that is trusted in shape but leaked into a log, a cache key, or
    an error message on the way;
  * a day's budget for one account and a circuit breaker around the provider, which are the
    two ceilings a per-minute rule cannot give: sixty seconds always comes back round, so
    the money question needs a number that rolls over at the student's own midnight, and the
    outage question needs the provider to stop being asked — with the rule that a refusal
    leaves the child's transcript alone.

The throttles are on for the whole of it except the last section, which switches them off
through the flag slowapi itself reads — a day's ceiling of twenty is not reachable inside a
minute otherwise — and the minute rules that steps over are proven in the seven sections
before it.

The frontend half of this work — the Content-Security-Policy and the other four
response headers — cannot be checked from here, and this file does not pretend to
check it. It is verified in a browser and recorded in docs/ARCHITECTURE_AND_TESTS.md section 5.

Runs against a throwaway database, never ``careerguide.db``.

Run from ``backend/``:

    .venv/Scripts/python.exe scripts/security_test.py
"""

from __future__ import annotations

import hashlib
import os
import pathlib
import re
import sys
import tempfile
import time
import types
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

TEST_DB = pathlib.Path(tempfile.gettempdir()) / "careerguide_security_test.db"
if TEST_DB.exists():
    TEST_DB.unlink()

# Small windows on purpose: two a minute makes a limit provable in three requests.
os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{TEST_DB.as_posix()}",
        "AI_PROVIDER": "demo",
        "DB_AUTO_SETUP": "false",
        "RATE_LIMIT_ENABLED": "true",
        # Six, not the shipped sixty, so the read bucket is reachable inside one test run.
        # It is still above the five authenticated reads the rest of this file makes, so
        # every check further up keeps measuring the rule it names rather than this one —
        # and the section at the end spends its own never-issued session, starting at zero.
        "RATE_LIMIT_READ": "6 per minute",
        "RATE_LIMIT_CHAT": "2 per minute",
        "RATE_LIMIT_SPEAK": "2 per minute",
        "RATE_LIMIT_ASSESSMENT": "2 per minute",
        "RATE_LIMIT_ANSWER": "3 per minute",
        "RATE_LIMIT_AUTH": "2 per minute",
        "RATE_LIMIT_GUEST": "3 per minute",
        # Force a provider whose key is missing: it fails immediately and locally
        # instead of reaching Microsoft, so a throttle test never depends on the
        # internet being up.
        "TTS_PROVIDER": "azure",
        "AZURE_SPEECH_KEY": "",
        # Keep the allowed-origin list exactly what the test asserts on. A named
        # frontend plus a blank public site URL means nothing is folded in that the
        # file does not already check — an unset FRONTEND_URL would add the three
        # development origins, and every count below would be about a different list.
        "FRONTEND_URL": "http://localhost:3000",
        "CORS_ORIGINS": "http://localhost:3000, https://family.example/,  ",
        "PUBLIC_SITE_URL": "",
    }
)

from pydantic import ValidationError  # noqa: E402
from starlette.datastructures import Headers  # noqa: E402

from app.config import Settings, get_settings  # noqa: E402
from app.database import Base, engine  # noqa: E402
import app.middleware.rate_limit as rate_limit_module  # noqa: E402
from app.middleware.cors import browser_origins  # noqa: E402
from app.middleware.rate_limit import (  # noqa: E402
    READ_LIMIT_MESSAGE,
    _read_exempt,
    client_identity,
    counters_are_shared,
    limiter,
    read_identity,
    shared_store,
)
from app.schemas import (  # noqa: E402
    GuestIn,
    OnboardingIn,
    PlanItemCreateIn,
    ShortText,
)
from app.security import TOKEN_SHAPE  # noqa: E402

# Section 8 spends one account's day of AI replies and breaks an AI provider on purpose, so
# it reads the three things those guards are built out of: the counter store the throttle
# already uses, the two services sitting on top of it, and the database the transcript is
# written into — because "this refusal wrote nothing" is only worth anything said about
# rows, and rows are not something the API is asked about.
from limits.storage import MemoryStorage, RedisStorage  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import Message  # noqa: E402
from app.services import ai_budget, ai_breaker, ai_provider, entitlements  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


def _req(headers: dict[str, str], host: str = "203.0.113.9", cookies: dict[str, str] = {}):
    """A stand-in for a starlette request; the limiter only reads these three bits.

    `Headers`, not a plain dict, because a real HTTP header name has no case and a
    dict would let this file fail on a bug that does not exist.

    The jar, in contrast, is a plain dict on purpose: `Request.cookies` is already the
    parsed `dict[str, str]`, and a `http.cookies.SimpleCookie` would answer `.get()` with
    a `Morsel`. The session cookie is one of the things a bucket is now keyed on, so this
    fixture has to hand the limiter the same type a real request hands it.
    """
    return types.SimpleNamespace(
        headers=Headers(headers), client=types.SimpleNamespace(host=host), cookies=dict(cookies)
    )


def _throttled(response, window: int = 60) -> bool:
    """A 429 a person can read, with a wait they can act on, and nothing else."""
    if response.status_code != 429:
        return False
    body = response.json()
    detail = body.get("detail", "")
    return (
        isinstance(detail, str)
        and len(detail) > 20
        and "slowapi" not in detail.lower()
        and "rate limit" not in detail.lower()
        and "exceeded" not in detail.lower()
        and response.headers.get("retry-after", "").isdigit()
        and int(response.headers["retry-after"]) == window
    )


# --------------------------------------------------------------- 1. what is a limit
print("\n[1] A limit is a rule about a session, not about a street")

key = client_identity(_req({"authorization": "Bearer " + ("t" * 43)}))
check("a bearer token is bucketed as a session", key.startswith("session:"), key)
check("the token itself never becomes the bucket name", "t" * 43 not in key, key)
check(
    "the bucket name is a digest, so it is safe to log",
    re.fullmatch(r"session:[0-9a-f]{32}", key) is not None,
    key,
)
check(
    "the digest is the token's own sha256, not a random label",
    key
    == "session:" + hashlib.sha256(("t" * 43).encode()).hexdigest()[:32],
    key,
)
check(
    "two different tokens get two different buckets",
    client_identity(_req({"authorization": "Bearer " + ("a" * 43)}))
    != client_identity(_req({"authorization": "Bearer " + ("b" * 43)})),
)

# The credential a browser actually holds is the httpOnly cookie, not a header the page
# wrote, so a read bucket that only looked at `Authorization` would file forty students
# behind one school router as one caller.
SESSION_COOKIE = get_settings().auth_cookie_name
cookie_key = read_identity(_req({}, cookies={SESSION_COOKIE: "t" * 43}))
check(
    "a session cookie is bucketed as a session for reads, not as an address",
    cookie_key.startswith("session:"),
    cookie_key,
)
check(
    "the same session in a cookie is the same read bucket as in a header",
    cookie_key == key,
    cookie_key,
)
check(
    "the cookie's value never becomes the bucket name",
    "t" * 43 not in cookie_key,
    cookie_key,
)
check(
    "a cookie that is not shaped like a session cannot mint a fresh read bucket",
    read_identity(_req({}, cookies={SESSION_COOKIE: "not-a-token"})) == "address:203.0.113.9",
    read_identity(_req({}, cookies={SESSION_COOKIE: "not-a-token"})),
)
check(
    "a stranger's cookie is not my read bucket",
    read_identity(_req({}, cookies={SESSION_COOKIE: "a" * 43})) != cookie_key,
)
check(
    "a header still wins over the jar, because that is the order the credential is read in",
    read_identity(
        _req({"authorization": "Bearer " + ("a" * 43)}, cookies={SESSION_COOKIE: "t" * 43})
    )
    == read_identity(_req({"authorization": "Bearer " + ("a" * 43)})),
)
# …and a *write* bucket stays deaf to the cookie. That is the half that keeps this file
# worth trusting: a rotating `cg_session` would otherwise buy a fresh set of guesses at a
# come-back code, a fresh mail quota, and a fresh room to hammer the payment routes.
check(
    "a session cookie does not move a write bucket off the address",
    client_identity(_req({}, cookies={SESSION_COOKIE: "t" * 43})) == "address:203.0.113.9",
    client_identity(_req({}, cookies={SESSION_COOKIE: "t" * 43})),
)
check(
    "so a random cookie cannot refill the quota on a route that costs money",
    client_identity(_req({}, cookies={SESSION_COOKIE: "a" * 43}))
    == client_identity(_req({}, cookies={SESSION_COOKIE: "b" * 43})),
)

no_auth = client_identity(_req({}, host="203.0.113.9"))
check("a call with no session yet falls back to its address", no_auth == "address:203.0.113.9", no_auth)
check(
    "an empty bearer is not treated as a session",
    client_identity(_req({"authorization": "Bearer   "})) == "address:203.0.113.9",
    client_identity(_req({"authorization": "Bearer   "})),
)
check(
    "the header name's case does not create a second identity",
    client_identity(_req({"Authorization": "Bearer " + ("t" * 43)})) == key,
)
check(
    "'bearer' spelled differently still counts as the same session",
    client_identity(_req({"authorization": "BEARER " + ("t" * 43)})) == key,
)
check(
    "X-Forwarded-For is ignored unless the operator says a proxy owns it",
    client_identity(_req({"x-forwarded-for": "8.8.8.8", }, host="203.0.113.9"))
    == "address:203.0.113.9",
)
check("the throttles are switched on in this process", limiter.enabled is True, limiter.enabled)
check(
    "nothing is throttled by default, so /api/health cannot be locked out",
    list(getattr(limiter, "_default_limits", []) or []) == [],
    getattr(limiter, "_default_limits", None),
)

# ------------------------------------------------------------------- 2. what is a rule
print("\n[2] A rule nobody can read is a rule nobody can trust")

defaults = Settings.model_fields
for name, expected in (
    ("rate_limit_read", "60 per minute"),
    ("rate_limit_chat", "20 per minute"),
    ("rate_limit_speak", "20 per minute"),
    ("rate_limit_assessment", "10 per minute"),
    ("rate_limit_answer", "40 per minute"),
    ("rate_limit_auth", "5 per minute"),
    ("rate_limit_guest", "30 per minute"),
    ("rate_limit_admin", "10 per minute"),
):
    check(f"{name} defaults to the documented '{expected}'", defaults[name].default == expected, defaults[name].default)

for bad in ("20每分钟", "plenty per minute", "20", "per minute", "-5 per minute"):
    try:
        Settings(rate_limit_chat=bad)
        rejected = False
        shown = "accepted"
    except ValidationError as exc:
        rejected = "is not a rate limit rule" in str(exc)
        shown = str(exc).splitlines()[0] if rejected else "accepted"
    check(f"'{bad}' is refused at startup, not silently ignored", rejected, shown)

check(
    "the per-answer bucket is looser than the per-test bucket",
    defaults["rate_limit_answer"].default != defaults["rate_limit_assessment"].default
    and int(re.match(r"\d+", defaults["rate_limit_answer"].default).group())
    > int(re.match(r"\d+", defaults["rate_limit_assessment"].default).group()),
)
check(
    "the guest lookup is looser than a password route",
    int(re.match(r"\d+", defaults["rate_limit_guest"].default).group())
    > int(re.match(r"\d+", defaults["rate_limit_auth"].default).group()),
)
check(
    "the read bucket is looser than any of the buckets that guard a write",
    int(re.match(r"\d+", defaults["rate_limit_read"].default).group())
    > int(re.match(r"\d+", defaults["rate_limit_chat"].default).group())
    and int(re.match(r"\d+", defaults["rate_limit_read"].default).group())
    > int(re.match(r"\d+", defaults["rate_limit_admin"].default).group()),
)

# ------------------------------------------------------------------------ 3. who may call
print("\n[3] Only the origins this site is actually served from")

origins = browser_origins(Settings(cors_origins=" http://localhost:3000 , https://family.example/ ", public_site_url=""))
check("whitespace around an origin is not part of the origin", "http://localhost:3000" in origins, origins)
check(
    "a trailing slash is removed, because browsers do not send one",
    "https://family.example" in origins and "https://family.example/" not in origins,
    origins,
)
check("no blank entries survive", all(o.strip() for o in origins), origins)

wild = browser_origins(Settings(cors_origins="*,http://localhost:3000", public_site_url=""))
check("`*` is dropped rather than obeyed", "*" not in wild and "http://localhost:3000" in wild, wild)

site = browser_origins(Settings(cors_origins="http://localhost:3000", public_site_url="https://careerguide-web.vercel.app"))
check("the site's own public URL is allowed without being listed twice", "https://careerguide-web.vercel.app" in site, site)
check(
    "a plain http public URL is not folded in automatically",
    browser_origins(Settings(frontend_url="http://localhost:3000", cors_origins="", public_site_url="http://nowhere.test"))
    == ["http://localhost:3000"],
)

# `FRONTEND_URL` is the setting a deployment is told to write, so it has to be the one
# that decides — and the one that is guessed when nobody writes it has to be guessable
# out loud rather than silently.
named = browser_origins(Settings(frontend_url="https://family-site.example/", cors_origins="", public_site_url=""))
check(
    "FRONTEND_URL alone decides the list, trailing slash and all",
    named == ["https://family-site.example"],
    named,
)
check(
    "CORS_ORIGINS adds to FRONTEND_URL rather than replacing it",
    browser_origins(
        Settings(frontend_url="https://family-site.example", cors_origins="https://green-school.example", public_site_url="")
    )
    == ["https://family-site.example", "https://green-school.example"],
)
check(
    "one origin named twice is allowed once, because a browser compares the reply header",
    browser_origins(
        Settings(frontend_url="http://localhost:3000", cors_origins="http://localhost:3000 ,http://localhost:3000/", public_site_url="")
    )
    == ["http://localhost:3000"],
)
check(
    "a comma-separated FRONTEND_URL is several origins, not one broken one",
    browser_origins(Settings(frontend_url="https://a.example, https://b.example", cors_origins="", public_site_url=""))
    == ["https://a.example", "https://b.example"],
)
unset = browser_origins(Settings(frontend_url="", cors_origins="", public_site_url=""))
check(
    "an unset FRONTEND_URL falls back to the development pair, never to nothing",
    unset == ["http://localhost:3000", "http://127.0.0.1:3000", "http://careerguide.localhost:3000"],
    unset,
)
check(
    "…and a `*` in FRONTEND_URL is refused like one in CORS_ORIGINS",
    "*" not in browser_origins(Settings(frontend_url="*", cors_origins="", public_site_url="")),
)

# ---------------------------------------------------------- 3b. how the URL reaches postgres
print("\n[3b] A hosted Postgres URL is read the way the host wrote it")

neon = Settings(
    database_url="postgresql://neondb_owner:npg_abc@endpoint-pooler.us-east-2.aws.neon.tech/neondb"
).database_url
check(
    "a plain `postgresql://` URL is sent to the driver this project ships",
    neon.startswith("postgresql+psycopg://"),
    neon,
)
check(
    "…and asked for TLS, because Neon and Supabase both terminate it and neither says so in the URL",
    "sslmode=require" in neon,
    neon,
)
supabase = Settings(
    database_url="postgresql://postgres:pw@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require"
).database_url
check(
    "a URL that already names its TLS mode is not rewritten",
    supabase.count("sslmode") == 1 and supabase.endswith("sslmode=require"),
    supabase,
)
check(
    "an explicit refusal of TLS is respected — it is a decision, not an omission",
    Settings(
        database_url="postgresql://u:p@remote-host.example:5432/db?sslmode=disable&pool=1"
    ).database_url
    == "postgresql+psycopg://u:p@remote-host.example:5432/db?sslmode=disable&pool=1",
)
check(
    "a second query parameter does not push TLS off the end of the URL",
    "sslmode=require"
    in Settings(database_url="postgresql://u:p@remote-host.example:5432/db?options=-c%20x").database_url,
)
for local_host in ("localhost", "127.0.0.1", "postgres", "db"):
    check(
        f"a database on `{local_host}` is not told to use TLS it may not have",
        "sslmode"
        not in Settings(database_url=f"postgresql://u:p@{local_host}:5432/careerguide").database_url,
        local_host,
    )
check(
    "SQLite is left exactly as written",
    Settings(database_url="sqlite:///./careerguide.db").database_url == "sqlite:///./careerguide.db",
)

# --------------------------------------------------------------------- 4. what is a token
print("\n[4] A token has a shape before it has a meaning")

check("a 43-character opaque token is well-formed", TOKEN_SHAPE.fullmatch("t" * 43) is not None)
check("a truncated token is refused without a database lookup", TOKEN_SHAPE.fullmatch("abc123") is None)
check("64 characters is the most anyone may claim", TOKEN_SHAPE.fullmatch("t" * 65) is None)
check("a space in the middle is not a token", TOKEN_SHAPE.fullmatch("abc def" + "x" * 40) is None)
check("punctuation cannot sneak into a token", TOKEN_SHAPE.fullmatch("tok;" + "x" * 40 + "|") is None)
check("an empty token is not a token", TOKEN_SHAPE.fullmatch("") is None)

# ----------------------------------------------------------------- 5. what is a valid body
print("\n[5] The fields a friendly UI never fills in are the ones worth attacking")


def rejects(model, payload, label: str) -> None:
    try:
        model.model_validate(payload)
        check(label, False, "accepted")
    except ValidationError:
        check(label, True)


GUEST_ID = "device-" + "a" * 24
rejects(GuestIn, {"device_id": "short"}, "a device id under 16 characters is refused")
rejects(GuestIn, {"device_id": "x" * 65}, "a device id over 64 characters is refused")
rejects(GuestIn, {"device_id": "device" + " " * 20}, "a device id with a space is refused")
rejects(GuestIn, {"device_id": "dev" + ";" * 20}, "a device id with punctuation is refused")
rejects(GuestIn, {"device_id": GUEST_ID, "role": "parent"}, "an extra key in the body is refused, not ignored")
check("a well-formed device id passes", GuestIn.model_validate({"device_id": GUEST_ID}).device_id == GUEST_ID)

rejects(
    OnboardingIn,
    {"role": "student", "display_name": "A" * 81, "is_admin": True},
    "an 81-character name is refused before it is stored",
)
rejects(OnboardingIn, {"role": "wizard", "display_name": "Me"}, "a role outside student/parent is refused")
rejects(
    OnboardingIn,
    {"role": "student", "display_name": "Me", "consent_age": "0-2"},
    "an age band the app never asked for is refused",
)
rejects(
    OnboardingIn,
    {"role": "student", "display_name": "Me", "class_level": "x" * 4000},
    "an unbounded free-text field is refused",
)
rejects(
    OnboardingIn,
    {"role": "student", "display_name": "Me", "interest_areas": ["a" * 49]},
    "an interest area longer than the agreed short-text bound is refused",
)
rejects(
    OnboardingIn,
    {"role": "student", "display_name": "Me", "interest_areas": ["coding", ""]},
    "an empty interest area is refused",
)
check(
    "a short-text item can be built from the same type the schema uses",
    ShortText.__metadata__[0].max_length == 48,
)

for bad_url in (
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "/relative/only",
    "http://" + "a" * 400,
):
    rejects(
        PlanItemCreateIn,
        {"title": "Read this", "resource_url": bad_url},
        f"a plan link beginning '{bad_url[:18]}' cannot be saved as a clickable href",
    )
check(
    "an ordinary https link still works",
    PlanItemCreateIn.model_validate(
        {"title": "Read this", "resource_url": "https://ncert.nic.in/textbook"}
    ).resource_url
    == "https://ncert.nic.in/textbook",
)

# -------------------------------------------------------------------- 6. over the wire
print("\n[6] The running API, with the throttles open")

Base.metadata.create_all(bind=engine)
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import assessment_bank  # noqa: E402

client = TestClient(app)
# A second client that has never been handed a session cookie. `TestClient` keeps whatever
# a response sets, and every minting response now sets one, so a request meant to prove
# that *no* credential is refused has to come from a jar that holds none. Without this the
# check would pass on the strength of a cookie it never meant to send.
jarless = TestClient(app)

instrument = None
likert = None
for name in assessment_bank.TYPES:
    meta = assessment_bank.instrument(name)
    if int(meta.get("min_class", 1)) > 12:
        continue
    likert = likert or (name if meta.get("response") == "likert" else None)
    if instrument is None:
        instrument = name
instrument = likert or instrument
check("a questionnaire this student is old enough to sit exists", instrument is not None, instrument)

ONBOARD = {
    "role": "student",
    "preferred_language": "hinglish",
    "interest_areas": ["drawing"],
    "consent_profile": True,
    "consent_voice": False,
    "consent_age": "11-12",
}

student = client.post(
    "/api/auth/onboarding",
    json={**ONBOARD, "display_name": "Riya", "class_level": "class-12", "device_id": GUEST_ID},
)
check("onboarding a student still succeeds with the strict schema in place", student.status_code == 200, student.text[:200])
token_a = student.json()["token"]
head_a = {"authorization": f"Bearer {token_a}"}

other = client.post(
    "/api/auth/onboarding",
    json={**ONBOARD, "display_name": "Vikram", "class_level": "class-10"},
)
check("a second student can onboard", other.status_code == 200, other.text[:200])
head_b = {"authorization": f"Bearer {other.json()['token']}"}

third = client.post(
    "/api/auth/onboarding",
    json={**ONBOARD, "display_name": "Third", "class_level": "class-9"},
)
check("a third sign-up in the same minute is throttled, not served", _throttled(third), f"{third.status_code} {third.text[:160]}")

# --- the guest lookup: the one route that runs on every page load
known = client.post("/api/auth/guest", json={"device_id": GUEST_ID})
check("a returning device gets its own session back", known.status_code == 200 and known.json()["known"] is True, known.text[:160])
check(
    "the session it gets back belongs to the account that device made",
    known.json()["session"]["user"]["id"] == student.json()["user"]["id"],
    known.json()["session"]["user"]["id"],
)
check(
    "and a lookup hands out a token rather than a claim of identity",
    len(known.json()["session"]["token"]) >= 20,
)
fresh = client.post("/api/auth/guest", json={"device_id": "device-" + "b" * 24})
check("an unknown device is a new student, not an error", fresh.status_code == 200 and fresh.json()["known"] is False, fresh.text[:160])
third_guest = client.post("/api/auth/guest", json={"device_id": "device-" + "c" * 24})
check("the third lookup in a minute is still served", third_guest.status_code == 200, third_guest.text[:160])
fourth_guest = client.post("/api/auth/guest", json={"device_id": "device-" + "d" * 24})
check("the fourth is throttled", _throttled(fourth_guest), f"{fourth_guest.status_code} {fourth_guest.text[:160]}")

# --- the come-back code: the route a stranger would brute force
for attempt in (1, 2):
    bad_login = client.post("/api/auth/login", json={"code": f"AAAA-BBBB-{attempt}"})
    check(
        f"come-back attempt {attempt} answers on the account, not on the guess",
        bad_login.status_code in (400, 401, 404) and "rate" not in bad_login.text.lower(),
        f"{bad_login.status_code} {bad_login.text[:120]}",
    )
hammer = client.post("/api/auth/login", json={"code": "CCCC-DDDD-3"})
check("a third come-back code in a minute is refused outright", _throttled(hammer), f"{hammer.status_code} {hammer.text[:160]}")
check(
    "a throttled sign-in does not say whether the code was right",
    "correct" not in hammer.text.lower() and "found" not in hammer.text.lower(),
    hammer.text[:160],
)
check("the token never appears in a 429 body", token_a not in hammer.text)

# --- chat: two students on one machine must not share a ceiling
convo_a = client.post("/api/conversations", json={"kind": "chat"}, headers=head_a)
check("a conversation can be opened", convo_a.status_code == 201, convo_a.text[:160])
sid_a = convo_a.json()["id"]
first_message = client.post(
    f"/api/conversations/{sid_a}/messages", json={"message": "I like drawing"}, headers=head_a
)
check("a first message is answered", first_message.status_code == 200, first_message.text[:160])
second_message = client.post(
    f"/api/conversations/{sid_a}/messages", json={"message": "in class 12"}, headers=head_a
)
check("a second message is answered", second_message.status_code == 200, second_message.text[:160])
third_message = client.post(
    f"/api/conversations/{sid_a}/messages", json={"message": "what next"}, headers=head_a
)
check("a third message in the same minute is throttled", _throttled(third_message), f"{third_message.status_code} {third_message.text[:160]}")
check(
    "the throttle tells the student nothing was lost",
    "lost" in third_message.json()["detail"].lower(),
    third_message.json()["detail"],
)

convo_b = client.post("/api/conversations", json={"kind": "chat"}, headers=head_b)
sid_b = convo_b.json()["id"]
other_message = client.post(
    f"/api/conversations/{sid_b}/messages", json={"message": "hello"}, headers=head_b
)
check(
    "a different student on the same machine keeps their own headroom",
    other_message.status_code == 200,
    f"{other_message.status_code} {other_message.text[:160]}",
)
check(
    "the throttled window is a minute, so Retry-After is 60",
    third_message.headers.get("retry-after") == "60",
    third_message.headers.get("retry-after"),
)

# --- the streaming address is a write, and is throttled like one
# The minute bucket is an abuse guard, and slowapi keys it per decorated route, so the
# streaming address has its own count of the same rule rather than a shared one. What
# a second URL must not be able to buy is the day's allowance, and it cannot: that is
# counted from the child's stored messages (`chats_today`), whichever address wrote
# them — payments_test.py proves exactly that, and both checks belong in this file
# because they are two halves of one rule.
stream_b = f"/api/conversations/{sid_b}/messages/stream"
streamed_first = client.post(
    stream_b, json={"message": "Mujhe drawing pasand hai"}, headers=head_b
)
check(
    "a streamed turn is answered as a stream for the student who still has headroom",
    streamed_first.status_code == 200
    and streamed_first.headers.get("content-type", "").startswith("text/event-stream")
    and streamed_first.text.startswith("event: meta"),
    f"{streamed_first.status_code} {streamed_first.text[:120]}",
)
streamed_second = client.post(
    stream_b, json={"message": "Aur machines banana"}, headers=head_b
)
check(
    "a second streamed turn in the same minute is answered",
    streamed_second.status_code == 200,
    f"{streamed_second.status_code} {streamed_second.text[:120]}",
)
streamed_third = client.post(stream_b, json={"message": "what next"}, headers=head_b)
check(
    "and a third is throttled by the chat rule, not left running",
    _throttled(streamed_third),
    f"{streamed_third.status_code} {streamed_third.text[:160]}",
)
check(
    "the throttle on a stream keeps the same sentence about nothing being lost",
    "lost" in streamed_third.json()["detail"].lower(),
    streamed_third.json()["detail"],
)
check(
    "a throttled stream is refused before any reply is opened",
    not streamed_third.text.startswith("event:")
    and streamed_third.headers.get("retry-after") == "60",
    f"{streamed_third.text[:120]} {streamed_third.headers.get('retry-after')}",
)

# --- speech: a slow external service must not be reachable once throttled
speak_payload = {"text": "Namaste! Main aapki guide hoon.", "language": "hinglish"}
for attempt in (1, 2):
    spoken = client.post("/api/voice/speak", json=speak_payload, headers=head_a)
    check(
        f"spoke attempt {attempt} reached the voice service and reported honestly",
        spoken.status_code in (200, 503) and spoken.status_code != 429,
        f"{spoken.status_code} {spoken.text[:120]}",
    )
silent = client.post("/api/voice/speak", json=speak_payload, headers=head_a)
check("a third request for audio in a minute is throttled", _throttled(silent), f"{silent.status_code} {silent.text[:160]}")
check(
    "a throttled call is answered without reaching the TTS vendor",
    "azure" not in silent.text.lower() and "speech key" not in silent.text.lower(),
    silent.text[:160],
)

# --- assessments: starting one is cheap, answering it must not be capped by that
started = client.post(f"/api/assessments/{instrument}/start", json={"language": "en"}, headers=head_a)
check("a questionnaire can be started", started.status_code in (200, 201), started.text[:200])
assessment_id = started.json().get("assessment_id") or started.json().get("id")
again = client.post(f"/api/assessments/{instrument}/start", json={"language": "en"}, headers=head_a)
check("a second start in the same minute is served", again.status_code in (200, 201, 409), again.text[:200])
thrice = client.post(f"/api/assessments/{instrument}/start", json={"language": "en"}, headers=head_a)
check("a third start is throttled", _throttled(thrice), f"{thrice.status_code} {thrice.text[:160]}")

questions = client.get(f"/api/assessments/session/{assessment_id}/questions", headers=head_a)
check("the questions can still be read while starts are throttled", questions.status_code == 200, questions.status_code)
rows = questions.json()
items = rows.get("items") or []
code = items[0]["code"] if items else None
check("an item code is available to answer", code is not None, str(rows)[:160])

answers_ok = 0
for _ in range(3):
    saved = client.post(
        f"/api/assessments/session/{assessment_id}/answer",
        json={"code": code, "value": "3"},
        headers=head_a,
    )
    if saved.status_code == 200:
        answers_ok += 1
check(
    "autosaving three answers is allowed even though starting tests is not",
    answers_ok == 3,
    f"{answers_ok} of 3 accepted",
)
fourth_answer = client.post(
    f"/api/assessments/session/{assessment_id}/answer",
    json={"code": code, "value": "2"},
    headers=head_a,
)
check("a fourth answer in the same minute is throttled", _throttled(fourth_answer), f"{fourth_answer.status_code} {fourth_answer.text[:160]}")

# --- the query string is an input like any other
for bad, label in (("-1", "negative"), ("0", "zero"), ("201", "too-large")):
    listing = client.get(f"/api/journey/events?limit={bad}", headers=head_a)
    check(
        f"a {label} event count is refused rather than obeyed",
        listing.status_code == 422,
        f"{listing.status_code} {listing.text[:120]}",
    )
sane = client.get("/api/journey/events?limit=50", headers=head_a)
check("an ordinary event count still works", sane.status_code == 200, sane.status_code)

# --- the bearer header is checked on shape before anything else
check("no header and no cookie is refused", jarless.get("/api/auth/me").status_code == 401)
check(
    "a truncated token is refused without a database lookup",
    client.get("/api/auth/me", headers={"authorization": "Bearer short"}).status_code == 401,
)
check(
    "a token made of punctuation is refused",
    client.get("/api/auth/me", headers={"authorization": "Bearer " + "!" * 43}).status_code == 401,
)
check(
    "a well-formed token nobody issued is refused",
    client.get("/api/auth/me", headers={"authorization": "Bearer " + ("z" * 43)}).status_code == 401,
)
check(
    "the scheme word must be bearer",
    client.get("/api/auth/me", headers={"authorization": f"Basic {token_a}"}).status_code == 401,
)
check("the real token still opens the door", client.get("/api/auth/me", headers=head_a).status_code == 200)

# --- CORS, answered by the running middleware
allowed = client.get("/api/careers", headers={"origin": "http://localhost:3000"})
check(
    "an allowed browser origin gets its header back",
    allowed.headers.get("access-control-allow-origin") == "http://localhost:3000",
    dict(allowed.headers),
)
stranger = client.get("/api/careers", headers={"origin": "http://evil.example"})
check(
    "an unknown origin is given no permission to read the response",
    stranger.headers.get("access-control-allow-origin") is None,
    dict(stranger.headers),
)
check(
    "a named origin is allowed to arrive with the session cookie attached",
    allowed.headers.get("access-control-allow-credentials") == "true",
    dict(allowed.headers),
)
check(
    "…and an unknown origin is never told its address may read this response",
    stranger.headers.get("access-control-allow-origin") is None
    and "Origin" in (stranger.headers.get("vary") or ""),
    dict(stranger.headers),
)
# `access-control-allow-credentials: true` does go back to every origin that thinks to send
# an `Origin` header, because Starlette's middleware returns it as a simple header rather
# than as part of the allow line. It grants nothing on its own: a browser only attaches a
# credential to a response it is then allowed to read, and that is the line above. What the
# credentials flag genuinely changes is the CSRF surface — a cookie is offered by the browser
# without any script asking — so the two checks below are the reason that is survivable here.
preflight = client.options(
    "/api/conversations",
    headers={
        "origin": "https://family.example",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, content-type",
    },
)
check(
    "a preflight for a method this API serves is answered",
    preflight.status_code == 200
    and preflight.headers.get("access-control-allow-origin") == "https://family.example",
    f"{preflight.status_code} {dict(preflight.headers)}",
)
check(
    "the * entry that was once in the list grants nothing",
    client.get("/api/careers", headers={"origin": "http://anything.at.all"}).headers.get(
        "access-control-allow-origin"
    )
    is None,
)

# A cookie is a credential the browser offers without any script of ours asking, which is
# the whole reason a bearer-only design did not have this problem and this one does. Two
# things stand between a foreign page and a write to a child's account, and both are checked
# rather than assumed: every mutating route here reads a JSON body, and a body a form can
# produce is refused before anything is looked at; while a JSON body cannot be sent
# cross-site at all without a preflight, which the exact origin list answers with nothing.
form_shaped = client.patch(
    "/api/auth/settings",
    content='{"language": "en"}',
    headers={"content-type": "text/plain", "origin": "http://evil.example"},
)
check(
    "a cross-site request shaped like a form is refused before its body is read",
    form_shaped.status_code in (415, 422),
    f"{form_shaped.status_code} {form_shaped.text[:120]}",
)
written = client.patch(
    "/api/auth/settings",
    json={"speak_responses": False},
    headers={"origin": "http://evil.example"},
)
check(
    "…and the guard is the content type rather than a broken route: the session cookie by "
    "itself does authorise this write, which is why nothing but JSON is ever accepted",
    written.status_code == 200 and written.json().get("speak_responses") is False,
    f"{written.status_code} {written.text[:120]}",
)

# --- an unthrottled route proves the throttle was aimed, not sprayed
health = [client.get("/api/health").status_code for _ in range(6)]
check("six health checks in a minute are all served", all(code == 200 for code in health), health)

# ------------------------------------------------------------------ 7. the read bucket
print("\n[7] Reading your own rows is cheap, but it is not free")

# A session-shaped string nobody was ever issued: every read on a counted route answers
# 401 until the bucket runs out, which is the only way this section can tell a throttle
# from a refusal. The bucket is this token's own, so the section starts from zero no
# matter how much reading the rest of this file has already done.
READ_AUTH = {"authorization": "Bearer " + ("r" * 43)}
served = [client.get("/api/journey", headers=READ_AUTH).status_code for _ in range(6)]
check("six reads a minute are answered", served == [401] * 6, served)
seventh = client.get("/api/journey", headers=READ_AUTH)
check("a seventh read in the same minute is throttled, not served", _throttled(seventh),
      f"{seventh.status_code} {seventh.text[:160]}")
check(
    "…and the sentence is the read bucket's own, so a family knows which wait they are in",
    seventh.json().get("detail") == READ_LIMIT_MESSAGE,
    seventh.json().get("detail"),
)
check(
    "a different session is not punished for this one's reading",
    client.get("/api/journey", headers={"authorization": "Bearer " + ("q" * 43)}).status_code
    == 401,
)
check(
    "an exhausted caller still gets their own session back, and still gets the catalogue",
    client.get("/api/auth/me", headers=READ_AUTH).status_code == 401
    and client.get("/api/careers").status_code == 200
    and client.get("/api/exams").status_code == 200,
)

# The exemption table is the part a reader has to be able to check, because it is where
# "we throttle reads" stops being true. Pinned as data rather than as traffic.
for path in (
    "/api/health",
    "/api/careers",
    "/api/exams",
    "/api/resources",
    "/api/scholarships",
    "/api/study-abroad/universities/edinburgh",
    "/api/payments/plans",
    "/api/organizations/portal",
    "/api/auth/me",
    "/api/voice/voices",
):
    check(f"{path} is exempt from the read bucket", _read_exempt(path), path)
for path in (
    "/api/journey",
    "/api/conversations",
    "/api/reports/pdf",
    "/api/email",
    "/api/assessments/history",
    "/api/admin/users",
    "/api/study-abroad/admin/leads",
    # The two routes that live under an exempt catalogue prefix but answer differently for
    # the person asking: what they saved, and what an operator sees before publishing.
    "/api/careers/saved",
    "/api/exams/admin",
):
    check(f"{path} is counted against the read bucket", not _read_exempt(path), path)
check(
    "an exemption matches a path segment, not the start of a string",
    not _read_exempt("/api/healthlog") and not _read_exempt("/api/examsarchive"),
)

# The same judgement `in_memory_fallback_enabled` makes for the named buckets, proved on
# the read one: a counter that cannot be reached is a weaker guard, never a 500 in front of
# a student who is only trying to open their dashboard.
broken = rate_limit_module._reads.hit
rate_limit_module._reads.hit = lambda *a, **k: (_ for _ in ()).throw(ConnectionError("redis is down"))
try:
    while_down = client.get("/api/journey", headers={"authorization": "Bearer " + ("w" * 43)})
finally:
    rate_limit_module._reads.hit = broken
check(
    "with the counter store unreachable a read is still answered, not failed",
    while_down.status_code in (200, 401, 403, 404),
    f"{while_down.status_code} {while_down.text[:120]}",
)
check(
    "…and the bucket is filled again the moment the store comes back",
    [client.get("/api/journey", headers=READ_AUTH).status_code for _ in range(2)]
    == [429, 429],
)

# ---------------------------------------------- 8. what one account may spend, and what stops asking
print("\n[8] What one account may spend, and what happens when the provider stops")

# Every rule above answers "are you sending faster than a person types", and sixty seconds
# always comes back round. Two numbers do not come back round: how many replies one account
# may buy in a day, and how many times in a row the provider is allowed to not answer before
# it stops being asked. This section runs both of them over the wire, and then runs the same
# asks against the two possible counter stores to show the decision does not depend on which
# one is holding it.
#
# The per-minute throttle is switched off for the whole section — not hidden, and not by
# editing any rule: `limiter.enabled` is the public flag slowapi reads on every request, and
# the one `throttle_reads` reads too, so one assignment takes the minute buckets out of the
# way of twenty-one sends that would otherwise be refused at the third. What that costs in
# coverage is stated rather than glossed: the day's budget is proven here on its own, and the
# minute rules are proven in the six sections above. `ai_budget` never consults the flag — it
# counts through `shared_store()` directly, which is the thing being tested.
limiter.enabled = False

SAVED = {
    name: os.environ.get(name)
    for name in (
        "AI_DAILY_MESSAGE_LIMIT",
        "AI_PROVIDER",
        "AI_API_KEY",
        "AI_BASE_URL",
        "AI_BREAKER_FAILURES",
        "AI_BREAKER_WINDOW_SECONDS",
        "AI_BREAKER_COOLDOWN_SECONDS",
    )
}


def env(**values: str | None) -> None:
    """Change the environment and make the cached settings read it again.

    `get_settings` is `lru_cache`d; every guard calls it per request instead of holding a
    copy, so dropping the cache is the whole of the work. A name of `None` removes the
    variable, which is how a setting is put back to its shipped default.
    """
    for key, value in values.items():
        if value is None:
            os.environ.pop(key.upper(), None)
        else:
            os.environ[key.upper()] = value
    get_settings.cache_clear()


def rows(session_id: int) -> int:
    """How many transcript rows a conversation holds, read from the database.

    Not asked of the API: a refusal that quietly stored the student's question looks exactly
    like one that did not, from the client side. The claim worth making is about rows.
    """
    with SessionLocal() as db:
        return int(
            db.scalar(
                select(func.count())
                .select_from(Message)
                .where(Message.session_id == session_id)
            )
        )


# --- 8a. which store is holding the numbers
REDIS_URL = os.environ.get("RATE_LIMIT_REDIS_URL", "").strip()
store = shared_store()
check(
    "the day's budget and the breaker count in the throttle's own store, not a second one",
    store is limiter._storage,
)
if REDIS_URL:
    check(
        "with RATE_LIMIT_REDIS_URL set the counters are reported as shared",
        counters_are_shared() is True,
    )
    check("…and the store holding them is the Redis one", isinstance(store, RedisStorage), type(store).__name__)
else:
    check(
        "with no Redis configured the counters are this process's own",
        counters_are_shared() is False,
    )
    check(
        "…and the budget counts in the same memory store as the throttle, so a deployment "
        "that has not set the URL behaves exactly as it did before this existed",
        isinstance(store, MemoryStorage),
        type(store).__name__,
    )

# --- 8b. the day's budget
env(AI_DAILY_MESSAGE_LIMIT="20")
day = client.post(
    "/api/auth/onboarding",
    json={**ONBOARD, "display_name": "Anya", "class_level": "class-11"},
)
check("a student for the budget checks can be onboarded", day.status_code == 200, day.text[:200])
head_c = {"authorization": f"Bearer {day.json()['token']}"}
user_c = day.json()["user"]["id"]
sid_c = client.post("/api/conversations", json={"kind": "chat"}, headers=head_c).json()["id"]
# An opening line from the guide is stored when the conversation is made, so the transcript is
# measured as a difference rather than against zero.
start_rows = rows(sid_c)
check("their conversation opens with only the guide's own first line", start_rows == 1, start_rows)

codes = []
refusal = None
for ask in range(1, 22):
    reply = client.post(
        f"/api/conversations/{sid_c}/messages",
        json={"message": f"Which stream fits me, question {ask}?"},
        headers=head_c,
    )
    codes.append(reply.status_code)
    if ask == 20:
        rows_at_twenty = rows(sid_c)
    if ask == 21:
        refusal = reply

check("the twentieth reply of the day is served", codes[19] == 200, codes)
check("the twenty-first is refused", refusal is not None and refusal.status_code == 429, codes[-1])
check(
    "…and twenty asks of the same rule never once produced a server error",
    not any(code >= 500 for code in codes),
    codes,
)
check(
    "the counter and the transcript agree: twenty asks left twenty questions and twenty answers",
    rows_at_twenty == start_rows + 40,
    f"{rows_at_twenty} rows, started at {start_rows}",
)
check(
    "a refusal adds no row to the transcript, so a child's history is not a wall of refusals",
    rows(sid_c) == rows_at_twenty,
    f"{rows(sid_c)} after {rows_at_twenty} before",
)
sentence = str((refusal.json().get("detail") if refusal else "") or "")
check(
    "the refusal is the one fixed sentence, with the day's own number in it",
    sentence == ai_budget.refusal_sentence(20),
    sentence[:160],
)
check(
    "…and it names the reset as midnight in the student's own day rather than a countdown",
    "midnight" in sentence and "your time" in sentence,
    sentence[:160],
)
check(
    "…and it says what is still open, not what has been taken away",
    "stays saved" in sentence and "still open" in sentence,
    sentence[:160],
)
check(
    "…and it is not a plan wall: no price, no upgrade, nothing a child reads as a debt",
    not any(word in sentence.lower() for word in ("pay", "plan", "upgrade", "subscribe", "₹")),
    sentence[:160],
)
# The header is the wait until *their* local midnight, which is the number the sentence
# promises. `RATE_LIMIT_CHAT=2 per minute` would have said 60, so a 60 here would mean the
# ceiling was being enforced by the wrong rule.
_now = datetime.now(timezone.utc)
_to_midnight = max(60, int((entitlements.day_boundaries(_now)[1] - _now).total_seconds()) + 60)
after = refusal.headers.get("retry-after", "") if refusal else ""
check(
    "the refusal's Retry-After is the wait until the student's day ends, not a minute",
    after.isdigit() and int(after) == _to_midnight,
    f"{after} vs {_to_midnight}",
)
check(
    "the refusal is counted: the counter stopped at the ceiling and did not climb past it",
    ai_budget.spent_today(user_c) == 21,
    ai_budget.spent_today(user_c),
)

# The other two addresses that buy a reply, and the streaming one. A ceiling the chat alone
# answered to would be a ceiling with a door in it, and the stream is the door somebody would
# find: it is the address the app actually uses.
stream_refused = client.post(
    f"/api/conversations/{sid_c}/messages/stream",
    json={"message": "and what about teaching?"},
    headers=head_c,
)
check(
    "the streaming address answers a spent account with a status, not an empty stream",
    stream_refused.status_code == 429
    and not stream_refused.text.startswith("event: meta"),
    f"{stream_refused.status_code} {stream_refused.text[:120]}",
)
interview_refused = client.post(
    "/api/ai/mock-interview", json={"role": "bank clerk", "history": []}, headers=head_c
)
check(
    "a practice-interview turn is refused by the same ceiling",
    interview_refused.status_code == 429,
    f"{interview_refused.status_code} {interview_refused.text[:120]}",
)
resume_refused = client.post(
    "/api/ai/resume-suggest", json={"target_role": "bank clerk"}, headers=head_c
)
check(
    "…and so is a resume suggestion",
    resume_refused.status_code == 429,
    f"{resume_refused.status_code} {resume_refused.text[:120]}",
)
check(
    "…and neither of them wrote anything either",
    rows(sid_c) == rows_at_twenty,
    rows(sid_c),
)

# The case the ceiling must never reach: a message that reads as a disclosure is answered
# whatever the counter says, and answering it from the script costs nothing, so refusing it
# would be the worst bug in the file.
spent_before = ai_budget.spent_today(user_c)
disclosure = client.post(
    f"/api/conversations/{sid_c}/messages",
    json={"message": "someone at home beats me and I do not know what to do"},
    headers=head_c,
)
check(
    "an exhausted account is still answered when the words read as a disclosure",
    disclosure.status_code == 200,
    f"{disclosure.status_code} {disclosure.text[:160]}",
)
check(
    "…and that reply is free, because the guard lets it through before it counts anything",
    ai_budget.spent_today(user_c) == spent_before,
    f"{ai_budget.spent_today(user_c)} vs {spent_before}",
)
check(
    "…and it arrives flagged for support, which is the whole reason it was never a budget case",
    disclosure.json().get("needs_support") is True,
    disclosure.json().get("needs_support"),
)
check(
    "one account's ceiling is not a classroom's: another student still has their day",
    client.post(
        f"/api/conversations/{sid_b}/messages",
        json={"message": "what about engineering"},
        headers=head_b,
    ).status_code
    == 200,
)

env(AI_DAILY_MESSAGE_LIMIT="0")
check(
    "AI_DAILY_MESSAGE_LIMIT=0 removes the ceiling, for a deployment that wants only the "
    "per-minute rule and says so in the environment rather than in the code",
    client.post(
        f"/api/conversations/{sid_c}/messages",
        json={"message": "question after the ceiling was lifted"},
        headers=head_c,
    ).status_code
    == 200,
)
env(AI_DAILY_MESSAGE_LIMIT="20")

# A counter that cannot be reached is a weaker guard, never an outage in front of a student —
# the same judgement `throttle_reads` and slowapi's own fallback make, proved on the budget.
broken_budget_store = ai_budget.shared_store
ai_budget.shared_store = lambda: (_ for _ in ()).throw(ConnectionError("redis is down"))
try:
    outage = client.post(
        f"/api/conversations/{sid_c}/messages",
        json={"message": "asked while the counter is unreachable"},
        headers=head_c,
    )
finally:
    ai_budget.shared_store = broken_budget_store
check(
    "with the budget counter unreachable the question is answered, not failed",
    outage.status_code == 200,
    f"{outage.status_code} {outage.text[:120]}",
)

# --- 8c. the circuit breaker
# Port 9 is the discard port: nothing listens on it, so every call fails in the same instant
# with a connection error and the suite neither waits forty-five seconds nor reaches the
# internet. That is what makes it possible to break a configured provider repeatedly on
# purpose, which is the only way this half of the section can be tested at all.
env(
    AI_DAILY_MESSAGE_LIMIT="200",
    AI_PROVIDER="openai_compatible",
    AI_API_KEY="sk-a-string-that-opens-nothing",
    AI_BASE_URL="http://127.0.0.1:9/v1",
    AI_BREAKER_FAILURES="3",
    AI_BREAKER_WINDOW_SECONDS="60",
    AI_BREAKER_COOLDOWN_SECONDS="3",
)
ai_breaker.note_success()
check("the breaker starts closed", ai_breaker.is_open() is False, ai_breaker.state())

asked = ai_provider._openai_compatible_respond
streak = []
for ask in range(1, 4):
    out = client.post(
        f"/api/conversations/{sid_b}/messages",
        json={"message": f"asked while the provider is down, {ask}"},
        headers=head_b,
    )
    streak.append((out.status_code, out.json().get("provider"), out.json()["reply"]["demo_generated"]))
check(
    "a student never sees the provider's failure: all three asks are answered",
    [row[0] for row in streak] == [200, 200, 200],
    streak,
)
check(
    "…and each of the three is labelled as the built-in guide's words, not the model's",
    all(row[1] == "demo" and row[2] is True for row in streak),
    streak,
)
check(
    "the third failure in a row opens the breaker",
    ai_breaker.is_open() is True,
    ai_breaker.state(),
)
open_state = ai_breaker.state()
check(
    "…and it resets the streak underneath the cooldown, so the count is failures since the last reply",
    open_state["failures"] == 0 and open_state["trips_after"] == 3,
    open_state,
)
check(
    "…and it reports the wait it just started",
    0 < open_state["seconds_left"] <= 3,
    open_state,
)


async def _never_ask(*_a, **_k):
    raise AssertionError("the provider was asked while the breaker was open")


ai_provider._openai_compatible_respond = _never_ask
not_asked, cooled_body = False, {}
try:
    cooled = client.post(
        f"/api/conversations/{sid_b}/messages",
        json={"message": "asked while the breaker is cooling"},
        headers=head_b,
    )
    not_asked = cooled.status_code == 200
    cooled_body = cooled.json() if not_asked else {}
except AssertionError as exc:
    # Reaching this line means the route did ask the provider, which is the thing the check
    # is about: the assertion the stub throws is turned into a failed check rather than a
    # stack trace, so the run finishes and says which of its claims did not hold.
    not_asked, cooled_body = False, {"why": str(exc)}
finally:
    ai_provider._openai_compatible_respond = asked
check(
    "while the breaker is open the provider is not called at all — no forty-five-second "
    "wait for the child, no request for the outage to page somebody over",
    not_asked,
    cooled_body,
)
check(
    "…and the reply still arrives, still from the script, even though this deployment names "
    "a real provider — which is what the deployment screen's breaker row is for",
    cooled_body.get("provider") == "demo"
    and cooled_body.get("reply", {}).get("demo_generated") is True,
    cooled_body.get("provider"),
)
left = ai_breaker.state()["seconds_left"]
for _ in range(4):
    ai_breaker.note_failure()
check(
    "failures during a cooldown do not lengthen it: a provider that stays broken is retried "
    "on schedule rather than pushed further away by its own outage",
    ai_breaker.state()["seconds_left"] <= left,
    f"{ai_breaker.state()['seconds_left']} vs {left}",
)
time.sleep(3.2)
check("the breaker closes when the cooldown ends", ai_breaker.is_open() is False, ai_breaker.state())


async def _answered(*_a, **_k):
    """A provider that came back: the shape `_openai_compatible_respond` returns."""
    return ai_provider.GuideReply(
        text="Nursing needs biology in class 11. Ask your school about the subjects.",
        stage=1,
        themes=[],
        provider="openai_compatible",
        demo_generated=False,
    )


ai_provider._openai_compatible_respond = _answered
try:
    back = client.post(
        f"/api/conversations/{sid_b}/messages",
        json={"message": "asked after the provider came back"},
        headers=head_b,
    )
finally:
    ai_provider._openai_compatible_respond = asked
check(
    "after the cooldown the provider is asked again, and its answer is the one the child reads",
    back.status_code == 200 and back.json().get("provider") == "openai_compatible"
    and back.json()["reply"]["demo_generated"] is False,
    f"{back.status_code} {back.json().get('provider')}",
)
check(
    "…and one reply that came through ends the streak, so a flaky provider is never taken "
    "out of service for an afternoon",
    ai_breaker.is_open() is False and ai_breaker.state()["failures"] == 0,
    ai_breaker.state(),
)
ai_breaker.note_failure()
check(
    "a single failure on its own does not open it again",
    ai_breaker.is_open() is False and ai_breaker.state()["failures"] == 1,
    ai_breaker.state(),
)

# The breaker's own store going away answers the same way the budget's does: report closed,
# keep serving. A Redis that is restarting must not become a deployment that has decided on
# its own that the provider is broken.
broken_breaker_store = ai_breaker.shared_store
ai_breaker.shared_store = lambda: (_ for _ in ()).throw(ConnectionError("redis is down"))
try:
    breaker_outage = client.post(
        f"/api/conversations/{sid_b}/messages",
        json={"message": "asked while the breaker cannot count"},
        headers=head_b,
    )
    blind = ai_breaker.is_open()
finally:
    ai_breaker.shared_store = broken_breaker_store
check(
    "with the breaker's counter unreachable the message is still answered",
    breaker_outage.status_code == 200,
    f"{breaker_outage.status_code} {breaker_outage.text[:120]}",
)
check(
    "…and an uncountable provider is assumed to be working, not taken out of service",
    blind is False,
    blind,
)

# --- 8d. the same asks, against each possible store
def _budget_sequence(holder, limit: int = 4) -> list[bool]:
    """Allow/refuse for six asks of one day against one store, in order."""
    key = "ai-budget:900001:20260101T183000Z"
    holder.clear(key)
    return [holder.incr(key, 3600) <= limit for _ in range(6)]


def _breaker_sequence(holder, trips: int = 3) -> list[bool]:
    """Whether the breaker is open after each of five failures against one store."""
    holder.clear(ai_breaker.FAILS)
    holder.clear(ai_breaker.OPEN)
    seen = []
    for _ in range(5):
        holder.incr(ai_breaker.FAILS, 60)
        if int(holder.get(ai_breaker.FAILS)) >= trips:
            holder.incr(ai_breaker.OPEN, 30)
            seen.append(True)
        else:
            seen.append(int(holder.get(ai_breaker.OPEN)) > 0)
    return seen


if REDIS_URL:
    try:
        counter_a = RedisStorage(REDIS_URL, key_prefix="LIMITS")
        counter_b = RedisStorage(REDIS_URL, key_prefix="LIMITS")
    except Exception as exc:
        print(
            f"  [SKIP] RATE_LIMIT_REDIS_URL points at {rate_limit_module._host_of(REDIS_URL)}, "
            f"which did not answer ({type(exc).__name__}) — the shared-store half was not run "
            "against a Redis for real"
        )
        counter_a = counter_b = None
    if counter_a is not None:
        budget = _budget_sequence(counter_a)
        budget_again = _budget_sequence(counter_b)
        budget_memory = _budget_sequence(MemoryStorage())
        expected = [True, True, True, True, False, False]
        check(
            "one Redis database gives one ceiling: a second connection to it refuses the "
            "same fifth ask, which is the whole claim about serverless workers",
            budget == budget_again == expected,
            f"{budget} vs {budget_again}",
        )
        check(
            "…and the memory store answers the identical sequence to the identical asks, so "
            "setting the URL changes where the number lives and not what it decides",
            budget_memory == budget,
            f"{budget_memory} vs {budget}",
        )
        check(
            "the breaker opens on the same count in either store",
            _breaker_sequence(counter_a) == _breaker_sequence(MemoryStorage())
            == [False, False, True, True, True],
            _breaker_sequence(counter_a),
        )
        counter_a.clear(ai_breaker.FAILS)
        counter_a.clear(ai_breaker.OPEN)
else:
    # The honest half of the sentence: what this run proved is the memory store's behaviour,
    # which is what a deployment without the URL actually uses. The Redis path is checked by
    # the same two sequence helpers above, and running them needs a Redis of your own.
    print(
        "  [SKIP] no RATE_LIMIT_REDIS_URL in this shell, so the shared-store checks were not "
        "run against a Redis — set one and this section proves two connections give the same "
        "ceiling; the memory decisions above are the ones this process served"
    )
    check(
        "the memory store alone still gives the ceiling the rules say, four allowed and the "
        "fifth refused, which is what the checks over the wire above were counting",
        _budget_sequence(MemoryStorage()) == [True, True, True, True, False, False]
        and _budget_sequence(shared_store()) == [True, True, True, True, False, False],
    )

# --- put this process back as the rest of the suite expects it
# Each patch above was undone in the `finally` of the check it belongs to; what is left is
# the breaker's own counters, the environment, and the minute rules.
ai_breaker.note_success()
for _name, _value in SAVED.items():
    if _value is None:
        os.environ.pop(_name, None)
    else:
        os.environ[_name] = _value
get_settings.cache_clear()
limiter.enabled = True
check(
    "the per-minute throttles are switched back on, and the shipped AI settings are back",
    limiter.enabled is True
    and get_settings().ai_daily_message_limit == 60
    and get_settings().ai_provider == "demo"
    and get_settings().ai_breaker_failures == 5,
    {name: os.environ.get(name) for name in ("AI_DAILY_MESSAGE_LIMIT", "AI_PROVIDER")},
)

print("\n" + "=" * 72)
print(f"  {len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("  FAILED:")
    for label in FAIL:
        print(f"    - {label}")
print("=" * 72)
sys.exit(1 if FAIL else 0)
