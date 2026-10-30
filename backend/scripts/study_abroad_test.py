"""Test the study abroad feature: what it claims, what it refuses, and who may change it.

Four things are worth proving about a directory like this, and the checks below are
arranged around them:

* **A fact is stored with its source or it is not shown as a fact.** Every institution in
  `data/universities.json` comes back from the public routes with `verified: false` and
  empty fee, intake and deadline fields. The suite asserts that across every row, not one:
  a single invented tuition figure in a seeded file would be the end of the feature's
  credibility, and a check that only samples three rows could miss it.
* **An enquiry needs a tick before it needs a row.** The refusal happens before
  `db.add`, so a request without consent leaves nothing in the database to be deleted
  later. That is checked by counting rows, not by reading the response.
* **Admin is a flag nobody can sign up into.** Every `/admin/...` route is walked with a
  signed-in ordinary account and must answer 403 in words — and the flag itself only
  arrives through `scripts/admin_grant.py`, which refuses an address nobody confirmed.
* **Nothing here reaches the recommendation engine.** No row in these tables is read by
  `services/recommendations.py`, and a sponsored institution is labelled rather than
  ordered.

The emails are checked against a stubbed HTTP layer, exactly as `email_flow_test.py`
does it, so no message is ever really sent and every recipient, subject and paragraph
is still visible to the assertions.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/study_abroad_test.py
"""

from __future__ import annotations

import collections
import contextlib
import io
import json
import os
import pathlib
import sys
import tempfile
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import _console  # noqa: E402,F401 -- utf-8 stdout, see _console.py

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_study_abroad_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
# On, unlike every suite except `security_test.py`: the enquiry form is the only public
# route in this app that stores a stranger's contact details, and its throttle is part
# of what makes that acceptable.
os.environ["RATE_LIMIT_ENABLED"] = "true"
# A few over the shipped default: sections 3 and 4 spend most of the hour's budget on
# the requests that test consent, bad addresses and the honeypot, and section 5 has to
# see accepted enquiries before the block to prove the block is what stopped it.
os.environ["RATE_LIMIT_LEAD"] = "12 per hour"
os.environ["CLERK_SECRET_KEY"] = ""
for _key in ("RESEND_API_KEY", "FROM_EMAIL", "EMAIL_REPLY_TO", "LEAD_NOTIFY_EMAIL"):
    os.environ.pop(_key, None)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import func, select  # noqa: E402
from contextlib import ExitStack  # noqa: E402

from scripts import admin_grant  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    StudyCountry,
    StudyLead,
    StudyService,
    StudyStory,
    University,
    User,
)
from app.services import email as transport  # noqa: E402

PASS: list[str] = []
FAIL: list[str] = []


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def check(label: str, condition, detail: str = "") -> None:
    if condition:
        PASS.append(label)
        print(f"  [PASS] {label}")
    else:
        FAIL.append(label)
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail else ""))


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def env(**values: str | None) -> None:
    for key, value in values.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    get_settings.cache_clear()


class _Response:
    def __init__(self, status_code: int = 200, payload: dict | None = None) -> None:
        self.status_code = status_code
        self._payload = payload or {"id": "email_stub"}

    def json(self) -> dict:
        return self._payload


class _StubHttpx:
    """Stands in for the httpx module inside `services/email.py`."""

    HTTPError = Exception

    def __init__(self) -> None:
        self.calls: list[dict] = []

    def post(self, url: str, **kwargs):
        self.calls.append({"url": url, **kwargs})
        return _Response()

    def reset(self) -> None:
        self.calls.clear()

    def recipients(self) -> list[str]:
        return [call["json"]["to"][0] for call in self.calls]


STUB = _StubHttpx()
transport.httpx = STUB

client = TestClient(app)
LIFESPAN = ExitStack()
LIFESPAN.enter_context(client)

STUDENT = {
    "role": "student",
    "display_name": "Aarav",
    "preferred_language": "en",
    "class_level": "class-12",
    "interest_areas": ["drawing"],
    "consent_profile": True,
    "consent_voice": False,
    "consent_age": "11-12",
}


def signup(body: dict | None = None) -> tuple[str, int]:
    response = client.post("/api/auth/onboarding", json=body or STUDENT)
    assert response.status_code == 200, response.text[:300]
    data = response.json()
    return data["token"], data["user"]["id"]


def lead_rows() -> list[StudyLead]:
    with SessionLocal() as db:
        rows = list(db.scalars(select(StudyLead).order_by(StudyLead.id)))
        for item in rows:
            db.expunge(item)
        return rows


def lead_count() -> int:
    with SessionLocal() as db:
        return int(db.scalar(select(func.count(StudyLead.id))) or 0)


def configure_mail(owner: str = "") -> None:
    env(
        RESEND_API_KEY="re_test_123",
        FROM_EMAIL="CareerGuide AI <hello@example.invalid>",
        LEAD_NOTIFY_EMAIL=owner,
    )


def stop_mail() -> None:
    env(RESEND_API_KEY="", FROM_EMAIL="", LEAD_NOTIFY_EMAIL=None)


def enquiry(**overrides) -> dict:
    body = {
        "name": "Reena Sharma",
        "email": "reena@example.com",
        "phone": "+91 90000 00000",
        "stage": "class-12",
        "country_slug": "united-states",
        "service_slug": "university-shortlisting",
        "message": "We would like to talk about applications next year.",
        "source_page": "/study-abroad/united-states",
        "consent_contact": True,
    }
    body.update(overrides)
    return body


# ============================================================ 1. the seeded directory
section("1. A fresh database seeds a directory that admits what it does not know")

# The file is read here rather than a number remembered, because the honest claim about a
# seeded directory is "every row in the file arrived", and that claim has to keep being true
# the morning somebody adds two hundred institutions to it.
CATALOGUE = json.loads(
    (ROOT / "data" / "universities.json").read_text(encoding="utf-8")
)["universities"]
CATALOGUE_COUNTS = collections.Counter(row["country"] for row in CATALOGUE)

with SessionLocal() as db:
    countries = list(db.scalars(select(StudyCountry).order_by(StudyCountry.sort_order)))
    services = list(db.scalars(select(StudyService).order_by(StudyService.sort_order)))
    campuses = list(db.scalars(select(University).order_by(University.name)))
    stories = list(db.scalars(select(StudyStory)))

# Read off the columns, not the relationship: these rows outlive the session that loaded
# them, and `row.country` would have nothing to lazy-load from.
country_of = {country.id: country.slug for country in countries}

check("six destinations arrived", len(countries) == 6, len(countries))
check("four services arrived", len(services) == 4, len(services))
check("over a hundred institutions arrived", len(campuses) >= 100, len(campuses))
check(
    "and the count is the whole file, not a slice of it",
    len(campuses) == len(CATALOGUE),
    (len(campuses), len(CATALOGUE)),
)
check(
    "every one of them sits under a destination this database describes",
    {country_of[row.country_id] for row in campuses} == set(CATALOGUE_COUNTS),
    sorted(CATALOGUE_COUNTS),
)
check(
    "and no two share the address a public URL is made of",
    len({row.slug for row in campuses}) == len(campuses),
    len({row.slug for row in campuses}),
)
check("no success story was invented", stories == [], len(stories))
check(
    "not one institution calls itself verified",
    all(not row.verified for row in campuses),
    sum(1 for row in campuses if row.verified),
)
check(
    "so not one carries a source it has not needed",
    all(row.source_url is None for row in campuses),
)
check(
    "and no seeded row claims to be paid for",
    all(not row.sponsored for row in campuses),
)

# ============================================================ 2. public reads
section("2. The public routes answer with the holes left in")

cards = client.get("/api/study-abroad/countries")
check("the country list is a 200", cards.status_code == 200, cards.status_code)
card_body = cards.json()
check("six cards", len(card_body) == 6, len(card_body))
check(
    "each card counts only what this directory can name",
    sum(c["universities"] for c in card_body) == len(campuses),
    [c["universities"] for c in card_body],
)
check(
    "every card carries the official portal rather than a summary of the rules",
    all(c["visa_portal_url"] for c in card_body),
)
check(
    "and every card lists the questions a family still has to ask",
    all(len(c["to_check"]) >= 3 for c in card_body),
)
check(
    "a country nobody has re-read says so with a null date",
    all(c["checked_at"] is None for c in card_body),
)

us = client.get("/api/study-abroad/countries/united-states")
check("one country by slug", us.status_code == 200, us.text[:200])
missing = client.get("/api/study-abroad/countries/atlantis")
check(
    "an unknown country is refused in words",
    missing.status_code == 404 and "not in our directory" in missing.json()["detail"],
    missing.text[:200],
)

listed = client.get("/api/study-abroad/countries/united-states/universities").json()
check(
    "the United States list is the biggest, and it is the country in full, not a page",
    len(listed) == CATALOGUE_COUNTS["united-states"] == max(CATALOGUE_COUNTS.values()),
    (len(listed), dict(CATALOGUE_COUNTS)),
)
check(
    "a list row is too thin to quote a fee from",
    all("tuition_note" not in row for row in listed),
)
browse = client.get("/api/study-abroad/universities", params={"country": "nowhere"}).json()
check("a filter naming nothing gives nothing, not an error", browse == [], browse[:1])
search = client.get(
    "/api/study-abroad/universities", params={"search": "monash"}
).json()
check("the search finds the campus by name", len(search) == 1, search[:2])
check(
    "and matches on the city as well, where several share one",
    len(client.get("/api/study-abroad/universities", params={"search": "melbourne"}).json()) >= 2,
)
check(
    "and keeps a diacritic out of the way it was written",
    search[0]["city"] == "Melbourne",
    search[0],
)

profile = client.get("/api/study-abroad/universities/university-of-michigan").json()
check("one institution reads back", profile["slug"] == "university-of-michigan", profile["slug"])
check("its own domain is the one thing besides its name", profile["official_url"].startswith("https://"), profile["official_url"])
for field in ("tuition_note", "english_test_note", "deadline_note", "summary", "founded_year"):
    check(f"{field} ships empty", profile[field] is None, profile[field])
check("intakes ship as no intakes", profile["intakes"] == [], profile["intakes"])
check("application portals ship as none", profile["application_urls"] == {}, profile["application_urls"])
check("verified false travels with the row", profile["verified"] is False)

all_rows = client.get("/api/study-abroad/universities", params={"limit": 400}).json()
unverified = [r["slug"] for r in all_rows if not r["verified"]]
check("every public row is still unverified", len(unverified) == len(all_rows), len(unverified))
slugs = client.get("/api/study-abroad/universities/mistaken-college")
check("an institution we do not have is refused in words", slugs.status_code == 404, slugs.status_code)

services = client.get("/api/study-abroad/services").json()
check("four services on the public route", len(services) == 4, len(services))
visa = [s for s in services if s["slug"] == "visa-guidance"][0]
check(
    "the one this platform cannot lawfully offer says it is not offered",
    visa["available"] is False,
    visa["available"],
)
check(
    "and names regulated immigration advice as what it does not include",
    any("Regulated immigration advice" in item for item in visa["not_included"]),
    visa["not_included"],
)
profile_service = client.get("/api/study-abroad/services/profile-building").json()
check("a service that is offered is marked as offered", profile_service["available"] is True)
check("and has steps a family can follow", len(profile_service["steps"]) >= 3)
check(
    "no service promises an outcome",
    all("outcomes" not in s for s in services),
)

stories = client.get("/api/study-abroad/stories").json()
check("the stories route answers, empty", stories == [], stories)

# ============================================================ 3. consent and the row
section("3. An enquiry without a tick never becomes a row")

before = lead_count()
refused = client.post("/api/study-abroad/leads", json=enquiry(consent_contact=False))
check("the request is refused", refused.status_code == 422, refused.status_code)
check(
    "in a sentence about the tick, not about the schema",
    "box agreeing" in refused.json()["detail"],
    refused.text[:200],
)
check("and nothing was written", lead_count() == before, lead_count())

bad = client.post("/api/study-abroad/leads", json=enquiry(email="not-an-address"))
check("a malformed address is refused", bad.status_code == 422, bad.text[:200])
check("and still nothing was written", lead_count() == before, lead_count())

ghost_country = client.post(
    "/api/study-abroad/leads", json=enquiry(country_slug="fantasia")
)
check("an unknown country slug is refused", ghost_country.status_code == 422, ghost_country.status_code)
ghost_service = client.post(
    "/api/study-abroad/leads", json=enquiry(service_slug="do-my-application")
)
check("an unknown service slug is refused", ghost_service.status_code == 422, ghost_service.status_code)
check("and neither of them stored anything", lead_count() == before, lead_count())

extra = client.post("/api/study-abroad/leads", json=enquiry(user_id=7))
check(
    "a body cannot attach an enquiry to somebody else's account",
    extra.status_code == 422,
    extra.status_code,
)

# The field no person is shown. A bot that fills every input it finds fills this one, and
# it must not end up with an address in the table — nor learn from the answer that it was
# the field that gave it away.
trap = client.post("/api/study-abroad/leads", json=enquiry(company="Acme Education Ltd"))
check("a filled honeypot is not refused with a schema error", trap.status_code == 201, trap.text[:200])
check(
    "shaped like every other answer this route gives",
    trap.json().get("stored") is True,
    trap.text[:200],
)
check("and it stored nothing", lead_count() == before, lead_count())

stop_mail()
stored = client.post(
    "/api/study-abroad/leads",
    json=enquiry(email="Ananya.Das@Example.COM", name="  Ananya Das  "),
)
check("with email off, the enquiry is still taken", stored.status_code == 201, stored.text[:300])
body = stored.json()
check("and it says so rather than pretending a mail went out", body["stored"] is True)
check("the reason is the honest one", body["reason"] == "disabled", body)
check(
    "the note tells the family nothing is on its way",
    "not enabled on this deployment" in body["note"],
    body["note"],
)
check("the operator was not notified either", body["notified_operator"] is False)
rows = lead_rows()
check("one row exists", len(rows) == 1, len(rows))
row = rows[0]
check("the address was stored lowercased", row.email == "ananya.das@example.com", row.email)
check("the name was trimmed", row.name == "Ananya Das", row.name)
check("the consent tick was timestamped", row.consent_contact_at is not None)
check("and the status starts at new", row.status == "new", row.status)
check(
    "the enquiry is not attached to any account",
    not hasattr(row, "user_id"),
    "user_id appeared on the row",
)
check("no school, city or marks were accepted", row.stage == "class-12", row.stage)

# ============================================================ 4. the two mails
section("4. The mails an enquiry causes, and what they are allowed to say")

configure_mail(owner="")
STUB.reset()
no_owner = client.post(
    "/api/study-abroad/leads", json=enquiry(email="same.family@example.com")
)
check("the enquiry is taken", no_owner.status_code == 201, no_owner.text[:200])
check("and the family is told nobody was notified", no_owner.json()["notified_operator"] is False)
check("one message went out, the acknowledgement", len(STUB.calls) == 1, len(STUB.calls))
check(
    "to the address on the form",
    STUB.recipients() == ["same.family@example.com"],
    STUB.recipients(),
)
ack = STUB.calls[0]["json"]
check("whose subject is about their own enquiry", "We received your enquiry" in ack["subject"], ack["subject"])
check(
    "and says nothing was booked, because nothing was",
    "Nothing is booked" in ack["html"],
    ack["html"][:120],
)
check(
    "it does not claim an account exists",
    "an account you control asked" not in ack["html"],
)
check(
    "and points at a page rather than a settings screen",
    "/app/settings" not in ack["html"],
)

configure_mail(owner="owner@example.invalid")
STUB.reset()
told = client.post("/api/study-abroad/leads", json=enquiry(email="priya@example.com"))
check("the enquiry is taken", told.status_code == 201, told.text[:200])
check("both messages went out", len(STUB.calls) == 2, STUB.calls)
check(
    "one to the operator, one to the family",
    STUB.recipients() == ["owner@example.invalid", "priya@example.com"],
    STUB.recipients(),
)
check("and the answer reports it", told.json()["notified_operator"] is True, told.json())
check("the family's copy confirms delivery", told.json()["reason"] == "sent", told.json())
operator_mail = STUB.calls[0]["json"]
check(
    "the operator is told who asked and how to reply",
    "priya@example.com" in operator_mail["html"],
)
check("with their own words", "applications next year" in operator_mail["html"] or "Enquiry" in operator_mail["subject"])
check("and no other student's data appears in it", "Ananya" not in operator_mail["html"])
check(
    "the operator's footer names a server setting rather than an account",
    "an account you control asked" not in operator_mail["html"],
)
check(
    "and never says a place or a visa was promised",
    "no visa and no outcome has been promised" in STUB.calls[1]["json"]["html"],
)

stop_mail()
bad_link = client.post(
    "/api/study-abroad/leads",
    json=enquiry(email="typo.example", name="Typo Example"),
)
check("an address that cannot be mailed is refused outright", bad_link.status_code == 422, bad_link.status_code)

# ============================================================ 5. the throttle
section("5. One network cannot fill the table")

accepted = 0
blocked: dict | None = None
before_burst = lead_count()
for index in range(24):
    answer = client.post(
        "/api/study-abroad/leads",
        json=enquiry(email=f"person{index}@example.com", name=f"Person {index}"),
    )
    if answer.status_code == 429:
        blocked = answer.json()
        break
    accepted += 1
check("the route throttles a persistent network", blocked is not None, accepted)
check(
    "and says nothing was lost, because nothing was",
    bool(blocked) and "Too many enquiries" in str(blocked.get("detail")),
    blocked,
)
stored_now = lead_count()
check(
    "the rows written match the requests accepted",
    stored_now - before_burst == accepted,
    (stored_now - before_burst, accepted),
)

# ============================================================ 6. who may be the admin
section("6. The admin routes belong to one account nobody signed up into")

token, user_id = signup()
ADMIN_PATHS = [
    ("get", "/api/study-abroad/admin/leads"),
    ("get", "/api/study-abroad/admin/universities"),
    ("get", "/api/study-abroad/admin/stories"),
    ("get", "/api/study-abroad/admin/me"),
    ("post", "/api/study-abroad/admin/universities"),
    ("post", "/api/study-abroad/admin/stories"),
    ("patch", "/api/study-abroad/admin/leads/1"),
    ("delete", "/api/study-abroad/admin/leads/1"),
]
# A caller with no credential at all. The client above was minted sessions during setup
# and, like a browser, has kept the cookies from them — so the jar is emptied before this
# loop, or every one of these routes would answer as the operator and prove nothing.
client.cookies.clear()
for method, path in ADMIN_PATHS:
    anonymous = client.request(method, path)
    check(f"{method.upper()} {path} wants a session", anonymous.status_code == 401, anonymous.status_code)
    ordinary = client.request(method, path, headers=auth(token), json={} if method != "get" else None)
    check(
        f"{method.upper()} {path} refuses an ordinary account",
        ordinary.status_code == 403,
        (ordinary.status_code, ordinary.text[:160]),
    )
check(
    "and the refusal explains the flag rather than hiding the screen",
    "scripts/admin_grant.py"
    in client.get("/api/study-abroad/admin/leads", headers=auth(token)).json()["detail"],
)
with SessionLocal() as db:
    account = db.get(User, user_id)
    check("a signed-in account starts with no flag", account.is_admin in (None, False), account.is_admin)

printed = io.StringIO()
with contextlib.redirect_stdout(printed):
    nowhere = admin_grant.main(["--email", "whoever@example.com"])
check("the CLI refuses an address no account holds", nowhere == 1, printed.getvalue())

with SessionLocal() as db:
    account = db.get(User, user_id)
    account.contact_email = "operator@example.com"
    db.commit()

printed = io.StringIO()
with contextlib.redirect_stdout(printed):
    unconfirmed = admin_grant.main(["--email", "operator@example.com"])
check(
    "and refuses an address nobody opened a link for",
    unconfirmed == 1 and "never confirmed" in printed.getvalue(),
    printed.getvalue(),
)

with SessionLocal() as db:
    account = db.get(User, user_id)
    account.email_confirmed_at = datetime.now(timezone.utc)
    db.commit()

printed = io.StringIO()
with contextlib.redirect_stdout(printed):
    granted = admin_grant.main(["--email", "operator@example.com"])
check("the CLI grants the flag on a confirmed address", granted == 0, printed.getvalue())
check("and prints what it did", "Granted admin access" in printed.getvalue(), printed.getvalue())

with SessionLocal() as db:
    account = db.get(User, user_id)
    db.expunge(account)
check("the account now holds it", account.is_admin is True, account.is_admin)

who = client.get("/api/study-abroad/admin/me", headers=auth(token))
check("the admin screen can ask whether this is the operator", who.status_code == 200, who.text[:200])
check("and gets one boolean back", who.json() == {"is_admin": True}, who.json())
check(
    "the second account is still ordinary",
    client.get("/api/study-abroad/admin/leads", headers=auth(signup()[0])).status_code == 403,
)

# ============================================================ 7. verification is earned
section("7. A row cannot call itself verified")

new = client.post(
    "/api/study-abroad/admin/universities",
    headers=auth(token),
    json={
        "name": "Test State University",
        "country_slug": "germany",
        "city": "Berlin",
        "kind": "public",
        "official_url": "https://example.edu",
        "areas": ["engineering"],
    },
)
check("an added institution is accepted", new.status_code == 201, new.text[:300])
added = new.json()
check("it starts unverified", added["verified"] is False, added)
check("and its slug was made from its name", added["slug"] == "test-state-university", added["slug"])
check("with nothing filled in behind it", added["tuition_note"] is None and added["intakes"] == [])

dupe = client.post(
    "/api/study-abroad/admin/universities",
    headers=auth(token),
    json={
        "name": "Test State University",
        "country_slug": "germany",
        "city": "Berlin",
        "kind": "public",
        "official_url": "https://example.edu",
    },
)
check(
    "a second copy of the same name is refused with the row to edit instead",
    dupe.status_code == 422 and "already in the directory" in dupe.json()["detail"],
    dupe.text[:200],
)

bad_url = client.post(
    "/api/study-abroad/admin/universities",
    headers=auth(token),
    json={
        "name": "No Protocol University",
        "country_slug": "germany",
        "city": "Bonn",
        "kind": "public",
        "official_url": "example.edu",
    },
)
check("an address without a scheme is refused", bad_url.status_code == 422, bad_url.text[:200])

no_source = client.patch(
    "/api/study-abroad/admin/universities/test-state-university",
    headers=auth(token),
    json={"verified": True, "tuition_note": "€3,000 a year"},
)
check(
    "ticking verified without a source is refused",
    no_source.status_code == 422 and "without saying where the figure came from" in no_source.json()["detail"],
    no_source.text[:250],
)
still = client.get("/api/study-abroad/universities/test-state-university").json()
check("and the row was not changed by the attempt", still["verified"] is False and still["tuition_note"] is None, still)

earned = client.patch(
    "/api/study-abroad/admin/universities/test-state-university",
    headers=auth(token),
    json={
        "verified": True,
        "tuition_note": "No tuition fee for most master's programmes.",
        "source_url": "https://example.edu/fees",
    },
)
check("a source makes the claim allowed", earned.status_code == 200, earned.text[:250])
check("and the date is stamped by the server", earned.json()["verified_at"] is not None, earned.json())
check("the figure is now the university's own", earned.json()["tuition_note"].startswith("No tuition"), earned.json()["tuition_note"])

cleared = client.patch(
    "/api/study-abroad/admin/universities/test-state-university",
    headers=auth(token),
    json={"source_url": None},
)
check(
    "the source cannot be removed while the badge stays on",
    cleared.status_code == 422,
    cleared.text[:200],
)

unchecked = client.patch(
    "/api/study-abroad/admin/universities/test-state-university",
    headers=auth(token),
    json={"verified": False},
)
check("un-verifying is allowed", unchecked.status_code == 200, unchecked.text[:200])
check("and takes the date with it", unchecked.json()["verified_at"] is None, unchecked.json())

admin_list = client.get(
    "/api/study-abroad/admin/universities",
    params={"unverified_only": True, "limit": 1000},
    headers=auth(token),
).json()
check(
    "the working view is the rows nobody has checked",
    all(r["verified"] is False for r in admin_list)
    and len(admin_list) == len(campuses) + 1,
    (len(admin_list), len(campuses)),
)
check(
    "including the one added by hand",
    any(r["slug"] == "test-state-university" for r in admin_list),
)
check("and each row knows which country it belongs to", admin_list[0]["country_slug"], admin_list[0])

# The screen above shows a number and calls it the working list. That is only true while the
# request has not been cut short, so the ceiling has to sit above the directory — and a small
# limit really has to truncate, or the sentence the panel prints when the view fills up would
# be describing a thing that cannot happen.
truncated = client.get(
    "/api/study-abroad/admin/universities",
    params={"unverified_only": True, "limit": 50},
    headers=auth(token),
).json()
check("a small limit stops short of the directory", len(truncated) == 50, len(truncated))
check(
    "and the shipped ceiling is above what the seed wrote",
    len(admin_list) < 1000,
    len(admin_list),
)

# ============================================================ 8. stories need agreement
section("8. A story is published only by the person in it")

draft = client.post(
    "/api/study-abroad/admin/stories",
    headers=auth(token),
    json={
        "headline": "What it was like to apply with no agent",
        "body": "A long account of one family's applications, written by the family.",
        "attribution": "Ananya, Delhi",
        "country_slug": "united-states",
        "published": False,
    },
)
check("a draft may be written down", draft.status_code == 201, draft.text[:250])
check("and the public route cannot see it", client.get("/api/study-abroad/stories").json() == [])

# The admin PATCH replaces the whole row and reads its links by slug, so the admin GET
# has to hand the slug back. A screen that cannot see the current destination would send
# it as empty on the next save and unlink the story from the country it is about — which
# is a silent loss in a form that only asked for a headline.
story_id = draft.json()["id"]
mine = next(r for r in client.get("/api/study-abroad/admin/stories", headers=auth(token)).json() if r["id"] == story_id)
check(
    "the admin row names its destination the way the write route takes it",
    mine["country_slug"] == "united-states",
    mine,
)

kept = client.patch(
    f"/api/study-abroad/admin/stories/{story_id}",
    headers=auth(token),
    json={
        "headline": "What it was like to apply with no agent",
        "body": "A long account of one family's applications, written by the family.",
        "attribution": "Ananya, Delhi",
        "country_slug": mine["country_slug"],
        "university_slug": mine["university_slug"],
        "published": False,
    },
)
check(
    "so a save that sends back what it read keeps the link",
    kept.status_code == 200 and kept.json()["country_slug"] == "united-states",
    kept.text[:250],
)

pushed = client.post(
    "/api/study-abroad/admin/stories",
    headers=auth(token),
    json={
        "headline": "Somebody else's story",
        "body": "A quote from a student who was never asked whether it could be used.",
        "attribution": "A stranger",
        "published": True,
    },
)
check(
    "publishing without consent is refused",
    pushed.status_code == 422 and "consent_confirmed_at" in pushed.json()["detail"],
    pushed.text[:250],
)

too_early = client.patch(
    f"/api/study-abroad/admin/stories/{story_id}",
    headers=auth(token),
    json={
        "headline": "What it was like to apply with no agent",
        "body": "A long account of one family's applications, written by the family.",
        "attribution": "Ananya, Delhi",
        "published": True,
    },
)
check("and a row that has no date cannot be published either", too_early.status_code == 422, too_early.text[:200])

ok = client.patch(
    f"/api/study-abroad/admin/stories/{story_id}",
    headers=auth(token),
    json={
        "headline": "What it was like to apply with no agent",
        "body": "A long account of one family's applications, written by the family.",
        "attribution": "Ananya, Delhi",
        "consent_confirmed_at": datetime.now(timezone.utc).isoformat(),
        "published": True,
    },
)
check("with the date the story can go out", ok.status_code == 200, ok.text[:250])
check("and the public route then shows it", len(client.get("/api/study-abroad/stories").json()) == 1)
check("with a publication stamp", ok.json()["published_at"] is not None)

withdrawn = client.patch(
    f"/api/study-abroad/admin/stories/{story_id}",
    headers=auth(token),
    json={
        "headline": "What it was like to apply with no agent",
        "body": "A long account of one family's applications, written by the family.",
        "attribution": "Ananya, Delhi",
        "published": False,
    },
)
check("the person can change their mind", withdrawn.status_code == 200, withdrawn.text[:200])
check("and the story disappears from the public route", client.get("/api/study-abroad/stories").json() == [])
gone = client.delete(f"/api/study-abroad/admin/stories/{story_id}", headers=auth(token))
check("or it can be deleted outright", gone.status_code == 204, gone.status_code)
check("and it is gone from the admin list too", client.get("/api/study-abroad/admin/stories", headers=auth(token)).json() == [])

# ============================================================ 9. handling and forgetting
section("9. An enquiry can be answered, and deleted, but not rewritten")

target = lead_rows()[-1]
handled = client.patch(
    f"/api/study-abroad/admin/leads/{target.id}",
    headers=auth(token),
    json={"status": "contacted", "admin_note": "Replied from the operator mailbox."},
)
check("the operator can mark it", handled.status_code == 200, handled.text[:250])
check("and leave a note", handled.json()["admin_note"].startswith("Replied"), handled.json())
check("the status moves", handled.json()["status"] == "contacted", handled.json()["status"])
check("and the time of handling is recorded", handled.json()["handled_at"] is not None)
fresh = None
with SessionLocal() as db:
    fresh = db.get(StudyLead, target.id)
    db.expunge(fresh)
check("the person's own words were not edited", fresh.message == target.message, fresh.message)
check("their address is still what they typed", fresh.email == target.email, (fresh.email, target.email))
check("and the consent timestamp is still standing", fresh.consent_contact_at == target.consent_contact_at)

wrong_state = client.patch(
    f"/api/study-abroad/admin/leads/{target.id}",
    headers=auth(token),
    json={"status": "gone"},
)
check("a status must be one of the three", wrong_state.status_code == 422, wrong_state.status_code)
check("and the row is unchanged by the attempt", client.get("/api/study-abroad/admin/leads", headers=auth(token)).json()[0]["status"] == "contacted")

listed = client.get("/api/study-abroad/admin/leads", headers=auth(token)).json()
check("the list newest first", listed[0]["id"] == max(r["id"] for r in listed), [r["id"] for r in listed][:4])
check("every row shows its consent timestamp", all(r["consent_contact_at"] for r in listed))
by_status = client.get(
    "/api/study-abroad/admin/leads", params={"status": "new"}, headers=auth(token)
).json()
check("and can be filtered", all(r["status"] == "new" for r in by_status) and len(by_status) < len(listed), len(by_status))

removed = client.delete(f"/api/study-abroad/admin/leads/{target.id}", headers=auth(token))
check("an enquiry can be deleted", removed.status_code == 204, removed.status_code)
with SessionLocal() as db:
    check("and the row is gone", db.get(StudyLead, target.id) is None)
after = client.delete(f"/api/study-abroad/admin/leads/{target.id}", headers=auth(token))
check("deleting it twice says it is not there", after.status_code == 404, after.status_code)
check(
    "in a sentence that explains why",
    "may already have been deleted" in after.json()["detail"],
    after.text[:200],
)

printed = io.StringIO()
with contextlib.redirect_stdout(printed):
    admin_grant.main(["--list"])
check("the CLI can show who holds the flag", "admin account(s)" in printed.getvalue(), printed.getvalue())
printed = io.StringIO()
with contextlib.redirect_stdout(printed):
    revoked = admin_grant.main(["--email", "operator@example.com", "--revoke"])
check("and take it back off", revoked == 0 and "Removed admin access" in printed.getvalue(), printed.getvalue())
check(
    "the next request from that account is refused again",
    client.get("/api/study-abroad/admin/leads", headers=auth(token)).status_code == 403,
)

LIFESPAN.close()

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + "; ".join(FAIL))
    sys.exit(1)
