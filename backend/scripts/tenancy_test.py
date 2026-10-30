"""Test the portals: what an invitation is, what it is not, and who may see whose rows.

Five things are worth proving about a multi-tenant feature bolted onto an app about
children, and the sections below are arranged around them rather than around the route
list:

* **An invitation grants nothing, and that is a database fact.** A waiting row holds an
  address and a digest; it has no `user_id`, and the only route that can set one is the
  accept call made by the browser that opened the link. The suite proves this the hard way
  — by reading a roster as the invited person's own account *before* accepting, and again
  by watching which columns are NULL on either side of the accept.
* **A role inside an organisation is not a role on an account.** `counsellor` and
  `school_admin` come from the membership row on every request, so a student who is
  invited into a school as its counsellor is refused in words, and a school administrator
  is not the platform's administrator and cannot close their own portal.
* **Five is a cohort and four is a naming exercise.** Every analytics breakdown under the
  floor is dropped and named in `hidden`, so a head teacher sees the guard fire rather than
  wondering why a class is missing from a chart.
* **A counsellor's caseload is not their school's intake.** The same
  `client_is_visible` rule that limits the roster limits the analytics, and a note is
  readable by its author alone until the author shares it.
* **Nothing about a child's work leaves these routes.** No response is allowed a key
  containing `answer`, `score`, `transcript`, `report` or `conversation`, and the last
  section asserts that over every JSON body the suite fetched.

The mail is stubbed the way `study_abroad_test.py` stubs it, so no message is sent and the
invite links the templates render are read straight back out of the captured payloads —
which is also how the accept route gets tested through its real input rather than through
a token invented for the test.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/tenancy_test.py
"""

from __future__ import annotations

import os
import pathlib
import re
import sys
import tempfile
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import _console  # noqa: E402,F401 -- utf-8 stdout, see _console.py

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_tenancy_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
# On, because the throttle on the invite route is part of what makes mailing a stranger's
# address acceptable, and a suite that never tests it cannot claim the guard exists.
os.environ["RATE_LIMIT_ENABLED"] = "true"
# Generous for everything except the invite bucket: most sections spend their own budget
# below, and the throttle section at the end is the one that runs it out on purpose.
os.environ["RATE_LIMIT_ORG"] = "200 per minute"
os.environ["RATE_LIMIT_ORG_INVITE"] = "20 per minute"
# Eleven accounts are made below, and a portal invite is addressed to an adult who does
# not have one yet, so the sign-in bucket is the busiest one in this file. Raised, with
# the invite bucket left near its shipped value because that one is under test.
os.environ["RATE_LIMIT_AUTH"] = "200 per minute"
os.environ["CLERK_SECRET_KEY"] = ""
os.environ["TENANT_BASE_DOMAIN"] = "careerguide.localhost"
os.environ["TENANT_TRUST_FORWARDED_HOST"] = "false"
os.environ["ORG_INVITE_VALID_DAYS"] = "21"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import func, select  # noqa: E402
from contextlib import ExitStack  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    Assessment,
    Membership,
    Organization,
    SessionNote,
    User,
)
from app.services import email as transport  # noqa: E402

PASS: list[str] = []
FAIL: list[str] = []

SCHOOL = "green-school"
PRACTICE = "rivera-guidance"
OTHER_SCHOOL = "nilgiri-academy"


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

    def invite_links(self) -> dict[str, str]:
        """Every address that was mailed a portal invitation, with the token it holds.

        Read out of the rendered template rather than returned by the route, because a
        route that handed the token back in its response would be a route that lets anybody
        who can call it accept their own invitation — and that is the exact property this
        suite exists to defend.
        """
        found: dict[str, str] = {}
        for call in self.calls:
            payload = call["json"]
            match = re.search(r"/join\?token=([A-Za-z0-9_-]+)", str(payload.get("html", "")))
            if match:
                found[payload["to"][0]] = match.group(1)
        return found


STUB = _StubHttpx()
transport.httpx = STUB

client = TestClient(app)
LIFESPAN = ExitStack()
LIFESPAN.enter_context(client)

env(RESEND_API_KEY="re_test_123", FROM_EMAIL="CareerGuide AI <hello@example.invalid>")


def signup(
    role: str = "student",
    name: str = "Aarav",
    language: str = "en",
    class_level: str | None = "class-12",
    device: str | None = None,
) -> tuple[str, int]:
    body = {
        "role": role,
        "display_name": name,
        "preferred_language": language,
        "consent_profile": True,
        "consent_voice": False,
        "consent_age": "11-12" if role == "student" else "adult",
    }
    if role == "student" and class_level:
        body["class_level"] = class_level
    if role == "parent":
        body.update({"student_name": "Somebody", "student_class_level": "class-12"})
    if device:
        # `device_id` is validated as 16-64 characters and these fixtures are short labels,
        # so they are padded rather than spelled out six times.
        body["device_id"] = device.ljust(16, "0")
    response = client.post("/api/auth/onboarding", json=body)
    assert response.status_code == 200, response.text[:300]
    data = response.json()
    return data["token"], data["user"]["id"]


def rows_for(slug: str) -> list[Membership]:
    with SessionLocal() as db:
        org = db.scalars(select(Organization).where(Organization.slug == slug)).first()
        if org is None:
            return []
        rows = list(
            db.scalars(
                select(Membership).where(Membership.organization_id == org.id).order_by(
                    Membership.id
                )
            )
        )
        for row in rows:
            db.expunge(row)
        return rows


def row_count(slug: str) -> int:
    return len(rows_for(slug))


def membership_id(slug: str, address: str | None = None, user_id: int | None = None) -> int:
    for row in rows_for(slug):
        if address is not None and row.invited_email == address:
            return row.id
        if user_id is not None and row.user_id == user_id:
            return row.id
    raise AssertionError(f"no membership in {slug} for {address or user_id}")


def org_id(slug: str) -> int:
    with SessionLocal() as db:
        return int(db.scalars(select(Organization.id).where(Organization.slug == slug)).one())


def join_by_hand(slug: str, user_id: int, role: str, label: str, share: bool = False) -> int:
    """Attach a membership without going through the accept route.

    Used only in the analytics section, where the subject is a five-person floor rather
    than the door. Every membership that section counts was already proven reachable by
    the real door in section 5; re-mailing and re-accepting six invitations to move a
    number would test the mail again instead of the number.
    """
    with SessionLocal() as db:
        row = Membership(
            organization_id=org_id(slug),
            user_id=user_id,
            org_role=role,
            status="active",
            display_label=label,
            joined_at=datetime.now(timezone.utc),
            share_results=share,
        )
        db.add(row)
        db.commit()
        return int(row.id)


# ================================================== 1. before anybody has a portal
section("1. A public page can look, and cannot learn")

check(
    "an unauthenticated caller gets no roster",
    client.get(f"/api/organizations/{SCHOOL}/members").status_code in (401, 403),
)
check(
    "and no list of their own memberships either",
    client.get("/api/organizations/mine").status_code in (401, 403),
)
tiers = client.get("/api/organizations/tiers")
check("the tier catalogue is public", tiers.status_code == 200, tiers.status_code)
CATALOGUE = tiers.json()
check("and lists five tiers", len(CATALOGUE) == 5, len(CATALOGUE))
check(
    "none of which can be bought from a form",
    all(row["purchasable"] is False for row in CATALOGUE),
    [row["code"] for row in CATALOGUE if row["purchasable"]],
)
check(
    "and not one of them has a price attached",
    all(row["price_rupees"] is None for row in CATALOGUE),
    [row["code"] for row in CATALOGUE if row["price_rupees"] is not None],
)
school_tiers = client.get("/api/organizations/tiers", params={"kind": "school"}).json()
check(
    "a school is shown the school tiers, with the starter tier first",
    [row["code"] for row in school_tiers] == ["free", "school_starter", "school_district"],
    [row["code"] for row in school_tiers],
)
check(
    "and every tier states the thing it is not",
    all(isinstance(row["not_included"], list) for row in CATALOGUE),
)
check(
    "the cheapest ceiling in the catalogue is smaller than the largest",
    min(row["seats"] for row in CATALOGUE) < max(row["seats"] for row in CATALOGUE),
)

check(
    "a portal read with no address named is refused rather than guessed",
    client.get("/api/organizations/portal").status_code == 400,
)
missing = client.get("/api/organizations/portal", params={"slug": "not-a-school"})
check(
    "an address nobody holds answers 404",
    missing.status_code == 404,
    missing.status_code,
)
check(
    "and does not say whether the name exists but is closed",
    "closed" in missing.json()["detail"],
    missing.text[:200],
)

# ================================================== 2. starting a practice
section("2. An adult can start a practice; a child cannot start anything")

AARAV_TOKEN, AARAV_ID = signup(name="Aarav", device="dev-aarav-0001")
refused = client.post(
    "/api/organizations", json={"name": "Aarav's Club"}, headers=auth(AARAV_TOKEN)
)
check("a student account is refused a portal", refused.status_code == 403, refused.status_code)
check(
    "in a sentence about why, not a database error",
    "registered as a student" in refused.json()["detail"],
    refused.text[:200],
)

PRIYA_TOKEN, PRIYA_ID = signup(role="parent", name="Priya Rivera", device="dev-priya-0001")
made = client.post("/api/organizations", json={"name": "Rivera Guidance"}, headers=auth(PRIYA_TOKEN))
check("a parent account can open a practice", made.status_code == 201, made.text[:200])
practice = made.json()
check("and it is a practice, not a school", practice["kind"] == "counsellor", practice["kind"])
check("whose address comes from its name", practice["slug"] == PRACTICE, practice["slug"])
check("which is not verified, because nobody checked it", practice["verified"] is False)
check("and starts on the tier with no price", practice["tier_code"] == "free", practice["tier_code"])

again = client.post("/api/organizations", json={"name": "Rivera Guidance"}, headers=auth(PRIYA_TOKEN))
check("the same name cannot take the address twice", again.status_code == 409, again.status_code)
reserved = client.post(
    "/api/organizations",
    json={"name": "Help Desk", "slug": "help"},
    headers=auth(PRIYA_TOKEN),
)
check("and a platform label cannot be claimed as one", reserved.status_code == 400, reserved.status_code)
short = client.post("/api/organizations", json={"name": "x"}, headers=auth(PRIYA_TOKEN))
check("a one-character name is refused before a row is written", short.status_code == 422)

mine = client.get("/api/organizations/mine", headers=auth(PRIYA_TOKEN))
check("the owner's own list shows the practice", mine.status_code == 200)
check("as a joined counsellor", mine.json()[0]["org_role"] == "counsellor", mine.json()[0])
check("with the address to open it", mine.json()[0]["slug"] == PRACTICE)
check("and an account with no portal sees an empty list",
      client.get("/api/organizations/mine", headers=auth(AARAV_TOKEN)).json() == [])

summary = client.get(f"/api/organizations/{PRACTICE}", headers=auth(PRIYA_TOKEN)).json()
check("the portal header counts the owner as one joined member", summary["joined"] == 1, summary)
check("with nothing invited yet", summary["invited"] == 0)
check("one of them staff", summary["staff"] == 1)
check("and the starter ceiling on a brand-new practice", summary["seats"] == 25, summary["seats"])
check("one place used, twenty-four left", summary["seats_used"] == 1 and summary["seats_left"] == 24)

outside = client.get(f"/api/organizations/{PRACTICE}", headers=auth(AARAV_TOKEN))
check("a stranger to the practice cannot even read its header", outside.status_code == 403)
check(
    "and is told an invitation opens nothing",
    "invitation opens nothing" in outside.json()["detail"],
    outside.text[:200],
)
self_grant = client.patch(
    f"/api/organizations/{PRACTICE}",
    json={"tier_code": "school_district"},
    headers=auth(PRIYA_TOKEN),
)
check(
    "an owner cannot hand their portal a bigger seat count",
    self_grant.status_code == 422,
    self_grant.status_code,
)

# ================================================== 3. the platform opens a school
section("3. A school is opened by a person who looked at it")

OPS_TOKEN, OPS_ID = signup(role="parent", name="Platform Operator", device="dev-ops-0001")
with SessionLocal() as db:
    # `users.is_admin` is set out of band, by `scripts/admin_grant.py`, and there is no
    # route that sets it. Writing it here is the same act the CLI performs, and the check
    # two lines below is the one that matters: an account without it is refused.
    operator = db.get(User, OPS_ID)
    operator.is_admin = True
    db.commit()

not_operator = client.get("/api/organizations", headers=auth(PRIYA_TOKEN))
check("a practice owner is not the platform's administrator", not_operator.status_code == 403)
check("and cannot open a portal on somebody else's behalf",
      client.post("/api/organizations/admin",
                  json={"name": "Any School", "kind": "school"},
                  headers=auth(PRIYA_TOKEN)).status_code == 403)

opened = client.post(
    "/api/organizations/admin",
    json={"name": "Green Valley Public School", "slug": SCHOOL, "kind": "school"},
    headers=auth(OPS_TOKEN),
)
check("the operator opens a school", opened.status_code == 201, opened.text[:200])
check("with the kind stated rather than inferred", opened.json()["kind"] == "school")
check("and `verified`, because a person is asserting it", opened.json()["verified"] is True)
second = client.post(
    "/api/organizations/admin",
    json={"name": "Nilgiri Academy", "slug": OTHER_SCHOOL, "kind": "school"},
    headers=auth(OPS_TOKEN),
)
check("and can open a second one for the cross-checks later", second.status_code == 201)

listed = client.get("/api/organizations", headers=auth(OPS_TOKEN))
check("the operator's list shows every portal on the platform",
      [row["slug"] for row in listed.json()].count(SCHOOL) == 1, listed.text[:200])
check("both kinds in it",
      {row["kind"] for row in client.get("/api/organizations", headers=auth(OPS_TOKEN)).json()}
      == {"school", "counsellor"})

wrong_tier = client.patch(
    f"/api/organizations/{SCHOOL}/admin",
    json={"tier_code": "counsellor_solo"},
    headers=auth(OPS_TOKEN),
)
check("a school cannot be given a practice's tier", wrong_tier.status_code == 422, wrong_tier.text[:200])
bigger = client.patch(
    f"/api/organizations/{SCHOOL}/admin",
    json={"tier_code": "school_district"},
    headers=auth(OPS_TOKEN),
)
check("its own tiers are open to it", bigger.status_code == 200, bigger.text[:200])
check("and the ceiling moved with the code",
      client.get(f"/api/organizations/{SCHOOL}", headers=auth(OPS_TOKEN)).json()["seats"] == 1000)
closed_by_owner = client.patch(
    f"/api/organizations/{SCHOOL}/admin", json={"is_active": False}, headers=auth(PRIYA_TOKEN)
)
check("a portal's own staff cannot close it, or open a closed one",
      closed_by_owner.status_code == 403, closed_by_owner.status_code)

portal = client.get("/api/organizations/portal", params={"slug": SCHOOL})
check("now the public page can paint it", portal.status_code == 200)
check(
    "with exactly the fields a stranger is allowed to see",
    set(portal.json()) == {"slug", "kind", "name", "verified", "portal_title", "logo_url", "accent_color"},
    sorted(portal.json()),
)
check("and no number about a child anywhere in it",
      not any(key in str(portal.json()).lower() for key in ("joined", "invited", "seats")))

put_branding = client.put(
    f"/api/organizations/{PRACTICE}/branding",
    json={
        "portal_title": "Rivera Guidance career desk",
        "welcome_note": "Bring your last report card and a question you are avoiding.",
        "logo_url": "https://images.example.invalid/rivera.png",
        "accent_color": "#047857",
    },
    headers=auth(PRIYA_TOKEN),
)
check("the practice owner paints their own portal", put_branding.status_code == 200, put_branding.text[:200])
check("the title is now public",
      client.get("/api/organizations/portal", params={"slug": PRACTICE}).json()["portal_title"]
      == "Rivera Guidance career desk")
member_branding = client.get(f"/api/organizations/{PRACTICE}/branding", headers=auth(PRIYA_TOKEN))
check("the welcome note is readable by a member", "report card" in member_branding.json()["welcome_note"])
check("and is not in the public response",
      "welcome_note" not in client.get("/api/organizations/portal", params={"slug": PRACTICE}).json())
bad_colour = client.put(
    f"/api/organizations/{PRACTICE}/branding", json={"accent_color": "#ff00aa"},
    headers=auth(PRIYA_TOKEN),
)
check("a colour outside the palette is refused", bad_colour.status_code == 422, bad_colour.status_code)
bad_logo = client.put(
    f"/api/organizations/{PRACTICE}/branding", json={"logo_url": "http://example.invalid/a.png"},
    headers=auth(PRIYA_TOKEN),
)
check("so is a logo that would load over an unencrypted line", bad_logo.status_code == 422)
creds_logo = client.put(
    f"/api/organizations/{PRACTICE}/branding",
    json={"logo_url": "https://someone:secret@files.example.invalid/a.png"},
    headers=auth(PRIYA_TOKEN),
)
check("so is a link that carries somebody's credentials inside it", creds_logo.status_code == 422)
js_logo = client.put(
    f"/api/organizations/{PRACTICE}/branding",
    json={"logo_url": "javascript:alert(1)"},
    headers=auth(PRIYA_TOKEN),
)
check("or one that is not a link to an image at all", js_logo.status_code == 422)
space_logo = client.put(
    f"/api/organizations/{PRACTICE}/branding",
    json={"logo_url": "https://example.invalid/a b.png"},
    headers=auth(PRIYA_TOKEN),
)
check("or one with a space in it, which is a different request than it looks",
      space_logo.status_code == 422)
student_paint = client.put(
    f"/api/organizations/{SCHOOL}/branding", json={"portal_title": "My School"},
    headers=auth(AARAV_TOKEN),
)
check("a student cannot repaint a school they are not in", student_paint.status_code == 403)

# ================================================== 4. an invitation is a place, not a key
section("4. An invitation holds a place and reveals nothing")

invited = client.post(
    f"/api/organizations/{SCHOOL}/invites",
    json={"email": "Aarav@Example.com", "org_role": "student", "display_label": "Aarav, roll 14"},
    headers=auth(OPS_TOKEN),
)
check("an administrator holds a place for an address", invited.status_code == 200, invited.text[:200])
result = invited.json()
check("the address is stored lowercased, as one address", result["invited"] == ["aarav@example.com"])
check("nothing was already there", result["already_there"] == [] and result["refused"] == [])
check("and the mail actually went to the stub", result["mailed"] is True, result["mail_detail"])

waiting = [row for row in rows_for(SCHOOL) if row.invited_email == "aarav@example.com"]
check("one row, and one only", len(waiting) == 1, len(waiting))
place = waiting[0]
check("it is waiting, not joined", place.status == "invited", place.status)
check("it names no account", place.user_id is None)
check("it carries no plaintext token", place.invite_hash is not None and len(place.invite_hash) == 64)
check("it does not know this person is a child of the school yet", place.share_results is False)
check("and it has a date it stops meaning anything", place.invite_expires_at is not None)

roster = client.get(f"/api/organizations/{SCHOOL}/members", headers=auth(OPS_TOKEN)).json()
listed_row = [row for row in roster if row["display_label"] == "Aarav, roll 14"]
check("the roster lists the waiting place under the label the school typed",
      len(listed_row) == 1, roster)
check("as invited, so nobody mistakes it for a student", listed_row[0]["status"] == "invited")
check("the administrator gets their own address back",
      listed_row[0]["invited_email"] == "aarav@example.com")
check("with a label for the counsellor, not an account id",
      "user_id" not in listed_row[0])

before = client.get(f"/api/organizations/{SCHOOL}/members", headers=auth(AARAV_TOKEN))
check("the child the invitation was addressed to reads nothing from it",
      before.status_code == 403, before.status_code)
check(
    "and the refusal says that an invitation opens nothing",
    "invitation opens nothing" in before.json()["detail"],
    before.text[:200],
)
check("the portal header counts the place as used",
      client.get(f"/api/organizations/{SCHOOL}", headers=auth(OPS_TOKEN)).json()["invited"] == 1)
check("and the joined column still counts only people who accepted",
      client.get(f"/api/organizations/{SCHOOL}", headers=auth(OPS_TOKEN)).json()["joined"] == 1)

mails_before = len(STUB.calls)
duplicate = client.post(
    f"/api/organizations/{SCHOOL}/invites",
    json={"email": "aarav@example.com", "org_role": "student"},
    headers=auth(OPS_TOKEN),
)
check("pressing invite twice holds one place", duplicate.json()["already_there"] == ["aarav@example.com"])
check("and invites nobody", duplicate.json()["invited"] == [])
check("the row count did not move", row_count(SCHOOL) == 2, row_count(SCHOOL))
check("and not one further message left the server for a person already waiting",
      len(STUB.calls) == mails_before, len(STUB.calls) - mails_before)
first_link = STUB.invite_links().get("aarav@example.com")
check("the original link is the one that still works", bool(first_link) and len(first_link) > 20)

junk = client.post(
    f"/api/organizations/{SCHOOL}/invites",
    json={"email": "not-an-address", "org_role": "student"},
    headers=auth(OPS_TOKEN),
)
check("a broken address is refused in `refused` and nowhere else",
      junk.json()["refused"] == ["not-an-address"], junk.text[:200])
check("and no row was written for it",
      not [row for row in rows_for(SCHOOL) if row.invited_email == "not-an-address"])

# ================================================== 5. the accept route is the only door
section("5. Accepting is the only way in, and it is done by the person invited")

bogus = client.post(
    "/api/organizations/join",
    json={"token": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "share_results": True},
    headers=auth(AARAV_TOKEN),
)
check("a token of the right shape and none of the right value is refused",
      bogus.status_code == 400, bogus.status_code)
check("in a sentence that says nothing was joined", "Nothing has been joined" in bogus.json()["detail"])

joined = client.post(
    "/api/organizations/join",
    json={"token": first_link},
    headers=auth(AARAV_TOKEN),
)
check("the real link lets the real account in", joined.status_code == 200, joined.text[:200])
check("into the school the link came from", joined.json()["slug"] == SCHOOL)
check("as the role the school wrote", joined.json()["org_role"] == "student")
check("with sharing off, because the default is off", joined.json()["share_results"] is False)

after = [row for row in rows_for(SCHOOL) if row.user_id == AARAV_ID]
check("one row now carries the account", len(after) == 1, len(after))
check("it is active", after[0].status == "active")
check("and the address is gone from it", after[0].invited_email is None, after[0].invited_email)
check("and so is the token digest, which is why the link cannot be used twice",
      after[0].invite_hash is None)
check("the switch is still the student's own answer, which was nothing",
      after[0].share_results is False)

reuse = client.post("/api/organizations/join", json={"token": first_link}, headers=auth(AARAV_TOKEN))
check("the used link is dead", reuse.status_code == 400, reuse.status_code)

twice = client.post(
    f"/api/organizations/{SCHOOL}/invites",
    json={"email": "aarav.again@example.com", "org_role": "student"},
    headers=auth(OPS_TOKEN),
)
check("a school can invite the same child a second time", twice.status_code == 200)
second_link = STUB.invite_links()["aarav.again@example.com"]
double = client.post("/api/organizations/join", json={"token": second_link}, headers=auth(AARAV_TOKEN))
check("and the child cannot take two places in one school", double.status_code == 409, double.status_code)
check("with no second row written",
      len([row for row in rows_for(SCHOOL) if row.user_id == AARAV_ID]) == 1)

staff_invite = client.post(
    f"/api/organizations/{SCHOOL}/invites",
    json={"email": "meera@example.com", "org_role": "counsellor", "display_label": "Meera (counselling)"},
    headers=auth(OPS_TOKEN),
)
check("the school invites its counsellor", staff_invite.status_code == 200)
staff_link = STUB.invite_links()["meera@example.com"]
child_as_staff = client.post(
    "/api/organizations/join", json={"token": staff_link}, headers=auth(AARAV_TOKEN)
)
check("a student's account cannot take a staff seat", child_as_staff.status_code == 403)
check(
    "and the refusal explains that the invite is still waiting",
    "still waiting" in child_as_staff.json()["detail"],
    child_as_staff.text[:200],
)
check("nothing was written for the attempt",
      [row for row in rows_for(SCHOOL) if row.invited_email == "meera@example.com"][0].status
      == "invited")

MEERA_TOKEN, MEERA_ID = signup(role="parent", name="Meera Nair", device="dev-meera-0001")
as_staff = client.post("/api/organizations/join", json={"token": staff_link}, headers=auth(MEERA_TOKEN))
check("the adult it was written for can take it", as_staff.status_code == 200, as_staff.text[:200])
check("and becomes this school's counsellor", as_staff.json()["org_role"] == "counsellor")
check("a staff seat does not carry a child's sharing switch",
      as_staff.json()["share_results"] is False)

KABIR_TOKEN, KABIR_ID = signup(role="parent", name="Kabir Dutta", device="dev-kabir-0001")
kabir_invite = client.post(
    f"/api/organizations/{SCHOOL}/invites",
    json={"email": "kabir@example.com", "org_role": "counsellor"},
    headers=auth(OPS_TOKEN),
)
check("a second counsellor is invited the same way", kabir_invite.status_code == 200)
kabir_link = STUB.invite_links()["kabir@example.com"]
check("and joins the same way",
      client.post("/api/organizations/join", json={"token": kabir_link}, headers=auth(KABIR_TOKEN))
      .status_code == 200)
check("the school now has three adults and one child accepted",
      client.get(f"/api/organizations/{SCHOOL}", headers=auth(OPS_TOKEN)).json()["joined"] == 4)
check("the counsellor sees the school in their own list",
      {row["slug"] for row in client.get("/api/organizations/mine", headers=auth(MEERA_TOKEN)).json()}
      == {SCHOOL})
check("and the student sees it too",
      {row["slug"] for row in client.get("/api/organizations/mine", headers=auth(AARAV_TOKEN)).json()}
      == {SCHOOL})

# ================================================== 6. the ceiling
section("6. A full ceiling refuses an invitation, never a child")

fifty = client.post(
    f"/api/organizations/{PRACTICE}/invites/bulk",
    json={
        "members": [
            {"email": f"client{index}@example.com", "org_role": "student"} for index in range(50)
        ]
    },
    headers=auth(PRIYA_TOKEN),
)
check("a paste of fifty addresses over a ceiling of twenty-five is refused as a batch",
      fifty.status_code == 422, fifty.status_code)
check("in words that say who is affected",
      "nobody with a student account is affected" in fifty.json()["detail"].replace(
          "nobody with a student account is affected", "nobody with a student account is affected"
      ) or "student account" in fifty.json()["detail"],
      fifty.text[:200])
check("and nothing at all was written", row_count(PRACTICE) == 1, row_count(PRACTICE))

twenty_four = client.post(
    f"/api/organizations/{PRACTICE}/invites/bulk",
    json={
        "members": [
            {"email": f"client{index}@example.com", "org_role": "student"} for index in range(24)
        ]
    },
    headers=auth(PRIYA_TOKEN),
)
check("the same list, sized to the room left, goes through",
      twenty_four.status_code == 200, twenty_four.text[:200])
check("twenty-four places held", len(twenty_four.json()["invited"]) == 24)
check("and the count says so", twenty_four.json()["seats_left"] == 0)
check("a duplicate inside one paste holds one place",
      client.post(
          f"/api/organizations/{OTHER_SCHOOL}/invites/bulk",
          json={"members": [
              {"email": "same@example.com", "org_role": "student"},
              {"email": "SAME@example.com ", "org_role": "student"},
          ]},
          headers=auth(OPS_TOKEN),
      ).json()["invited"] == ["same@example.com"])
over = client.post(
    f"/api/organizations/{PRACTICE}/invites/bulk",
    json={"members": [{"email": "one.more@example.com", "org_role": "student"}]},
    headers=auth(PRIYA_TOKEN),
)
check("one address past the ceiling is refused", over.status_code == 422, over.status_code)
check("the owner's own place is untouched by it",
      client.get(f"/api/organizations/{PRACTICE}", headers=auth(PRIYA_TOKEN)).json()["joined"] == 1)
check("and the waiting list is exactly the ceiling",
      sum(1 for row in rows_for(PRACTICE) if row.status == "invited") == 24)
check("a practice owner reads their own client list back",
      [row for row in client.get(f"/api/organizations/{PRACTICE}/members", headers=auth(PRIYA_TOKEN)).json()
       if row["invited_email"]])
check("which is the address they typed, not an account",
      all("user_id" not in row for row in
          client.get(f"/api/organizations/{PRACTICE}/members", headers=auth(PRIYA_TOKEN)).json()))

# ================================================== 7. whose switch it is
section("7. The sharing switch belongs to the account that set it")

off = client.get(f"/api/organizations/{SCHOOL}/members", headers=auth(OPS_TOKEN)).json()
aarav_row = [row for row in off if row["id"] == membership_id(SCHOOL, user_id=AARAV_ID)][0]
check("the school can read that the child has not shared", aarav_row["share_results"] is False)
meera_row = [row for row in off if row["id"] == membership_id(SCHOOL, user_id=MEERA_ID)][0]
check("and that the counsellor it invited is not a child", meera_row["org_role"] == "counsellor")
check("the counsellor is not sent the class's addresses",
      all(row["invited_email"] is None for row in
          client.get(f"/api/organizations/{SCHOOL}/members", headers=auth(MEERA_TOKEN)).json()),
      "a hired counsellor leaves with the list otherwise")

on = client.patch(
    f"/api/organizations/{SCHOOL}/me", json={"share_results": True}, headers=auth(AARAV_TOKEN)
)
check("the child turns sharing on themselves", on.status_code == 200, on.text[:200])
check("and the answer says so", on.json()["share_results"] is True)
check("the row moved",
      [row for row in rows_for(SCHOOL) if row.user_id == AARAV_ID][0].share_results is True)
check("now the roster reflects it, as the school's own reading of the switch",
      [row for row in client.get(f"/api/organizations/{SCHOOL}/members", headers=auth(OPS_TOKEN)).json()
       if row["id"] == aarav_row["id"]][0]["share_results"] is True)

no_patch = client.patch(f"/api/organizations/{SCHOOL}/members/{aarav_row['id']}",
                        json={"share_results": False}, headers=auth(OPS_TOKEN))
check("there is no route by which the school sets it for the child",
      no_patch.status_code == 405, no_patch.status_code)
no_put = client.put(f"/api/organizations/{SCHOOL}/members/{aarav_row['id']}/share",
                    json={"share_results": True}, headers=auth(OPS_TOKEN))
check("and no hidden one either", no_put.status_code in (404, 405), no_put.status_code)
no_grant_in_invite = client.post(
    f"/api/organizations/{SCHOOL}/invites",
    json={"email": "x@example.com", "org_role": "student", "share_results": True},
    headers=auth(OPS_TOKEN),
)
check("an invitation cannot pre-answer the question",
      no_grant_in_invite.status_code == 422, no_grant_in_invite.status_code)
counsellor_switch = client.patch(
    f"/api/organizations/{SCHOOL}/me", json={"share_results": True}, headers=auth(MEERA_TOKEN)
)
check("a counsellor's own switch moves their own row only",
      counsellor_switch.status_code == 200
      and [row for row in rows_for(SCHOOL) if row.user_id == MEERA_ID][0].share_results is True)
check("and the child's is unchanged by it",
      [row for row in rows_for(SCHOOL) if row.user_id == AARAV_ID][0].share_results is True)
back_off = client.patch(
    f"/api/organizations/{SCHOOL}/me", json={"share_results": False}, headers=auth(AARAV_TOKEN)
)
check("changing their mind costs one call", back_off.json()["share_results"] is False)

# ================================================== 8. caseloads and notes
section("8. A counsellor sees their caseload, and a note is theirs until they share it")

students = client.get(f"/api/organizations/{SCHOOL}/clients", headers=auth(OPS_TOKEN)).json()
check("the administrator sees the school's one joined student", len(students) == 1, students)
aarav_client = students[0]["id"]
assigned = client.post(
    f"/api/organizations/{SCHOOL}/members/{aarav_client}/counsellor",
    json={"counsellor_membership_id": meera_row["id"]},
    headers=auth(OPS_TOKEN),
)
check("the school assigns the child to a counsellor", assigned.status_code == 200, assigned.text[:200])
check("and the roster names that counsellor by the school's own label",
      assigned.json()["assigned_counsellor_label"] == "Meera (counselling)", assigned.json())
foreign = client.post(
    f"/api/organizations/{SCHOOL}/members/{aarav_client}/counsellor",
    json={"counsellor_membership_id": membership_id(PRACTICE, user_id=PRIYA_ID)},
    headers=auth(OPS_TOKEN),
)
check("a counsellor from another organisation cannot be pointed at this school's child",
      foreign.status_code == 422, foreign.text[:200])
nobody = client.post(
    f"/api/organizations/{SCHOOL}/members/{meera_row['id']}/counsellor",
    json={"counsellor_membership_id": None},
    headers=auth(OPS_TOKEN),
)
check("a counsellor is assigned to a child, not to a colleague", nobody.status_code == 422)
unassigned = client.post(
    f"/api/organizations/{SCHOOL}/members/{aarav_client}/counsellor",
    json={"counsellor_membership_id": None},
    headers=auth(OPS_TOKEN),
)
check("and the assignment can be taken back", unassigned.json()["assigned_counsellor_label"] is None)
client.post(
    f"/api/organizations/{SCHOOL}/members/{aarav_client}/counsellor",
    json={"counsellor_membership_id": meera_row["id"]},
    headers=auth(OPS_TOKEN),
)

check("the assigned counsellor sees the child",
      [row["id"] for row in
       client.get(f"/api/organizations/{SCHOOL}/clients", headers=auth(MEERA_TOKEN)).json()]
      == [aarav_client])
check("the unassigned one sees nobody",
      client.get(f"/api/organizations/{SCHOOL}/clients", headers=auth(KABIR_TOKEN)).json() == [])
check("and still gets their own place on the roster",
      len([row for row in
           client.get(f"/api/organizations/{SCHOOL}/members", headers=auth(KABIR_TOKEN)).json()
           if row["id"] == membership_id(SCHOOL, user_id=KABIR_ID)]) == 1)

note_foreign = client.post(
    f"/api/organizations/{SCHOOL}/notes",
    json={"client_membership_id": membership_id(SCHOOL, user_id=KABIR_ID), "body": "Talked about engineering."},
    headers=auth(MEERA_TOKEN),
)
check("a note cannot be written about somebody else's client",
      note_foreign.status_code == 403, note_foreign.status_code)
waiting_row = membership_id(SCHOOL, address="aarav.again@example.com")
note_to_waiting = client.post(
    f"/api/organizations/{SCHOOL}/notes",
    json={"client_membership_id": waiting_row, "body": "Written about a child who has not agreed."},
    headers=auth(MEERA_TOKEN),
)
check("and none can be attached to a place nobody has accepted",
      note_to_waiting.status_code == 403, note_to_waiting.status_code)

made_note = client.post(
    f"/api/organizations/{SCHOOL}/notes",
    json={"client_membership_id": aarav_client, "body": "Sat with A. for twenty minutes; wants to look at design."},
    headers=auth(MEERA_TOKEN),
)
check("the assigned counsellor writes one about their own client",
      made_note.status_code == 201, made_note.text[:200])
with SessionLocal() as db:
    check("and the refused attempt left no row: the table cannot hold a note about a "
          "child who has not agreed",
          db.scalar(select(func.count(SessionNote.id)).where(
              SessionNote.client_membership_id == waiting_row)) == 0)
check("it starts private", made_note.json()["shared_with_family"] is False)
check("and unshared, so it has no shared date", made_note.json()["shared_at"] is None)
too_short = client.post(
    f"/api/organizations/{SCHOOL}/notes",
    json={"client_membership_id": aarav_client, "body": "ok"},
    headers=auth(MEERA_TOKEN),
)
check("a two-character note is not a record of a session", too_short.status_code == 422)
too_long = client.post(
    f"/api/organizations/{SCHOOL}/notes",
    json={"client_membership_id": aarav_client, "body": "x" * 2001},
    headers=auth(MEERA_TOKEN),
)
check("and neither is a page of pasted transcript", too_long.status_code == 422)

family_before = client.get(f"/api/organizations/{SCHOOL}/my-notes", headers=auth(AARAV_TOKEN))
check("the child cannot read the private draft", family_before.json() == [], family_before.text[:200])
not_mine = client.get(f"/api/organizations/{SCHOOL}/notes", headers=auth(KABIR_TOKEN))
check("a colleague counsellor cannot read it either", not_mine.json() == [])
admin_reading = client.get(f"/api/organizations/{SCHOOL}/notes", headers=auth(OPS_TOKEN))
check("nor can the school's administrator", admin_reading.json() == [])

note_id = made_note.json()["id"]
shared = client.patch(
    f"/api/organizations/{SCHOOL}/notes/{note_id}/share",
    json={"shared_with_family": True},
    headers=auth(MEERA_TOKEN),
)
check("the author shows it to the family when they choose to", shared.status_code == 200)
check("with a date on it", shared.json()["shared_at"] is not None)
family_after = client.get(f"/api/organizations/{SCHOOL}/my-notes", headers=auth(AARAV_TOKEN))
check("the child now reads their own note", len(family_after.json()) == 1, family_after.text[:200])
check("and it is the one that was shared", family_after.json()[0]["id"] == note_id)
check("the author's label is not an account id",
      "author_label" in family_after.json()[0])
kollega = client.patch(
    f"/api/organizations/{SCHOOL}/notes/{note_id}/share",
    json={"shared_with_family": False},
    headers=auth(KABIR_TOKEN),
)
check("another counsellor cannot unshare it behind them", kollega.status_code == 404, kollega.status_code)
unsent = client.patch(
    f"/api/organizations/{SCHOOL}/notes/{note_id}/share",
    json={"shared_with_family": False},
    headers=auth(MEERA_TOKEN),
)
check("and the author can take it back with one call",
      unsent.json()["shared_with_family"] is False)
check("the family sees it gone",
      client.get(f"/api/organizations/{SCHOOL}/my-notes", headers=auth(AARAV_TOKEN)).json() == [])
check("another counsellor cannot delete it",
      client.delete(f"/api/organizations/{SCHOOL}/notes/{note_id}", headers=auth(KABIR_TOKEN))
      .status_code == 404)
check("the author can", client.delete(
    f"/api/organizations/{SCHOOL}/notes/{note_id}", headers=auth(MEERA_TOKEN)).status_code == 200)
with SessionLocal() as db:
    check("and it is gone from the database, not hidden",
          db.scalar(select(func.count(SessionNote.id)).where(SessionNote.id == note_id)) == 0)

kept = client.post(
    f"/api/organizations/{SCHOOL}/notes",
    json={"client_membership_id": aarav_client,
          "body": "Second sitting: asked for the list of design colleges."},
    headers=auth(MEERA_TOKEN),
)
check("a second note is written, and left standing for the leaving test below",
      kept.status_code == 201, kept.text[:200])

# ================================================== 9. the five-person floor
section("9. Five is a cohort; four is a group somebody could walk down and name")

small = client.get(f"/api/organizations/{SCHOOL}/analytics", headers=auth(OPS_TOKEN))
check("an administrator can ask for analytics", small.status_code == 200, small.text[:200])
cohort = small.json()
check("the headline counts are given", cohort["cohort_size"] >= 1, cohort)
check("the caseload floor withholds a stage breakdown of one",
      cohort["by_stage"] == [], [row["label"] for row in cohort["by_stage"]])
check("and says which breakdowns it dropped, rather than dropping them quietly",
      any("below the floor" in line for line in cohort["hidden"]), cohort["hidden"])
check("and states the floor it used", cohort["min_reportable"] == 5, cohort["min_reportable"])

FIVE = []
for index in range(5):
    token, user_id = signup(
        name=f"Classmate {index}",
        # Four of the five are set to English so that, counting Aarav, the English bucket
        # lands exactly on the floor and the Hindi bucket is one. That is the pair this
        # route exists to draw: a line that appears, and a line that is dropped and named.
        language="hi" if index == 0 else "en",
        # All five in one class, for the same reason: the stage bucket has to reach five,
        # and Aarav alone in Class 12 has to be the one that does not.
        class_level="class-11",
        device=f"dev-class-{index}-0001",
    )
    FIVE.append((token, user_id))
    # The last of the five shares, and has not sat a questionnaire — so `shared_results`
    # and `sittings_completed` are counts of different children and cannot match by luck.
    join_by_hand(SCHOOL, user_id, "student", f"Roll {20 + index}", share=(index == 4))

with SessionLocal() as db:
    for _token, user_id in FIVE[:2]:
        db.add(Assessment(user_id=user_id, assessment_type="interest", language="hi",
                          status="completed", completed_at=datetime.now(timezone.utc)))
    db.add(Assessment(user_id=FIVE[2][1], assessment_type="interest", language="en",
                      status="in_progress"))
    db.commit()

big = client.get(f"/api/organizations/{SCHOOL}/analytics", headers=auth(OPS_TOKEN)).json()
check("six students is a cohort", big["cohort_size"] == 6, big["cohort_size"])
check("a class of exactly five is shown, at the line and not under it",
      {row["label"]: row["count"] for row in big["by_stage"]} == {"Class 11": 5}, big["by_stage"])
check("and the one child sitting alone in Class 12 is not shown",
      all(row["label"] != "Class 12" for row in big["by_stage"]), big["by_stage"])
check("with the drop named, so a head teacher is not left counting a missing class",
      any("Class 12" in line and "below the floor" in line for line in big["hidden"]),
      big["hidden"])
check("the language that reaches five is reported",
      {row["label"]: row["count"] for row in big["by_language"]} == {"English": 5},
      big["by_language"])
check("the language spoken by one is reported as withheld, not as absent",
      any("Hindi" in line and "below the floor" in line for line in big["hidden"]), big["hidden"])
check("and no bucket anywhere in the response is under the floor",
      all(row["count"] >= 5 for row in big["by_stage"] + big["by_language"]),
      big["by_stage"] + big["by_language"])
check("the sittings counted are counted honestly",
      big["sittings_started"] == 3 and big["sittings_completed"] == 2, big)
check("and the number who share is its own count, not a restatement of who finished",
      big["shared_results"] == 1 and big["sittings_completed"] == 2, big)

caseload = client.get(f"/api/organizations/{SCHOOL}/analytics", headers=auth(MEERA_TOKEN)).json()
check("the counsellor with one assigned child is not given the school's chart",
      caseload["cohort_size"] == 1, caseload["cohort_size"])
check("and their number is smaller than the administrator's",
      caseload["cohort_size"] < big["cohort_size"])
check("with the same floor applied to it", caseload["by_stage"] == [], caseload["by_stage"])
check("a student may not ask for analytics at all",
      client.get(f"/api/organizations/{SCHOOL}/analytics", headers=auth(AARAV_TOKEN)).status_code == 403)

# ================================================== 10. a hostname chooses the paint
section("10. A subdomain decides what a page looks like, never who may read it")

on_host = client.get(
    f"/api/organizations/{SCHOOL}/members",
    headers={**auth(OPS_TOKEN), "Host": f"{SCHOOL}.careerguide.localhost"},
)
check("an administrator on their own subdomain gets their roster", on_host.status_code == 200)
crossed = client.get(
    f"/api/organizations/{SCHOOL}/members",
    headers={**auth(OPS_TOKEN), "Host": f"{OTHER_SCHOOL}.careerguide.localhost"},
)
check("the same administrator asking one school's data on another's address is refused",
      crossed.status_code == 404, crossed.status_code)
check("with a sentence about two portals disagreeing",
      "different portal" in crossed.json()["detail"], crossed.text[:200])
check("the public portal read is cross-checked the same way",
      client.get("/api/organizations/portal", params={"slug": SCHOOL},
                 headers={"Host": f"{OTHER_SCHOOL}.careerguide.localhost"}).status_code == 404)
check("and passes when the two agree",
      client.get("/api/organizations/portal", params={"slug": SCHOOL},
                 headers={"Host": f"{SCHOOL}.careerguide.localhost"}).status_code == 200)
forwarded = client.get(
    f"/api/organizations/{SCHOOL}/members",
    headers={**auth(OPS_TOKEN), "X-Forwarded-Host": f"{OTHER_SCHOOL}.careerguide.localhost"},
)
check("a header anybody can write does not move the guard when it is not configured to",
      forwarded.status_code == 200, forwarded.status_code)
check("a Host outside the platform's own domain names no portal",
      client.get(f"/api/organizations/{SCHOOL}/members",
                 headers={**auth(OPS_TOKEN), "Host": "evil.example.com"}).status_code == 200)
check("two labels deep is not a portal either",
      client.get(f"/api/organizations/{SCHOOL}/members",
                 headers={**auth(OPS_TOKEN),
                          "Host": f"x.{SCHOOL}.careerguide.localhost"}).status_code == 200)
check("and `api.careerguide.localhost` cannot be registered as a school",
      client.post("/api/organizations", json={"name": "Api School", "slug": "api"},
                  headers=auth(PRIYA_TOKEN)).status_code == 400)

# ================================================== 11. leaving, and being closed
section("11. Leaving a portal takes nothing with it and closes nothing else")

RAKHI_TOKEN, RAKHI_ID = signup(name="Rakhi", device="dev-rakhi-0001")
rakhi_invite = client.post(
    f"/api/organizations/{SCHOOL}/invites",
    json={"email": "rakhi@example.com", "org_role": "student"},
    headers=auth(OPS_TOKEN),
)
check("a student is invited", rakhi_invite.status_code == 200)
rakhi_link = STUB.invite_links()["rakhi@example.com"]
check("they join", client.post("/api/organizations/join",
                               json={"token": rakhi_link}, headers=auth(RAKHI_TOKEN)).status_code == 200)
left = client.delete(f"/api/organizations/{SCHOOL}/me", headers=auth(RAKHI_TOKEN))
check("they leave", left.status_code == 200, left.text[:200])
check("the row says revoked", left.json()["status"] == "revoked")
rakhi_row = [row for row in rows_for(SCHOOL) if row.user_id == RAKHI_ID][0]
check("their sharing switch went with the membership that gave it meaning",
      rakhi_row.share_results is False)
check("their account is untouched",
      client.get("/api/auth/me", headers=auth(RAKHI_TOKEN)).status_code == 200)
check("and they no longer see the portal in their list",
      SCHOOL not in {row["slug"] for row in
                     client.get("/api/organizations/mine", headers=auth(RAKHI_TOKEN)).json()})
check("they cannot read its roster any more",
      client.get(f"/api/organizations/{SCHOOL}/members", headers=auth(RAKHI_TOKEN)).status_code == 403)
self_remove = client.delete(
    f"/api/organizations/{SCHOOL}/members/{membership_id(SCHOOL, user_id=OPS_ID)}",
    headers=auth(OPS_TOKEN),
)
check("an administrator cannot remove their own place with the roster button",
      self_remove.status_code == 422, self_remove.text[:200])
check("which leaves them standing in the portal they were using",
      client.get(f"/api/organizations/{SCHOOL}/members", headers=auth(OPS_TOKEN)).status_code == 200)
waiting_rows = [row for row in rows_for(SCHOOL) if row.status == "invited"]
check("the place nobody accepted is untouched by somebody else leaving",
      len(waiting_rows) == 1, len(waiting_rows))
check("still holding its address and its link, because a resignation is one person's act",
      waiting_rows[0].invited_email == "aarav.again@example.com"
      and waiting_rows[0].invite_hash is not None)
removed = client.delete(
    f"/api/organizations/{SCHOOL}/members/{membership_id(SCHOOL, user_id=MEERA_ID)}",
    headers=auth(OPS_TOKEN),
)
check("a staff member can be taken off the roster", removed.status_code == 200, removed.text[:200])
check("the row is closed rather than deleted, so the roster can still say when",
      removed.json()["status"] == "revoked", removed.json())
check("which closes their portal, not their account",
      client.get(f"/api/organizations/{SCHOOL}/members", headers=auth(MEERA_TOKEN)).status_code == 403)
check("and their own account is untouched by it",
      client.get("/api/auth/me", headers=auth(MEERA_TOKEN)).status_code == 200)
with SessionLocal() as db:
    check("the note they wrote about a child is still in the table, because removal is "
          "not deletion",
          db.scalar(select(func.count(SessionNote.id)).where(
              SessionNote.author_user_id == MEERA_ID)) == 1)
    check("and it is unreachable, because access ran through the membership and that row "
          "is now revoked",
          db.get(Membership, membership_id(SCHOOL, user_id=MEERA_ID)).status == "revoked")

shutdown = client.patch(
    f"/api/organizations/{SCHOOL}/admin", json={"is_active": False}, headers=auth(OPS_TOKEN)
)
check("the platform closes a portal", shutdown.status_code == 200, shutdown.text[:200])
check("its public page goes with it",
      client.get("/api/organizations/portal", params={"slug": SCHOOL}).status_code == 404)
check("its roster answers the same way as one that never existed",
      client.get(f"/api/organizations/{SCHOOL}/members", headers=auth(OPS_TOKEN)).status_code == 404)
check("and the children's own accounts carry on",
      client.get("/api/auth/me", headers=auth(AARAV_TOKEN)).status_code == 200)
check("their memberships are not deleted by it, because a closed school is not an erased term",
      len([row for row in rows_for(SCHOOL) if row.status == "active"]) >= 2)
client.patch(f"/api/organizations/{SCHOOL}/admin", json={"is_active": True}, headers=auth(OPS_TOKEN))

# ================================================== 12. the throttle
section("12. The invite route is throttled, and says so in a sentence a teacher can read")

blocked = None
for index in range(30):
    answer = client.post(
        f"/api/organizations/{OTHER_SCHOOL}/invites",
        json={"email": f"flood{index}@example.com", "org_role": "student"},
        headers=auth(OPS_TOKEN),
    )
    if answer.status_code == 429:
        blocked = answer
        break
check("a stream of invitations is eventually refused", blocked is not None, "no 429 in thirty calls")
if blocked is not None:
    check("with a body a browser can read", blocked.json().get("detail") is not None, blocked.text[:200])
    check("that says what happened", "invitations" in str(blocked.json()), blocked.text[:200])
    check("and says the people already invited were not mailed again",
          "invited twice" in str(blocked.json()), blocked.text[:200])

# ================================================== 13. the shape of what leaves
section("13. Nothing a portal answers with is about a child's work")

FORBIDDEN = ("answer", "transcript", "score", "response", "report", "conversation", "message")
SAMPLES = [
    client.get(f"/api/organizations/{PRACTICE}", headers=auth(PRIYA_TOKEN)),
    client.get(f"/api/organizations/{PRACTICE}/members", headers=auth(PRIYA_TOKEN)),
    client.get(f"/api/organizations/{SCHOOL}/members", headers=auth(OPS_TOKEN)),
    client.get(f"/api/organizations/{SCHOOL}/analytics", headers=auth(OPS_TOKEN)),
    client.get(f"/api/organizations/{OTHER_SCHOOL}/analytics", headers=auth(OPS_TOKEN)),
    client.get(f"/api/organizations/{OTHER_SCHOOL}", headers=auth(OPS_TOKEN)),
    client.get("/api/organizations/mine", headers=auth(OPS_TOKEN)),
    client.get("/api/organizations/summary", headers=auth(OPS_TOKEN)),
    client.get("/api/organizations/tiers"),
    client.get("/api/organizations/portal", params={"slug": OTHER_SCHOOL}),
]
check("every sampled portal response decoded",
      all(response.status_code == 200 for response in SAMPLES),
      [response.status_code for response in SAMPLES])
def keys_of(node):
    """Every field name in a decoded response, however deep the row sits in it."""
    if isinstance(node, dict):
        for key, value in node.items():
            yield key
            yield from keys_of(value)
    elif isinstance(node, list):
        for item in node:
            yield from keys_of(item)


# Whole words only, split the way the fields are spelled: `min_reportable` is a floor, an
# `answer` or a `report_url` is a child's work, and a substring test cannot tell the two
# apart — a suite that cries wolf at a legal field name stops being read.
leaking = sorted({
    key
    for response in SAMPLES
    for key in keys_of(response.json())
    if any(token in FORBIDDEN for token in key.lower().split("_"))
})
check("no response field, at any depth, names a child's work", not leaking, leaking)
body = str([response.json() for response in SAMPLES]).lower()
check("and the roster rows carry no id a request could use to point at a child",
      "user_id" not in body, body[:200])
with SessionLocal() as db:
    columns = {column.name for column in Membership.__table__.columns}
    check("the membership table itself has nowhere to put one",
          not any(any(word in name.lower() for word in FORBIDDEN) for name in columns), sorted(columns))
    check("and no token column, only its digest",
          not any("token" in name.lower() for name in columns), sorted(columns))

LIFESPAN.close()

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + "; ".join(FAIL))
    sys.exit(1)
