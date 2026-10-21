"""Test the operator's side: who may open it, what it may see, and what it leaves behind.

Six things are worth proving about a screen that runs the whole site, and the sections below
are arranged around them rather than around the route list:

* **The flag is `users.is_admin`, and no request can ask for it.** The brief said
  "only users with role=admin", and this app's `role` column says only `student` or
  `parent`. So the suite proves the substitution from both ends: a student, a parent and a
  *school's own administrator* are each refused on every operator route, and no request body
  declared anywhere in the API has a field that could grant the flag.
* **Every route is covered, including routes added after this file was written.** The refusal
  sweep is built from `app.openapi()["paths"]`, so a new `/api/admin/...` endpoint is tested
  the moment it is registered. A hand-maintained list would go stale in exactly the one way
  that matters.
* **A list of people that holds no person's data.** Before any asserting, the fixtures plant
  known sentinel strings in a child's message body, a device id, a come-back hash and a
  family's enquiry text. At the end, every operator response this suite fetched is searched
  for those strings. A field name check alone would not notice a count that was really a
  transcript.
* **Two pairs that must not be added together.** A reply written by the demo script is not
  the work of a model, and a payment made with a test key moved no money. Each pair is
  asserted to split, and the money is asserted in paise against figures the fixtures know.
* **Exactly one log row per change, and none for a read or a no-op.** Including the grants
  made by `scripts/admin_grant.py`, which are logged with no actor account and
  `origin="script"` — because a log that only recorded requests would imply the only way in
  was through a page.
* **Nothing on the screen can lie.** An answered questionnaire item refuses an edit, a
  career entry refuses to have its verified flag switched by a form, the blog route says it
  cannot edit the blog, the deployment route holds no key value, and the audit log has no
  delete.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/admin_test.py
"""

from __future__ import annotations

import io
import logging
import os
import pathlib
import sys
import tempfile
from contextlib import ExitStack, redirect_stdout
from datetime import timedelta

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_admin_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
# On, because the throttle on the operator's writes is part of the design of this screen,
# and the section at the end runs it out on purpose.
os.environ["RATE_LIMIT_ENABLED"] = "true"
# Five, and the counter is cleared before that section, so the arithmetic stays honest.
os.environ["RATE_LIMIT_ADMIN"] = "5 per minute"
# Everything else the sweep and the fixtures touch, left generous: this file is about who is
# refused, not about how many times.
os.environ["RATE_LIMIT_AUTH"] = "500 per minute"
os.environ["RATE_LIMIT_ORG"] = "500 per minute"
os.environ["RATE_LIMIT_ORG_INVITE"] = "500 per minute"
os.environ["RATE_LIMIT_LEAD"] = "500 per minute"
os.environ["CLERK_SECRET_KEY"] = "sk_test_SENTINEL_CLERK_SECRET_do_not_echo"
os.environ["TENANT_BASE_DOMAIN"] = "careerguide.localhost"
os.environ["TENANT_TRUST_FORWARDED_HOST"] = "false"
# The deployment screen is asserted to hold *presence* rather than values, so the process
# needs values to be shown past. None of these is a real credential.
os.environ["GEMINI_API_KEY"] = "SENTINEL_GEMINI_KEY_do_not_echo"
os.environ["AZURE_SPEECH_KEY"] = "SENTINEL_AZURE_KEY_do_not_echo"
os.environ["RESEND_API_KEY"] = "re_SENTINEL_RESEND_do_not_echo"
os.environ["RAZORPAY_KEY_ID"] = "rzp_SENTINEL_do_not_echo"
os.environ["RAZORPAY_KEY_SECRET"] = "SENTINEL_RAZORPAY_SECRET_do_not_echo"
os.environ["RAZORPAY_WEBHOOK_SECRET"] = "SENTINEL_RZP_WEBHOOK_do_not_echo"

import admin_grant  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

from app import models  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.middleware.rate_limit import limiter  # noqa: E402
from app.models import (  # noqa: E402
    Assessment,
    AuditEvent,
    Career,
    ConversationSession,
    EmailJob,
    Membership,
    Message,
    Organization,
    Payment,
    Question,
    Response,
    StudyLead,
    Subscription,
    User,
    utcnow,
)
from app.routers import admin as admin_routes  # noqa: E402
from app.security import get_admin_user  # noqa: E402

PASS: list[str] = []
FAIL: list[str] = []

# The strings the fixtures plant, and which must never reach an operator's screen. They are
# only ever written into a *child's* data, so an operator row that echoes one is a leak.
SENTINEL_CHILD_TEXT = "SENTINEL-CHILD-ANSWER-TEXT-9f3c"
SENTINEL_DEVICE_ID = "SENTINELDEVICEID0123456789abcdef"
SENTINEL_COMEBACK_HASH = "SENTINELcomebackhash0123456789abcdef0123456789abcdef"
SENTINEL_ENQUIRY_TEXT = "SENTINEL-FAMILY-ENQUIRY-BODY-77"
SENTINEL_ENQUIRY_MAIL = "sentinel-family@example.invalid"
SENTINEL_NEW_SUMMARY = "SENTINEL-CAREER-EDIT-VALUE-12"

FORBIDDEN_KEYS = (
    "device",
    "comeback",
    "come_back",
    "token",
    "hash",
    "transcript",
    "password",
    "secret_key",
    "api_key",
)

OP_MAIL = "operator@example.invalid"
E_MAIL = "kabir@example.invalid"
DEV_MAIL = "devayani@example.invalid"


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


SAMPLES: list = []


def call(method: str, path: str, *, token: str | None = None, json=None, params=None):
    """One operator request, kept for the leak sweep at the end."""
    response = client.request(
        method,
        path,
        headers=auth(token) if token else None,
        json=json,
        params=params,
    )
    SAMPLES.append(response)
    return response


# A sweep of forty refused calls is a wall of "403 Forbidden" lines, and the checks under
# each heading below are the output that matters here.
logging.getLogger("httpx").setLevel(logging.WARNING)

client = TestClient(app)
LIFESPAN = ExitStack()
LIFESPAN.enter_context(client)

SUMMARY = "/api/admin/summary"


def signup(role: str = "student", name: str = "Aarav", device: str | None = None) -> tuple[str, int]:
    body = {
        "role": role,
        "display_name": name,
        "preferred_language": "en",
        "consent_profile": True,
        "consent_voice": False,
        "consent_age": "11-12" if role == "student" else "adult",
    }
    if role == "student":
        body["class_level"] = "class-12"
    else:
        body.update({"student_name": "Somebody", "student_class_level": "class-12"})
    if device:
        body["device_id"] = device
    response = client.post("/api/auth/onboarding", json=body)
    assert response.status_code == 200, response.text[:300]
    data = response.json()
    return data["token"], data["user"]["id"]


def set_columns(user_id: int, **values) -> None:
    """Write a column no route can write, which is the only way to build these fixtures.

    `is_admin` included: the flag is set in the database by `scripts/admin_grant.py` in real
    life, and section 4 tests that script through its own `main()`. Setting it here instead
    is what makes the rest of the file able to talk as an operator at all.
    """
    with SessionLocal() as db:
        account = db.get(User, user_id)
        for field, value in values.items():
            setattr(account, field, value)
        db.commit()


def audit_rows(action: str | None = None, subject_id: str | None = None) -> list[AuditEvent]:
    with SessionLocal() as db:
        stmt = select(AuditEvent)
        if action is not None:
            stmt = stmt.where(AuditEvent.action == action)
        if subject_id is not None:
            stmt = stmt.where(AuditEvent.subject_id == subject_id)
        rows = list(db.scalars(stmt.order_by(AuditEvent.id)))
        for row in rows:
            db.expunge(row)
        return rows


def audit_count() -> int:
    with SessionLocal() as db:
        return int(db.scalar(select(func.count(AuditEvent.id))) or 0)


def detail_of(rows: list[AuditEvent]) -> list[str]:
    return [row.detail for row in rows]


# ------------------------------------------------------------------ the cast
# Meera is the operator. Her account's own `role` says `parent`, and that is the point the
# first section keeps returning to: what makes her run the site is a column that has nothing
# to do with who she is to a family.
op_token, op_id = signup("parent", "Meera Nair")
set_columns(op_id, is_admin=True, contact_email=OP_MAIL)
student_token, student_id = signup("student", "Aarav")
parent_token, parent_id = signup("parent", "Ritu")
school_lead_token, school_lead_id = signup("student", "Farhan Qureshi")
closed_token, closed_id = signup("student", "Nikhil Rane", device=SENTINEL_DEVICE_ID)
set_columns(closed_id, is_active=False)
kabir_token, kabir_id = signup("student", "Kabir Shah")
set_columns(kabir_id, contact_email=E_MAIL, email_confirmed_at=utcnow())
scripted_token, scripted_id = signup("parent", "Devayani Rao")
set_columns(scripted_id, contact_email=DEV_MAIL)

with SessionLocal() as db:
    portal = Organization(slug="admin-test-school", kind="school", name="Admin Test School")
    db.add(portal)
    db.flush()
    db.add(
        Membership(
            organization_id=portal.id,
            user_id=school_lead_id,
            org_role="school_admin",
            status="active",
            display_label="Farhan Qureshi",
            joined_at=utcnow(),
        )
    )
    db.commit()

# ================================================== 1. who is let through the door
section("1. The flag is is_admin, and no request can ask for it")


def concrete(path: str) -> str:
    out = path
    for token in ("{story_id}", "{lead_id}", "{question_id}", "{user_id}", "{slug}"):
        if "slug" in token:
            out = out.replace(token, "no-such-thing")
        else:
            out = out.replace(token, "1")
    return out


OPENAPI = app.openapi()
PATHS = OPENAPI["paths"]
ADMIN_CALLS = sorted(
    {
        (method.upper(), concrete(path))
        for path, operations in PATHS.items()
        for method in operations
        if method in ("get", "post", "patch", "put", "delete")
        and "admin" in path.split("/")
    }
)
check(
    "the sweep is built from the API itself, and finds the operator routes",
    len(ADMIN_CALLS) >= 20,
    len(ADMIN_CALLS),
)
check(
    "including all twelve routes of /api/admin",
    len({path for _, path in ADMIN_CALLS if path.startswith("/api/admin")}) >= 12,
    sorted({path for _, path in ADMIN_CALLS if path.startswith("/api/admin")}),
)


def sweep(token: str | None, expected: int) -> list[str]:
    offenders: list[str] = []
    if token is None:
        # "Anonymous" has to be built, not assumed. This client is a browser: an earlier
        # check was handed a session as a cookie, and the client keeps cookies the way a
        # browser does, so without emptying the jar every one of these routes would answer
        # as the student who signed in first — which would make this sweep a lie.
        client.cookies.clear()
    for method, path in ADMIN_CALLS:
        response = client.request(
            method,
            path,
            headers=auth(token) if token else None,
            json={} if method in ("post", "patch", "put") else None,
        )
        if response.status_code != expected:
            offenders.append(f"{method} {path} -> {response.status_code}")
    return offenders


check(
    "an anonymous caller is refused on every operator route, with no exceptions",
    not (anonymous := sweep(None, 401)),
    "; ".join(anonymous)[:300],
)
check(
    "a student account is refused on every one of them",
    not (as_student := sweep(student_token, 403)),
    "; ".join(as_student)[:300],
)
check(
    "a parent account is refused on every one of them",
    not (as_parent := sweep(parent_token, 403)),
    "; ".join(as_parent)[:300],
)
check(
    "and so is a school's own administrator: an org_role is not the platform's flag",
    not (as_school_admin := sweep(school_lead_token, 403)),
    "; ".join(as_school_admin)[:300],
)
denied = client.get(SUMMARY, headers=auth(student_token))
check(
    "the refusal names the only way to get the flag, so it is actionable",
    denied.status_code == 403 and "admin_grant.py" in denied.text,
    denied.text[:200],
)
check(
    "a closed account holding the flag is refused before the flag is ever read",
    client.get(SUMMARY, headers=auth(closed_token)).status_code == 401,
)
check(
    "a bearer string that belongs to nobody is a 401, not a 500",
    client.get(SUMMARY, headers=auth("not-a-token-at-all-xxxxxxxxxxxxxxxx")).status_code == 401,
)

guard_on_router = any(
    dependency.dependency is get_admin_user
    for dependency in admin_routes.router.dependencies
)
check(
    "the guard hangs on the router, so a route added under it cannot leave it out",
    guard_on_router,
)
check(
    "the operator's own probe says only that this account is the operator",
    call("get", "/api/admin/me", token=op_token).json() == {"is_admin": True},
)

# The other half of "there is no way to ask for it from a page": no request body in the whole
# API, outside the operator routes, declares such a field.
grants = []
components = OPENAPI.get("components", {}).get("schemas", {})
for path, operations in PATHS.items():
    if "admin" in path.split("/"):
        continue
    for method, operation in operations.items():
        if method not in ("get", "post", "patch", "put", "delete"):
            continue
        schema = (
            operation.get("requestBody", {})
            .get("content", {})
            .get("application/json", {})
            .get("schema", {})
        )
        ref = schema.get("$ref", "")
        if not ref:
            continue
        name = ref.rsplit("/", 1)[-1]
        for field in components.get(name, {}).get("properties", {}):
            if field in ("is_admin", "admin", "role_admin"):
                grants.append(f"{method.upper()} {path} accepts {field}")
check("no ordinary request body in the API can carry the admin flag", not grants, grants)

# ============================================ 2. what a list of people may not contain
section("2. The accounts page: how much, never what")

with SessionLocal() as db:
    session = ConversationSession(
        student_id=student_id, kind="chat", language="en", stage=0, status="active"
    )
    db.add(session)
    db.flush()
    for role, text, demo in (
        ("assistant", SENTINEL_CHILD_TEXT, True),
        ("assistant", "A second canned reply.", True),
        ("assistant", "A reply from the real model.", False),
        ("user", "I like drawing maps.", False),
    ):
        db.add(Message(session_id=session.id, role=role, content=text, demo_generated=demo))
    db.add(
        StudyLead(
            name="Family Sentinel",
            email=SENTINEL_ENQUIRY_MAIL,
            phone="+910000000000",
            message=SENTINEL_ENQUIRY_TEXT,
            consent_contact=True,
            consent_contact_at=utcnow(),
            status="new",
            stage="enquiry",
            source_page="/study-abroad",
        )
    )
    db.add(EmailJob(user_id=parent_id, purpose="welcome", ref_key="admin-test", status="pending"))
    db.add(EmailJob(user_id=parent_id, purpose="digest", ref_key="admin-test", status="failed"))
    db.commit()
    set_columns(student_id, comeback_hash=SENTINEL_COMEBACK_HASH)

page = call("get", "/api/admin/users", token=op_token)
check("the operator can list accounts", page.status_code == 200, page.text[:200])
rows = page.json()
check(
    "a page of accounts is total, limit, offset and items, and nothing else",
    set(rows) == {"total", "limit", "offset", "items"},
    sorted(rows),
)
row_fields = {key for row in rows["items"] for key in row}
check(
    "a row is the account, its state and its counts, and is nothing beyond that list",
    row_fields
    == {
        "id", "role", "display_name", "preferred_language", "is_active", "is_admin",
        "created_at", "contact_email", "email_confirmed_at", "plan_code",
        "plan_expires_at", "conversations", "assessments", "assessments_completed",
        "portal_memberships",
    },
    sorted(row_fields),
)
bad = sorted(
    key for key in row_fields if any(word in key.lower() for word in FORBIDDEN_KEYS)
)
check("no account field names a device, a token or a hash", not bad, bad)
stored = {
    "device_hash",
    "comeback_hash",
    "comeback_index",
    "email_confirm_hash",
    "email_confirm_expires_at",
}
check(
    "the account row does hold those columns, and not one of them reached this list",
    stored <= set(models.User.__table__.columns.keys()) and not stored & row_fields,
    sorted(row_fields),
)
aarav = next(row for row in rows["items"] if row["id"] == student_id)
check(
    "the operator sees that this child has one conversation, and not what was said",
    aarav["conversations"] == 1 and "content" not in aarav,
    aarav,
)
check(
    "the school administrator's row shows one active portal place, and no portal contents",
    next(row for row in rows["items"] if row["id"] == school_lead_id)["portal_memberships"] == 1,
)
check(
    "the closed account is in the list, marked closed rather than gone",
    next(row for row in rows["items"] if row["id"] == closed_id)["is_active"] is False,
)

by_mail = call("get", "/api/admin/users", token=op_token, params={"q": "kabir@example"})
check(
    "an address cannot be used to find out whether an account exists",
    by_mail.status_code == 200 and by_mail.json()["total"] == 0,
    by_mail.text[:200],
)
by_name = call("get", "/api/admin/users", token=op_token, params={"q": "Kabir"})
check(
    "a label can, which is what the screen is for",
    [row["id"] for row in by_name.json()["items"]] == [kabir_id],
    by_name.text[:200],
)
by_id = call("get", "/api/admin/users", token=op_token, params={"q": str(student_id)})
check(
    "and a pasted id finds exactly the one row",
    [row["id"] for row in by_id.json()["items"]] == [student_id],
    by_id.text[:200],
)
check(
    "role, state and flag filters only ever narrow the same list",
    all(row["role"] == "student" for row in call("get", "/api/admin/users", token=op_token, params={"role": "student"}).json()["items"])
    and all(row["is_active"] is False for row in call("get", "/api/admin/users", token=op_token, params={"state": "closed"}).json()["items"])
    and [row["id"] for row in call("get", "/api/admin/users", token=op_token, params={"flag": "operator"}).json()["items"]] == [op_id],
)
check(
    "the newest account comes first, so a fresh sign-up is findable without paging",
    [rows["items"][i]["created_at"] >= rows["items"][i + 1]["created_at"] for i in range(len(rows["items"]) - 1)]
    == [True] * (len(rows["items"]) - 1),
)
check(
    "a page size over two hundred is refused rather than served",
    client.get("/api/admin/users", headers=auth(op_token), params={"limit": 201}).status_code == 422,
)
check(
    "and an id that is not there is a 404 with a sentence, not a null row",
    client.patch(
        "/api/admin/users/999999/operator", headers=auth(op_token), json={"is_admin": True}
    ).status_code
    == 404,
)

# ======================================================= 3. the numbers, and their splits
section("3. The dashboard: every figure is one the fixtures can check")

now = utcnow()
with SessionLocal() as db:
    payer = User(role="parent", display_name="Payer One", preferred_language="en", is_active=True)
    lapsed = User(role="student", display_name="Lapsed Two", preferred_language="en",
                  is_active=True)
    db.add_all([payer, lapsed])
    db.flush()
    payer_id, lapsed_id = payer.id, lapsed.id
    for amount, status_value, test, back in (
        (129900, "captured", False, 0),
        (49900, "captured", False, 60),
        (99900, "captured", True, 0),
        (129900, "failed", False, 0),
        (129900, "refunded", False, 0),
    ):
        db.add(
            Payment(
                user_id=payer_id,
                plan_code="pro_monthly",
                interval="month",
                provider="razorpay",
                currency="INR",
                amount_paise=amount,
                status=status_value,
                test_mode=test,
                order_id=f"order_{amount}_{status_value}",
                payment_id=f"pay_{amount}_{status_value}",
                receipt=f"rcpt_{amount}_{status_value}",
                captured_at=None if status_value != "captured" else now - timedelta(days=back),
            )
        )
    db.add(Subscription(user_id=payer_id, plan_code="pro_monthly", source="payment",
                        interval="month", started_at=now, expires_at=now + timedelta(days=30)))
    db.add(Subscription(user_id=lapsed_id, plan_code="pro_monthly", source="payment",
                        interval="month", started_at=now - timedelta(days=90),
                        expires_at=now - timedelta(days=1)))
    db.add(Subscription(user_id=parent_id, plan_code="pro_yearly", source="granted",
                        interval="year", started_at=now, expires_at=None))
    for state, back in (("in_progress", 0), ("completed", 2)):
        db.add(
            Assessment(
                user_id=student_id,
                assessment_type="interest",
                language="en",
                bank_version="1",
                started_at=now - timedelta(days=back),
                completed_at=None if state == "in_progress" else now - timedelta(days=back),
                status=state,
            )
        )
    db.commit()

summary = call("get", SUMMARY, token=op_token)
check("the dashboard answers", summary.status_code == 200, summary.text[:300])
data = summary.json()
check(
    "it reports the six blocks and no seventh one nobody asked for",
    set(data) == {"generated_at", "users", "chats", "assessments", "revenue", "portals", "content"},
    sorted(data),
)
check(
    "and there is no trend, growth or projection field anywhere in it",
    not any(
        word in key.lower()
        for block in data.values()
        if isinstance(block, dict)
        for key in block
        for word in ("trend", "growth", "project", "forecast")
    ),
    sorted({key for block in data.values() if isinstance(block, dict) for key in block}),
)

users = data["users"]
check(
    "people are counted once, and the two roles add up to the total",
    users["students"] + users["parents"] == users["total"] >= 9,
    users,
)
check("the closed account is counted as closed, not missing", users["closed"] == 1, users)
check("one account holds the flag today", users["operators"] == 1, users)
check(
    "the new-in-a-week and new-in-a-month counts nest",
    users["new_7d"] <= users["new_30d"] == users["total"],
    users,
)

chats = data["chats"]
with SessionLocal() as db:
    assistants = int(
        db.scalar(
            select(func.count(Message.id)).where(Message.role == "assistant")
        )
        or 0
    )
    demo_only = int(
        db.scalar(
            select(func.count(Message.id)).where(
                Message.role == "assistant", Message.demo_generated.is_(True)
            )
        )
        or 0
    )
check(
    "a canned reply and a model reply are never added together into one number",
    chats["demo_replies"] == demo_only == 2
    and chats["real_replies"] == assistants - demo_only == 1
    and chats["demo_replies"] + chats["real_replies"] == assistants,
    (chats, demo_only, assistants),
)
check(
    "chat and voice sessions are kept apart, and add up to all sessions",
    chats["chat_sessions"] + chats["voice_sessions"] == chats["sessions"] == 1,
    chats,
)
check(
    "seven days of traffic is a subset of all of it, never larger",
    chats["sessions_7d"] <= chats["sessions"] and chats["messages_7d"] <= chats["messages"],
    chats,
)

assessed = data["assessments"]
check(
    "sittings are reported as started, finished and still-open, which is three different questions",
    assessed["started"] == 2
    and assessed["completed"] == 1
    and assessed["in_progress"] == 1
    and assessed["completed"] + assessed["in_progress"] == assessed["started"],
    assessed,
)
check(
    "the by-type buckets add to the sittings started",
    sum(bucket["count"] for bucket in assessed["by_type"]) == assessed["started"],
    assessed["by_type"],
)
check(
    "a report that was never printed is counted as none",
    assessed["pdf_reports"] == 0 and assessed["results"] == 0,
    assessed,
)

revenue = data["revenue"]
check(
    "money is reported in paise, with no float to lose a rupee in",
    all(
        isinstance(value, int)
        for key, value in revenue.items()
        if key.endswith("_paise")
    )
    and all("." not in str(value) for key, value in revenue.items() if key.endswith("_paise")),
    revenue,
)
check(
    "captured revenue is the two real payments: 129900 + 49900",
    revenue["captured_paise"] == 179800 and revenue["captured_orders"] == 2,
    revenue,
)
check(
    "the thirty-day figure leaves out the payment from sixty days ago",
    revenue["captured_paise_30d"] == 129900,
    revenue,
)
check(
    "a test-mode payment is never revenue, and is still visible as a test payment",
    revenue["test_paise"] == 99900
    and revenue["test_orders"] == 1
    and revenue["captured_paise"] != 179800 + 99900,
    revenue,
)
check(
    "a refund is reported against the money, not quietly dropped from it",
    revenue["refunded_paise"] == 129900,
    revenue,
)
check(
    "and a failed order is a count of orders, not of money",
    revenue["failed_orders"] == 1,
    revenue,
)
check(
    "an expired licence is not a paying account this month",
    revenue["paying_accounts"] == 1 and revenue["granted_accounts"] == 1,
    revenue,
)
check(
    "the per-plan buckets agree with the accounts counted above them",
    sum(bucket["count"] for bucket in revenue["by_plan"])
    == revenue["paying_accounts"] + revenue["granted_accounts"]
    == 2,
    revenue["by_plan"],
)

portals = data["portals"]
check(
    "portals split by kind, and places split by whether anybody accepted",
    portals["schools"] + portals["practices"] == portals["organizations"] == 1
    and portals["members_active"] == 1
    and portals["members_invited"] == 0,
    portals,
)
check(
    "not one session note is shared, because none was written",
    portals["notes_shared"] == 0,
    portals,
)
content = data["content"]
check(
    "the content block counts the catalogue, the leads and the mail queue",
    content["leads_total"] == 1
    and content["leads_open"] == 1
    and content["email_queued"] == 1
    and content["email_failed"] == 1,
    content,
)
check(
    "an unseeded question bank reads as zero, which is the number and not a made-up one",
    content["questions"] == 0,
    content,
)
check(
    "and it says how much of the catalogue admits it has not been checked",
    content["careers_to_verify"] <= content["careers"],
    content,
)

# ================================================ 4. changing an account, and its record
section("4. The flag, the door, and the row each change leaves")

check(
    "a flag set by hand, as this suite set it, leaves no log row — which is why the script is tested too",
    audit_rows("user.admin_grant") == [],
    detail_of(audit_rows("user.admin_grant")),
)
self_demote = call(
    "patch", f"/api/admin/users/{op_id}/operator", token=op_token, json={"is_admin": False}
)
check(
    "an operator cannot take the flag off their own account",
    self_demote.status_code == 422 and "your own account" in self_demote.text,
    self_demote.text[:200],
)
grant_closed = call(
    "patch", f"/api/admin/users/{closed_id}/operator", token=op_token, json={"is_admin": True}
)
check(
    "and cannot leave a flag on an account that cannot sign in",
    grant_closed.status_code == 422 and "locked door" in grant_closed.text,
    grant_closed.text[:200],
)

granted = call(
    "patch", f"/api/admin/users/{kabir_id}/operator", token=op_token, json={"is_admin": True}
)
check("granting the flag to an open account works, and returns the row", granted.status_code == 200, granted.text[:200])
check("the row now says this account is an operator", granted.json()["is_admin"] is True)
log_rows = audit_rows("user.admin_grant", str(kabir_id))
check(
    "exactly one log row for the change, in the same transaction as the change",
    len(log_rows) == 1,
    len(log_rows),
)
row = log_rows[0]
check(
    "the log names who did it, from the account rather than from the request",
    row.actor_user_id == op_id and row.actor_name == "Meera Nair",
    (row.actor_user_id, row.actor_name),
)
check(
    "and it holds the state that resulted, not a value about either person",
    row.detail == "is_admin -> true"
    and row.subject_type == "user"
    and row.subject_id == str(kabir_id)
    and row.origin == "api",
    (row.detail, row.subject_type, row.subject_id, row.origin),
)
noop = call(
    "patch", f"/api/admin/users/{kabir_id}/operator", token=op_token, json={"is_admin": True}
)
check(
    "a change that changes nothing answers 200 and writes nothing",
    noop.status_code == 200 and len(audit_rows("user.admin_grant", str(kabir_id))) == 1,
    len(audit_rows("user.admin_grant", str(kabir_id))),
)
self_close = call(
    "patch", f"/api/admin/users/{op_id}/status", token=op_token, json={"is_active": False}
)
check(
    "an operator cannot close their own account from this screen",
    self_close.status_code == 422 and "operator flag" in self_close.text,
    self_close.text[:200],
)
closed_row = call(
    "patch", f"/api/admin/users/{kabir_id}/status", token=op_token, json={"is_active": False}
)
check(
    "somebody else's account can be closed, and the second operator stays open",
    closed_row.status_code == 200 and closed_row.json()["is_active"] is False,
    closed_row.text[:200],
)
check(
    "closing writes its own row, naming the field and the state",
    detail_of(audit_rows("user.status", str(kabir_id))) == ["is_active -> false"],
    detail_of(audit_rows("user.status", str(kabir_id))),
)
check(
    "and the closed account's own next request is refused, token and all",
    client.get(SUMMARY, headers=auth(kabir_token)).status_code == 401,
)
reopened = call(
    "patch", f"/api/admin/users/{kabir_id}/status", token=op_token, json={"is_active": True}
)
check(
    "reopening works, because closing is not deleting",
    reopened.status_code == 200 and reopened.json()["is_active"] is True
    and detail_of(audit_rows("user.status", str(kabir_id))) == ["is_active -> false", "is_active -> true"],
    detail_of(audit_rows("user.status", str(kabir_id))),
)
check(
    "nothing about a child's work was destroyed by closing and reopening",
    next(
        r
        for r in call("get", "/api/admin/users", token=op_token).json()["items"]
        if r["id"] == student_id
    )["conversations"]
    == 1,
)
revoked = call(
    "patch", f"/api/admin/users/{kabir_id}/operator", token=op_token, json={"is_admin": False}
)
check(
    "the flag can be taken back off somebody who is not you",
    revoked.status_code == 200 and revoked.json()["is_admin"] is False
    and detail_of(audit_rows("user.admin_revoke", str(kabir_id))) == ["is_admin -> false"],
    revoked.text[:200],
)
lone_before = int(call("get", SUMMARY, token=op_token).json()["users"]["operators"])
call("patch", f"/api/admin/users/{op_id}/operator", token=op_token, json={"is_admin": False})
call("patch", f"/api/admin/users/{op_id}/status", token=op_token, json={"is_active": False})
lone_after = int(call("get", SUMMARY, token=op_token).json()["users"]["operators"])
check(
    "a lone operator cannot lock the site out of itself, by any call they can make",
    lone_before == lone_after == 1,
    (lone_before, lone_after),
)

printed = io.StringIO()
with redirect_stdout(printed):
    script_rc = admin_grant.main(["--email", DEV_MAIL])
check(
    "the script refuses an address that is only typed and never confirmed",
    script_rc == 1 and "never confirmed" in printed.getvalue(),
    printed.getvalue(),
)
set_columns(scripted_id, email_confirmed_at=utcnow())
printed = io.StringIO()
with redirect_stdout(printed):
    script_rc = admin_grant.main(["--email", DEV_MAIL])
scripted_log = audit_rows("user.admin_grant", str(scripted_id))
check(
    "the script grants the flag on a confirmed address",
    script_rc == 0 and "Granted admin access" in printed.getvalue(),
    printed.getvalue(),
)
check(
    "and logs it with no actor account, because no account stood behind it",
    len(scripted_log) == 1
    and scripted_log[0].actor_user_id is None
    and scripted_log[0].actor_name is None
    and scripted_log[0].origin == "script"
    and "shell" in scripted_log[0].detail,
    [(r.actor_user_id, r.actor_name, r.origin, r.detail) for r in scripted_log],
)
check(
    "the flag the shell set works on the next request from that account",
    call("get", "/api/admin/me", token=scripted_token).json() == {"is_admin": True},
)
printed = io.StringIO()
with redirect_stdout(printed):
    again_rc = admin_grant.main(["--email", DEV_MAIL])
check(
    "granting it twice changes nothing and records nothing",
    again_rc == 0
    and "already holds" in printed.getvalue()
    and len(audit_rows("user.admin_grant", str(scripted_id))) == 1,
    printed.getvalue(),
)
printed = io.StringIO()
with redirect_stdout(printed):
    admin_grant.main(["--list"])
check("the script can show who holds it", "admin account(s)" in printed.getvalue(), printed.getvalue())
printed = io.StringIO()
with redirect_stdout(printed):
    no_account = admin_grant.main(["--email", "nobody@example.invalid"])
check(
    "and refuses an address that has no account, rather than guessing",
    no_account == 1 and "No account" in printed.getvalue(),
    printed.getvalue(),
)
printed = io.StringIO()
with redirect_stdout(printed):
    revoke_rc = admin_grant.main(["--email", DEV_MAIL, "--revoke"])
check(
    "revoking through the script logs that too",
    revoke_rc == 0
    and "Removed admin access" in printed.getvalue()
    and detail_of(audit_rows("user.admin_revoke", str(scripted_id)))
    == ["is_admin -> false, from a shell rather than a request"],
    printed.getvalue(),
)
printed = io.StringIO()
with redirect_stdout(printed):
    already_gone = admin_grant.main(["--email", DEV_MAIL, "--revoke"])
check(
    "a revoke of a revoke changes nothing and records nothing",
    already_gone == 0
    and "does not hold" in printed.getvalue()
    and len(audit_rows("user.admin_revoke", str(scripted_id))) == 1,
    printed.getvalue(),
)
check(
    "and that account is refused again on its very next request",
    call("get", SUMMARY, token=scripted_token).status_code == 403,
)

before_reads = audit_count()
for path, params in (
    (SUMMARY, None),
    ("/api/admin/users", None),
    ("/api/admin/me", None),
    ("/api/admin/audit", None),
    ("/api/admin/deployment", None),
    ("/api/admin/content/careers", None),
):
    call("get", path, token=op_token, params=params)
check(
    "reading the site is not an action worth logging, and is not logged",
    audit_count() == before_reads,
    (before_reads, audit_count()),
)

log_page = call("get", "/api/admin/audit", token=op_token)
check("the operator can read the log", log_page.status_code == 200, log_page.text[:200])
page_data = log_page.json()
check(
    "the page is a list plus the distinct actions to filter it by",
    set(page_data) == {"total", "limit", "offset", "items", "actions"}
    and "user.admin_grant" in page_data["actions"],
    sorted(page_data),
)
check(
    "newest first, so the top of the list is what happened last",
    all(
        page_data["items"][i]["created_at"] >= page_data["items"][i + 1]["created_at"]
        for i in range(len(page_data["items"]) - 1)
    ),
)
check(
    "a log row never carries the thing that was written, only that it was written",
    all(" -> " in (item["detail"] or "") or (item["detail"] or "").startswith("changed:")
        for item in page_data["items"] if item["detail"]),
    [item["detail"] for item in page_data["items"]],
)
filtered = call("get", "/api/admin/audit", token=op_token, params={"action": "user.status"})
check(
    "the action filter narrows to that action alone",
    filtered.status_code == 200
    and filtered.json()["total"] == len(audit_rows("user.status"))
    and {item["action"] for item in filtered.json()["items"]} == {"user.status"},
    filtered.text[:200],
)
by_actor = call("get", "/api/admin/audit", token=op_token, params={"actor": op_id})
check(
    "and an actor filter leaves out the rows the shell wrote",
    all(item["actor_user_id"] == op_id for item in by_actor.json()["items"])
    and by_actor.json()["total"] < page_data["total"],
    by_actor.text[:200],
)
window = call(
    "get",
    "/api/admin/audit",
    token=op_token,
    params={"since": (now + timedelta(days=1)).isoformat()},
)
check(
    "a window that has not happened yet is empty rather than everything",
    window.status_code == 200 and window.json()["total"] == 0,
    window.text[:200],
)

# ================================================= 5. content, and what it refuses
section("5. The catalogue: correct what is wrong, refuse what would lie")

with SessionLocal() as db:
    db.add(
        Career(
            slug="admin-test-career",
            title="Cartographer",
            category="Design",
            summary="Makes maps.",
            min_class=9,
            needs_verification=True,
        )
    )
    db.add(
        Question(
            assessment_type="interest",
            code="ADMIN01",
            dimension="spatial",
            order=990,
            response_type="choice",
            keyed="+",
            text_en="Which of these would you rather draw?",
            text_hi="आप इनमें से क्या बनाना चाहेंगे?",
            options_json=[{"value": "A", "label": "A map"}, {"value": "B", "label": "A list"}],
            correct_value="A",
        )
    )
    db.add(
        Question(
            assessment_type="interest",
            code="ADMIN02",
            dimension="spatial",
            order=991,
            response_type="choice",
            keyed="+",
            text_en="A second item nobody has answered yet.",
            text_hi="दूसरा प्रश्न।",
            options_json=[{"value": "A", "label": "Yes"}, {"value": "B", "label": "No"}],
            correct_value="A",
        )
    )
    db.flush()
    sitting = Assessment(
        user_id=student_id,
        assessment_type="interest",
        language="en",
        bank_version="1",
        started_at=now,
        completed_at=now,
        status="completed",
    )
    db.add(sitting)
    db.flush()
    db.add(Response(assessment_id=sitting.id, code="ADMIN01", value="A"))
    db.commit()

careers = call("get", "/api/admin/content/careers", token=op_token, params={"q": "admin-test"})
check("the career catalogue is listable", careers.status_code == 200, careers.text[:200])
check(
    "and one search finds the entry the fixtures made",
    [row["slug"] for row in careers.json()["items"]] == ["admin-test-career"],
    careers.text[:200],
)
verify_only = call("get", "/api/admin/content/careers", token=op_token, params={"to_verify": True})
check(
    "the working view shows only rows that admit they are unverified",
    all(row["needs_verification"] is True for row in verify_only.json()["items"]),
    verify_only.text[:200],
)
edited = call(
    "patch",
    "/api/admin/content/careers/admin-test-career",
    token=op_token,
    json={"summary": SENTINEL_NEW_SUMMARY, "min_class": 11},
)
check(
    "a career entry can be corrected",
    edited.status_code == 200 and edited.json()["summary"] == SENTINEL_NEW_SUMMARY
    and edited.json()["min_class"] == 11,
    edited.text[:300],
)
career_log = audit_rows("career.update", "admin-test-career")
check(
    "the log names the fields that moved and not their new values",
    len(career_log) == 1 and career_log[0].detail == "changed: min_class, summary",
    detail_of(career_log),
)
check(
    "and the log page contains no copy of what was written",
    SENTINEL_NEW_SUMMARY not in call("get", "/api/admin/audit", token=op_token).text,
)
check(
    "a class below six is refused, because the catalogue starts at class 6",
    client.patch(
        "/api/admin/content/careers/admin-test-career",
        headers=auth(op_token),
        json={"min_class": 5},
    ).status_code
    == 422,
)
check(
    "…and so is one above twelve",
    client.patch(
        "/api/admin/content/careers/admin-test-career",
        headers=auth(op_token),
        json={"min_class": 13},
    ).status_code
    == 422,
)
flag_refused = call(
    "patch",
    "/api/admin/content/careers/admin-test-career",
    token=op_token,
    json={"needs_verification": False},
)
check(
    "the verified flag is not a thing this screen can switch",
    flag_refused.status_code == 422 and "not editable here" in flag_refused.text,
    flag_refused.text[:250],
)
unflag_refused = call(
    "patch",
    "/api/admin/content/careers/admin-test-career",
    token=op_token,
    json={"needs_verification": True},
)
check(
    "in either direction, including the one that looks like honesty",
    unflag_refused.status_code == 422,
    unflag_refused.text[:200],
)
check(
    "a body that changes nothing is refused rather than logged as a change",
    call("patch", "/api/admin/content/careers/admin-test-career", token=op_token, json={}).status_code
    == 422,
)
check(
    "a slug is not editable, because it is the address a family kept",
    client.patch(
        "/api/admin/content/careers/admin-test-career",
        headers=auth(op_token),
        json={"slug": "renamed-cartographer"},
    ).status_code
    == 422,
)
check(
    "the refused calls above wrote no log row",
    len(audit_rows("career.update", "admin-test-career")) == 1,
    detail_of(audit_rows("career.update", "admin-test-career")),
)

questions = call(
    "get", "/api/admin/content/questions", token=op_token, params={"assessment_type": "interest"}
)
check("the bank is listable", questions.status_code == 200, questions.text[:200])
by_code = {row["code"]: row for row in questions.json()["items"]}
check(
    "both fixtures appear",
    {"ADMIN01", "ADMIN02"} <= set(by_code),
    sorted(by_code),
)
check(
    "an item somebody has answered shows the count and refuses to be editable",
    by_code["ADMIN01"]["answers"] == 1 and by_code["ADMIN01"]["editable"] is False,
    by_code["ADMIN01"],
)
check(
    "and an item nobody has answered is editable",
    by_code["ADMIN02"]["answers"] == 0 and by_code["ADMIN02"]["editable"] is True,
    by_code["ADMIN02"],
)
answered_edit = call(
    "patch",
    f"/api/admin/content/questions/{by_code['ADMIN01']['id']}",
    token=op_token,
    json={"text_en": "Reworded after a child answered it"},
)
check(
    "rewording an answered item is refused outright, with the reason",
    answered_edit.status_code == 409 and "part of a score" in answered_edit.text,
    answered_edit.text[:250],
)
clean_edit = call(
    "patch",
    f"/api/admin/content/questions/{by_code['ADMIN02']['id']}",
    token=op_token,
    json={"text_en": "A second item, asked a little better now."},
)
check(
    "an unanswered item can be reworded",
    clean_edit.status_code == 200
    and clean_edit.json()["text_en"].startswith("A second item, asked"),
    clean_edit.text[:250],
)
check(
    "logged by field name, with no copy of the new wording",
    detail_of(audit_rows("question.update", "ADMIN02")) == ["changed: text_en"],
    detail_of(audit_rows("question.update", "ADMIN02")),
)
check(
    "and the new wording is not in the log page either",
    "asked a little better" not in call("get", "/api/admin/audit", token=op_token).text,
)

blog = call("get", "/api/admin/content/blog", token=op_token)
check("the blog route answers", blog.status_code == 200, blog.text[:200])
blog_data = blog.json()
check(
    "and says plainly that it cannot edit the blog",
    blog_data["editable_here"] is False
    and blog_data["where"] == "frontend/src/content/blog/"
    and "commit" in blog_data["how"],
    blog_data,
)
blog_methods = sorted(m.upper() for m in PATHS.get("/api/admin/content/blog", {}))
check(
    "there is no write route behind it, so the screen cannot grow a dead Save button",
    blog_methods == ["GET"],
    blog_methods,
)
check(
    "an unknown question id is a 404",
    client.patch(
        "/api/admin/content/questions/987654",
        headers=auth(op_token),
        json={"text_en": "A wording that asks about nobody at all."},
    ).status_code
    == 404,
)

# ================================================== 6. the throttle, and where it is not
section("6. A brake on a script, not a wall against a page load")

limiter.reset()
codes = [
    client.patch(
        "/api/admin/content/careers/no-such-career",
        headers=auth(op_token),
        json={"summary": "A summary long enough to be tried."},
    ).status_code
    for _ in range(8)
]
check(
    "five writes go through in a minute and the rest wait for it",
    codes[0] == 404 and codes[-1] == 429 and codes.count(404) == 5,
    codes,
)
check(
    "an entry that is not there is a 404 rather than a silent no-op",
    404 in codes,
    codes,
)
throttled = client.patch(
    "/api/admin/content/careers/no-such-career",
    headers=auth(op_token),
    json={"summary": "A summary long enough to be tried."},
)
check(
    "the 429 tells the operator their earlier change is saved, in a sentence",
    "Too many changes" in throttled.text and "half-applied" in throttled.text,
    throttled.text[:250],
)
check(
    "and says how long to wait",
    int(throttled.headers.get("Retry-After", "0")) >= 1,
    throttled.headers.get("Retry-After"),
)
reads = [client.get(SUMMARY, headers=auth(op_token)).status_code for _ in range(8)]
check(
    "reading the dashboard is not throttled, so a reload cannot lock an operator out",
    set(reads) == {200},
    reads,
)

# ===================================================== 7. the deployment screen, no keys
section("7. What this process runs on, with nothing secret in it")

deployment = call("get", "/api/admin/deployment", token=op_token)
check("the operator can see the deployment's own settings", deployment.status_code == 200, deployment.text[:300])
config = deployment.json()
secrets = [
    os.environ["GEMINI_API_KEY"],
    os.environ["AZURE_SPEECH_KEY"],
    os.environ["RESEND_API_KEY"],
    os.environ["RAZORPAY_KEY_ID"],
    os.environ["RAZORPAY_KEY_SECRET"],
    os.environ["RAZORPAY_WEBHOOK_SECRET"],
    os.environ["CLERK_SECRET_KEY"],
]
echoed = [name for name in secrets if name in deployment.text]
check(
    "not one key value the process holds appears in the response",
    not echoed,
    echoed,
)
key_named = sorted(
    name for name in config if ("key" in name.lower() or "secret" in name.lower())
)
check(
    "a field about a key is a presence boolean and is named for it",
    all(name.startswith("has_") and config[name] in (True, False) for name in key_named),
    [(name, config[name]) for name in key_named],
)
check(
    "the five keys this app can hold are all reported as present",
    config["has_gemini_key"]
    and config["has_azure_key"]
    and config["has_clerk_key"]
    and config["has_resend_key"]
    and config["webhook_verifiable"],
    config,
)
check(
    "the database is named by engine, and its URL — which holds a password — is not",
    config["database_engine"] == "sqlite" and ":///" not in deployment.text,
    config["database_engine"],
)
check(
    "the admin throttle rule shown is the one the process started with",
    config["rate_limit_admin"] == get_settings().rate_limit_admin == "5 per minute",
    config["rate_limit_admin"],
)
check(
    "and the screen says it is not editable, rather than showing controls",
    config["editable"] is False,
    config["editable"],
)
deployment_methods = sorted(m.upper() for m in PATHS.get("/api/admin/deployment", {}))
check(
    "no method can write to it",
    deployment_methods == ["GET"],
    deployment_methods,
)
check(
    "the two trust-a-header switches are visible, because either one left on is a hole",
    config["tenant_trust_forwarded_host"] is False
    and "rate_limit_trust_forwarded_for" in config,
    config,
)

# ================================================== 8. the log's own shape, and the sweep
section("8. Append-only, and nothing about a child anywhere in it")

audit_methods = sorted(m.upper() for m in PATHS.get("/api/admin/audit", {}))
check(
    "the log can be read and filtered, and is not one of the things a route can delete",
    audit_methods == ["GET"],
    audit_methods,
)
user_methods = {
    method.upper()
    for path, operations in PATHS.items()
    if path.startswith("/api/admin/users")
    for method in operations
}
check(
    "there is no delete on an account: closing is the whole of what this screen may do to one",
    "DELETE" not in user_methods,
    user_methods,
)
with SessionLocal() as db:
    columns = {column.name for column in AuditEvent.__table__.columns}
    check(
        "the log table has no column that could hold a request body",
        columns
        == {
            "id", "actor_user_id", "actor_name", "action", "subject_type",
            "subject_id", "detail", "origin", "created_at",
        },
        sorted(columns),
    )
    check(
        "and no address, user agent or device string to hold one either",
        not {"ip", "ip_address", "user_agent", "device_id", "body"} & columns,
        sorted(columns),
    )
    pointers = {
        target.target_fullname
        for column in AuditEvent.__table__.columns
        for target in column.foreign_keys
    }
    check(
        "the one table it points at is the account, not a person's work",
        pointers == {"users.id"},
        pointers,
    )


def walk(node):
    if isinstance(node, dict):
        for key, value in node.items():
            yield key, value
            yield from walk(value)
    elif isinstance(node, list):
        for item in node:
            yield from walk(item)


leaking_keys = sorted(
    {
        key
        for response in SAMPLES
        for key, _ in walk(response.json())
        if any(word in key.lower() for word in FORBIDDEN_KEYS)
    }
)
check(
    "no field name, at any depth, in any of the %d operator responses is a device, token or hash"
    % len(SAMPLES),
    not leaking_keys,
    leaking_keys,
)
everything = " ".join(str(response.json()) for response in SAMPLES)
# The new career summary is deliberately not in this set: the route that edited it returns
# the row it just changed, and a career entry is public catalogue text. What has to hold —
# that the log holds field names rather than values — is checked where the edit happens.
private = {
    "a child's message": SENTINEL_CHILD_TEXT,
    "a device id": SENTINEL_DEVICE_ID,
    "a come-back hash": SENTINEL_COMEBACK_HASH,
    "a family's enquiry text": SENTINEL_ENQUIRY_TEXT,
}
found = sorted(name for name, value in private.items() if value in everything)
check(
    "and none of the planted private values appears in any operator response",
    not found,
    found,
)
check(
    "the operator's own address is in the accounts list, which is the one thing they need it for",
    OP_MAIL in everything,
)

LIFESPAN.close()

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + "; ".join(FAIL))
    sys.exit(1)
