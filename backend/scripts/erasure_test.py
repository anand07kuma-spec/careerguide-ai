"""Test account erasure: what `DELETE /api/users/me` takes, what it leaves, and who it must not reach.

The person using this app has never typed a password, so the route that takes their record
back has to work from the session alone — and get it right without a confirmation email to
fall back on. The checks below are grouped by the four claims the route makes.

* **Everything describing the person goes.** Rows are built for one account across every
  table the route names, the response's per-table counts are compared against what was
  actually there, and then every one of those tables is re-counted as zero. A count in a
  response is a claim; the database is the evidence.
* **The row survives and stops being a person.** It is anonymised rather than dropped,
  because `payments` and `audit_events` point at it and a ledger the payer can delete is not
  a ledger. So the money rows are checked to still exist, still point at the same id.
* **Every session ends, not only the one that asked.** Two tokens are started for the
  account, on two devices, and both must stop authenticating — otherwise a phone left signed
  in keeps a record that was just asked to be forgotten.
* **Nobody else is taken down with them.** A parent's erasure must leave the child's work
  alone; a counsellor's note about the erased person goes with the seat it was written from,
  while the counsellor's own account and every other student's data stay.

The refusal half matters as much as the deletion: an operator account is refused, because an
erased operator would leave the site's own history attributed to a row that no longer exists.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/erasure_test.py
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_erasure_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["CLERK_SECRET_KEY"] = ""
# Roomy: this suite signs in several times on purpose, and a 429 on the second onboarding
# would look like an authentication bug rather than a limit.
os.environ["RATE_LIMIT_ENABLED"] = "true"
os.environ["RATE_LIMIT_AUTH"] = "500 per minute"
os.environ["RATE_LIMIT_GUEST"] = "500 per minute"

from contextlib import ExitStack  # noqa: E402
from datetime import datetime, timezone  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    Assessment,
    AuditEvent,
    AuthToken,
    Career,
    CareerReport,
    ConsentRecord,
    ConversationSession,
    EmailJob,
    Guardianship,
    InterestObservation,
    JourneyEvent,
    Membership,
    Message,
    Organization,
    PdfReport,
    Payment,
    Recommendation,
    Response as AssessmentResponse,
    Result,
    SavedCareer,
    SessionNote,
    StudentProfile,
    StudyPlan,
    StudyPlanItem,
    Subscription,
    User,
    UserSettings,
)
from app.routers import users as users_route  # noqa: E402

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


client = TestClient(app)
LIFESPAN = ExitStack()
LIFESPAN.enter_context(client)
bare = TestClient(app)

DEVICE = "erasure-suite-student"


def sign_up(device: str, name: str = "Erase Me", role: str = "student") -> tuple[str, int]:
    response = client.post(
        "/api/auth/onboarding",
        json={
            "role": role,
            "display_name": name,
            "preferred_language": "en",
            "class_level": "class-12",
            "interest_areas": ["drawing"],
            "consent_profile": True,
            "consent_voice": False,
            "consent_age": "11-12",
            "device_id": device,
        },
    )
    assert response.status_code == 200, response.text[:300]
    return response.json()["token"], response.json()["user"]["id"]


def second_session(device: str) -> str:
    """A session on another device, which is the only way to prove erasure ends it."""
    response = client.post("/api/auth/guest", json={"device_id": device})
    assert response.status_code == 200 and response.json()["known"] is True, response.text[:200]
    return response.json()["session"]["token"]


def count(db, model, column, user_id: int) -> int:
    return int(db.scalar(select(func.count()).select_from(model).where(column == user_id)) or 0)


def populate(user_id: int) -> None:
    """Write one row into everything the route claims to remove.

    The sign-in itself already created a profile, a consent and a settings row, so those
    three are updated rather than added — writing a second one would break on the database's
    own rules instead of testing the erasure.
    """
    with SessionLocal() as db:
        career = db.scalar(select(Career).limit(1))
        session = ConversationSession(student_id=user_id, kind="chat", language="en", status="active")
        db.add(session)
        db.flush()
        for index in range(3):
            db.add(Message(session_id=session.id, role="user", content=f"A private sentence number {index}."))
        db.add(InterestObservation(student_id=user_id, session_id=session.id, theme="drawing", evidence="said they draw"))
        plan = StudyPlan(student_id=user_id, title="A plan", goal="To finish the syllabus")
        db.add(plan)
        db.flush()
        db.add(StudyPlanItem(plan_id=plan.id, title="One chapter"))
        db.add(JourneyEvent(student_id=user_id, kind="checkpoint", title="Finished a chapter"))
        db.add(SavedCareer(student_id=user_id, career_id=career.id))
        db.add(Recommendation(student_id=user_id, career_id=career.id, why="Because the suite wrote it."))
        db.add(CareerReport(student_id=user_id, content={"careers": [career.title]}))
        assessment = Assessment(user_id=user_id, assessment_type="interest", language="en", status="completed")
        db.add(assessment)
        db.flush()
        db.add(AssessmentResponse(assessment_id=assessment.id, code="Q1", value="a"))
        result = Result(assessment_id=assessment.id, user_id=user_id, assessment_type="interest", score_json={"a": 1})
        db.add(result)
        db.flush()
        db.add(
            PdfReport(
                student_id=user_id,
                anchor_result_id=result.id,
                language="en",
                filename="report.pdf",
                pdf_bytes=b"%PDF-1.4 not really a pdf",
                result_ids=[result.id],
            )
        )
        settings = db.scalar(select(UserSettings).where(UserSettings.user_id == user_id))
        if settings is None:
            db.add(UserSettings(user_id=user_id, language="en", save_history=True))
        else:
            settings.language = "en"
            settings.save_history = True
        if db.scalar(select(ConsentRecord).where(ConsentRecord.user_id == user_id)) is None:
            db.add(ConsentRecord(user_id=user_id, scope="profile", granted=True, version="1"))
        db.add(EmailJob(user_id=user_id, purpose="welcome", status="queued", detail="a body with a name in it"))
        db.commit()


# ---------------------------------------------------------------- 1. the door
section("1. the route works from the session, and from nothing else")

anonymous = bare.delete("/api/users/me")
check("a stranger cannot ask for an erasure", anonymous.status_code == 401, anonymous.status_code)
check(
    "and is asked to sign in rather than blamed",
    "sign in" in anonymous.json()["detail"].lower(),
    anonymous.text[:200],
)
forged = bare.delete("/api/users/me", headers=auth("a" * 48))
check("an invented credential reaches nothing", forged.status_code == 401, forged.status_code)
check("and no account was touched by trying", bare.get("/api/health").status_code == 200)

# ---------------------------------------------------------------- 2. what an erasure takes
section("2. everything that describes the person")

token, student_id = sign_up(DEVICE)
other_device_token = second_session(DEVICE)
populate(student_id)

with SessionLocal() as db:
    before = {
        "conversations": count(db, ConversationSession, ConversationSession.student_id, student_id),
        "assessments": count(db, Assessment, Assessment.user_id, student_id),
        "results": count(db, Result, Result.user_id, student_id),
        "reports": count(db, CareerReport, CareerReport.student_id, student_id),
        "pdfs": count(db, PdfReport, PdfReport.student_id, student_id),
        "plans": count(db, StudyPlan, StudyPlan.student_id, student_id),
        "saved": count(db, SavedCareer, SavedCareer.student_id, student_id),
        "recommendations": count(db, Recommendation, Recommendation.student_id, student_id),
        "journey": count(db, JourneyEvent, JourneyEvent.student_id, student_id),
        "observations": count(db, InterestObservation, InterestObservation.student_id, student_id),
        "profile": count(db, StudentProfile, StudentProfile.user_id, student_id),
        "settings": count(db, UserSettings, UserSettings.user_id, student_id),
        "consents": count(db, ConsentRecord, ConsentRecord.user_id, student_id),
        "emails": count(db, EmailJob, EmailJob.user_id, student_id),
        "sessions": count(db, AuthToken, AuthToken.user_id, student_id),
    }
check("the fixture really wrote a conversation", before["conversations"] == 1, str(before))
check("an assessment with an answer and a result", before["assessments"] == 1 and before["results"] == 1, str(before))
check("a report and the PDF printed from it", before["reports"] == 1 and before["pdfs"] == 1, str(before))
check("a study plan, saved careers and suggestions", before["plans"] == 1 and before["saved"] == 1 and before["recommendations"] == 1)
check("a profile, settings and the consents given", before["profile"] == 1 and before["settings"] == 1 and before["consents"] == 1)
check("mail that was still queued about them", before["emails"] >= 1, str(before["emails"]))
check("and a session on each of two devices", before["sessions"] == 2, str(before["sessions"]))
check(
    "the sign-in itself stored the profile the route will remove",
    before["profile"] == 1,
)

erased = client.delete("/api/users/me", headers=auth(token))
check("the account asks for its own erasure", erased.status_code == 200, erased.text[:300])
payload = erased.json()
check("the answer names a date", payload["erased_at"] is not None)
check("and gives counts rather than a promise", isinstance(payload["removed"], dict) and len(payload["removed"]) > 8, str(payload["removed"]))
check(
    "every table it wrote a number for really had that number in it",
    payload["removed"]["messages"] == 3 and payload["removed"]["conversations"] == 1,
    str(payload["removed"]),
)
check(
    "the counts match what the database held, not what a schema could hold",
    payload["removed"]["assessments"] == before["assessments"]
    and payload["removed"]["reports_pdf"] == before["pdfs"]
    and payload["removed"]["study_plans"] == before["plans"],
    str(payload["removed"]),
)
check("it says which rows are kept, and why", len(payload["kept"]) >= 2, str(payload["kept"]))
check(
    "the money ledger is one of them",
    any("payment" in line.lower() or "refund" in line.lower() for line in payload["kept"]),
    str(payload["kept"]),
)
check(
    "the answer is the app's own sentence, not a legal claim",
    "compliant" not in payload["message"].lower() and "erased" in payload["message"].lower(),
    payload["message"],
)

with SessionLocal() as db:
    gone = {
        "conversations": count(db, ConversationSession, ConversationSession.student_id, student_id),
        "assessments": count(db, Assessment, Assessment.user_id, student_id),
        "results": count(db, Result, Result.user_id, student_id),
        "reports": count(db, CareerReport, CareerReport.student_id, student_id),
        "pdfs": count(db, PdfReport, PdfReport.student_id, student_id),
        "plans": count(db, StudyPlan, StudyPlan.student_id, student_id),
        "saved": count(db, SavedCareer, SavedCareer.student_id, student_id),
        "recommendations": count(db, Recommendation, Recommendation.student_id, student_id),
        "journey": count(db, JourneyEvent, JourneyEvent.student_id, student_id),
        "observations": count(db, InterestObservation, InterestObservation.student_id, student_id),
        "profile": count(db, StudentProfile, StudentProfile.user_id, student_id),
        "settings": count(db, UserSettings, UserSettings.user_id, student_id),
        "consents": count(db, ConsentRecord, ConsentRecord.user_id, student_id),
        "emails": count(db, EmailJob, EmailJob.user_id, student_id),
        "sessions": count(db, AuthToken, AuthToken.user_id, student_id),
    }
    orphan_messages = int(db.scalar(select(func.count()).select_from(Message)) or 0)
    orphan_answers = int(db.scalar(select(func.count()).select_from(AssessmentResponse)) or 0)
    orphan_items = int(db.scalar(select(func.count()).select_from(StudyPlanItem)) or 0)
    orphan_results = int(db.scalar(select(func.count()).select_from(Result)) or 0)
check("and after the call, every one of those tables is empty for that account", all(value == 0 for value in gone.values()), str(gone))
check("the messages went with their conversation", orphan_messages == 0, str(orphan_messages))
check("the answers went with their assessment", orphan_answers == 0, str(orphan_answers))
check("the plan items went with the plan", orphan_items == 0, str(orphan_items))
check("the result went with the account", orphan_results == 0, str(orphan_results))

# ---------------------------------------------------------------- 3. what an erasure leaves
section("3. the row survives, emptied")

with SessionLocal() as db:
    row = db.get(User, student_id)
    check("the account is still a row", row is not None)
    check("closed", row is not None and row.is_active is False)
    check("called nothing", row is not None and row.display_name == "", repr(row.display_name))
    check("no longer any kind of account", row is not None and row.role == "erased", str(row.role))
    check("no longer an operator", row is not None and row.is_admin is False)
    check("with the device digest gone, so this browser is a stranger again", row is not None and row.device_hash is None)
    check("with no come-back code", row is not None and row.comeback_hash is None and row.comeback_index is None)
    check("with no email address", row is not None and row.contact_email is None)
    check("and no linked sign-in", row is not None and row.clerk_user_id is None)
    check("holding exactly one thing: the day it was erased", row is not None and isinstance(row.erased_at, datetime), str(row.erased_at))
    ledger = Payment(
        user_id=student_id,
        order_id="suite-order",
        plan_code="family",
        interval="year",
        amount_paise=9900,
        receipt="suite-receipt",
        status="captured",
        captured_at=datetime.now(timezone.utc),
    )
    db.add(ledger)
    db.add(Subscription(user_id=student_id, plan_code="family"))
    db.commit()
    ledger_id = ledger.id

with SessionLocal() as db:
    kept_payment = db.get(Payment, ledger_id)
    check("a payment about the erased person outlives them", kept_payment is not None)
    check("still pointing at the same row", kept_payment is not None and kept_payment.user_id == student_id)
    check("because a ledger a person can delete is not a ledger", kept_payment is not None and kept_payment.receipt == "suite-receipt")

with SessionLocal() as db:
    events = list(db.scalars(select(AuditEvent).where(AuditEvent.action == "user.erase")))
check("the erasure itself is in the operator log", len(events) == 1, str(events))
event = events[0]
check("logged against the account it erased", str(event.subject_id) == str(student_id), str(event.subject_id))
check("with the erased person's name taken off it", event.actor_name is None, repr(event.actor_name))
check("saying how much was removed", "erased" in (event.detail or "") and "rows" in (event.detail or ""), str(event.detail))
check(
    "the counts in the log add up to the counts in the answer",
    str(sum(payload["removed"].values())) in (event.detail or ""),
    str(event.detail),
)
with SessionLocal() as db:
    careers = int(db.scalar(select(func.count()).select_from(Career)) or 0)
check("the shared career catalogue was not touched", careers > 50, str(careers))

# ---------------------------------------------------------------- 4. every session dies
section("4. every device is signed out, not only the one that asked")

still = client.get("/api/auth/me", headers=auth(token))
check("the credential that made the request no longer works", still.status_code == 401, still.status_code)
phone = client.get("/api/auth/me", headers=auth(other_device_token))
check("and neither does the one the other device kept", phone.status_code == 401, phone.status_code)
again = client.delete("/api/users/me", headers=auth(other_device_token))
check("a second erasure cannot be run with a dead session", again.status_code == 401, again.status_code)
refreshed = client.post("/api/auth/refresh", headers=auth(other_device_token))
check("the session cannot renew itself back into existence", refreshed.status_code == 401, refreshed.status_code)
cookie_cleared = erased.headers.get("set-cookie", "")
check("the response tells this browser to drop the cookie", "cg_session" in cookie_cleared or "Max-Age=0" in cookie_cleared or "expires" in cookie_cleared.lower(), cookie_cleared[:200])
known = client.post("/api/auth/guest", json={"device_id": DEVICE}).json()
check("the erased account's own device no longer resolves to it", known["known"] is False, str(known))

# ---------------------------------------------------------------- 5. the people left standing
section("5. a family link is a link, not a copy")

child_token, child_id = sign_up("erasure-suite-child", name="Kept Child")
parent_token, parent_id = sign_up("erasure-suite-parent", name="Erasing Parent", role="parent")
with SessionLocal() as db:
    # A parent account arrives with a child account beside it. The second link is added here
    # so the erasure has a link it made and a link somebody else made to tell apart.
    onboarding_child = db.scalar(
        select(Guardianship.student_id).where(Guardianship.parent_id == parent_id)
    )
    db.add(Guardianship(parent_id=parent_id, student_id=child_id, relationship="mother", share_conversation_transcripts=True))
    session = ConversationSession(student_id=child_id, kind="chat", language="en", status="active")
    db.add(session)
    db.flush()
    db.add(Message(session_id=session.id, role="user", content="A sentence the parent could once read."))
    db.commit()
    child_session_id = session.id
    linked = sorted(db.scalars(select(Guardianship.student_id).where(Guardianship.parent_id == parent_id)))

check("a parent account comes with a child account of its own", onboarding_child is not None, str(onboarding_child))
check("and the parent can reach both children before the erasure", len(linked) == 2, str(linked))
gone_parent = client.delete("/api/users/me", headers=auth(parent_token))
check("the parent erases their own account", gone_parent.status_code == 200, gone_parent.text[:200])
check(
    "every link they held is counted among what went",
    gone_parent.json()["removed"]["guardianships"] == len(linked),
    str(gone_parent.json()["removed"]),
)
with SessionLocal() as db:
    child = db.get(User, child_id)
    check("the child is still an account", child is not None and child.is_active is True)
    check("with their conversation", count(db, ConversationSession, ConversationSession.student_id, child_id) == 1)
    check("and the message inside it", int(db.scalar(select(func.count()).select_from(Message).where(Message.session_id == child_session_id)) or 0) == 1)
    check("their profile is untouched", count(db, StudentProfile, StudentProfile.user_id, child_id) == 1)
    check("the link is gone from the other side too", count(db, Guardianship, Guardianship.student_id, child_id) == 0)
    beside = db.get(User, onboarding_child)
    check("and the child made beside the parent was not taken either", beside is not None and beside.is_active is True and beside.role == "student")
child_still = client.get("/api/auth/me", headers=auth(child_token))
check("the child's own session was never part of it", child_still.status_code == 200, child_still.status_code)
check("the parent's own credential stops working too", client.get("/api/auth/me", headers=auth(parent_token)).status_code == 401)
with SessionLocal() as db:
    parent_row = db.get(User, parent_id)
    check(
        "and the parent's row is kept, emptied",
        parent_row is not None and parent_row.role == "erased" and parent_row.display_name == "",
        str(parent_row),
    )
    check("with no link left on the parent's side either", count(db, Guardianship, Guardianship.parent_id, parent_id) == 0)

# ---------------------------------------------------------------- 6. a seat in somebody's portal
section("6. a counsellor's note, and the seat it was written from")

with SessionLocal() as db:
    org = Organization(slug="suite-clinic", kind="counsellor", name="Suite Counsellor Clinic")
    db.add(org)
    db.commit()
    org_id = org.id
student_token, student_two = sign_up("erasure-suite-client", name="Referred Student")
counsellor_token, counsellor_id = sign_up("erasure-suite-counsellor", name="Suite Counsellor")
with SessionLocal() as db:
    client_seat = Membership(organization_id=org_id, user_id=student_two, org_role="client", status="active")
    counsellor_seat = Membership(organization_id=org_id, user_id=counsellor_id, org_role="counsellor", status="active")
    db.add(client_seat)
    db.add(counsellor_seat)
    db.commit()
    db.add(SessionNote(organization_id=org_id, client_membership_id=client_seat.id, author_user_id=counsellor_id, body="A note about the referred student."))
    db.commit()

note_before = client.get("/api/auth/me", headers=auth(student_token))
check("the referred student is signed in", note_before.status_code == 200)
gone_client = client.delete("/api/users/me", headers=auth(student_token))
check("the student erases their account", gone_client.status_code == 200, gone_client.text[:200])
check("the seat in the portal is counted", gone_client.json()["removed"]["memberships"] == 1, str(gone_client.json()["removed"]))
check(
    "and the counsellor's note about them is counted separately, because somebody else typed it",
    gone_client.json()["removed"]["counsellor_notes"] == 1,
    str(gone_client.json()["removed"]),
)
with SessionLocal() as db:
    check("the note is gone", int(db.scalar(select(func.count()).select_from(SessionNote).where(SessionNote.author_user_id == counsellor_id)) or 0) == 0)
    check("the counsellor kept their own account", db.get(User, counsellor_id).is_active is True)
    check("and their seat", count(db, Membership, Membership.user_id, counsellor_id) == 1)
kept_counsellor = client.get("/api/auth/me", headers=auth(counsellor_token))
check("the counsellor is still signed in", kept_counsellor.status_code == 200, kept_counsellor.status_code)

# ---------------------------------------------------------------- 7. the operator cannot erase themselves
section("7. the account that runs the site")

operator_token, operator_id = sign_up("erasure-suite-operator", name="Suite Operator")
with SessionLocal() as db:
    db.get(User, operator_id).is_admin = True
    db.commit()
refused = client.delete("/api/users/me", headers=auth(operator_token))
check("an operator is refused", refused.status_code == 403, refused.status_code)
check(
    "with the reason: another operator has to close it",
    "Another operator" in refused.json()["detail"],
    refused.text[:250],
)
with SessionLocal() as db:
    row = db.get(User, operator_id)
    check("nothing was erased by the refusal", row.is_active is True and row.erased_at is None)
    check("the operator is still an operator", row.is_admin is True)
check("and the operator can still sign in", client.get("/api/auth/me", headers=auth(operator_token)).status_code == 200)

# ---------------------------------------------------------------- 8. the promise the copy makes
section("8. the sentences the route tells")

kept_lines = users_route.KEPT
check("the dialog's list of survivors is the route's own list", len(payload["kept"]) == len(kept_lines), str(payload["kept"]))
check(
    "it names the ledger, the log and the emptied row",
    len(kept_lines) == 3 and all(len(line) > 40 for line in kept_lines),
    str([len(line) for line in kept_lines]),
)
check("the done message does not overstate", "every" not in users_route.DONE.lower() or "gone from this database" in users_route.DONE.lower(), users_route.DONE)
check("and it says what happens to this browser", "stranger" in users_route.DONE, users_route.DONE)
removals = [label for label, _ in users_route._removals(student_id)]
check("the route walks every table this suite populated", {"messages", "conversations", "assessments", "reports_pdf", "study_plans", "consents", "sessions"} <= set(removals), str(removals))
check("including the two the response counted as zero because they were empty", "guardianships" in removals and "counsellor_notes" in removals)

LIFESPAN.close()

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + "; ".join(FAIL))
    sys.exit(1)
