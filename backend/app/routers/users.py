"""Deleting an account: `DELETE /api/users/me`.

The person using the app has never typed a password, so this route is the only way they
can ask for their record to be taken back. It does that by **erasing and then anonymising**
rather than by dropping the row, and the difference matters:

* Everything that describes this person is deleted — every conversation and message, the
  assessments they took and the answers they gave, their results, the career reports and
  the PDFs printed from them, saved careers, recommendations, study plans and every
  item inside them, journey
  entries, interest observations, their profile, their settings, every consent they gave,
  the guardian links on either side, their seats in a school or counsellor's portal, and
  the mail still waiting to be sent about them.
* Every session ends: all of the account's tokens are revoked, not only the one that made
  the request, so a phone that signed in last week is signed out too.
* What is left is a row with nothing in it but a date. `payments` and `subscriptions`
  keep pointing at that row, because a money ledger that the payer can delete is not a
  ledger, and `audit_events` keeps its rows for the same reason. Deleting the user row
  would cascade both away — that is what the `ondelete="CASCADE"` on those two tables
  says — so the row stays and stops being a person.

Nothing here is a legal claim. DPDP and every other framework want erasure on request, and
this route does the technical part; whether the deployment as a whole is compliant depends
on things a route cannot do, which is why the privacy page describes this as what the app
does rather than as what the law requires.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.exceptions import HTTPException
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.rate_limit import auth_limit
from ..models import (
    Assessment,
    AuthToken,
    CareerReport,
    ConsentRecord,
    ConversationSession,
    EmailJob,
    Guardianship,
    InterestObservation,
    JourneyEvent,
    Membership,
    Message,
    PdfReport,
    Recommendation,
    Response as Answer,
    Result,
    SavedCareer,
    SessionNote,
    StudentProfile,
    StudyPlan,
    StudyPlanItem,
    User,
    UserSettings,
)
from ..schemas import ErasureOut
from ..security import clear_session_cookie, get_current_user, get_raw_token
from ..services import audit

router = APIRouter(prefix="/api/users", tags=["users"])

log = logging.getLogger(__name__)

OPERATOR_ACCOUNT = (
    "This account runs the site, so it cannot be erased from inside itself. Another "
    "operator has to close it from the admin screen first — that way the log keeps "
    "saying who stopped being able to change things."
)
ALREADY_ERASED = (
    "This account has already been erased. There is nothing here left to remove, and "
    "nothing that can bring any of it back."
)
DONE = (
    "Your account is erased. The conversations, assessments, reports and settings that "
    "were on it are gone from this database, and this browser is a stranger again."
)

# What stays, in the words a person is shown. Naming the survivors is the part of an
# erasure answer that makes the rest of it believable.
KEPT = [
    "The record of any payment you made or were refunded, which a money ledger has to "
    "keep even after the person it is about asks to be forgotten.",
    "The log of actions taken on the site. Yours is kept without your name on it.",
    "The row that used to be your account, holding nothing but the date it was erased on.",
]

# (label, statement) in the order that leaves each count honest: a child row is deleted
# before the parent that would otherwise cascade it away, so the number reported is the
# one this route removed rather than one a database trigger quietly took.
def _removals(user_id: int) -> list[tuple[str, object]]:
    sessions = select(ConversationSession.id).where(ConversationSession.student_id == user_id)
    assessments = select(Assessment.id).where(Assessment.user_id == user_id)
    return [
        ("messages", delete(Message).where(Message.session_id.in_(sessions))),
        ("conversations", delete(ConversationSession).where(ConversationSession.student_id == user_id)),
        ("reports_pdf", delete(PdfReport).where(PdfReport.student_id == user_id)),
        ("assessment_results", delete(Result).where(Result.user_id == user_id)),
        ("assessment_answers", delete(Answer).where(Answer.assessment_id.in_(assessments))),
        ("assessments", delete(Assessment).where(Assessment.user_id == user_id)),
        ("career_reports", delete(CareerReport).where(CareerReport.student_id == user_id)),
        ("saved_careers", delete(SavedCareer).where(SavedCareer.student_id == user_id)),
        ("recommendations", delete(Recommendation).where(Recommendation.student_id == user_id)),
        # The items are a plan's own rows, and they say what the student meant to study.
        # Deleting them here rather than letting the database cascade keeps the count in the
        # answer the number this route removed — and works on a SQLite database, where
        # `ondelete` is in the schema but not switched on.
        (
            "study_plan_items",
            delete(StudyPlanItem).where(
                StudyPlanItem.plan_id.in_(
                    select(StudyPlan.id).where(StudyPlan.student_id == user_id)
                )
            ),
        ),
        ("study_plans", delete(StudyPlan).where(StudyPlan.student_id == user_id)),
        ("journey_events", delete(JourneyEvent).where(JourneyEvent.student_id == user_id)),
        ("interest_observations", delete(InterestObservation).where(InterestObservation.student_id == user_id)),
        ("profile", delete(StudentProfile).where(StudentProfile.user_id == user_id)),
        ("settings", delete(UserSettings).where(UserSettings.user_id == user_id)),
        ("consents", delete(ConsentRecord).where(ConsentRecord.user_id == user_id)),
        # A counsellor's note about this person is a record of them, written under the seat
        # they held. Deleting it goes with deleting the seat, and it is counted separately
        # because it is the one row here that somebody else typed and somebody else loses.
        (
            "counsellor_notes",
            delete(SessionNote).where(
                SessionNote.client_membership_id.in_(
                    select(Membership.id).where(Membership.user_id == user_id)
                )
            ),
        ),
        # Both directions: a parent erasing removes the link to every child they could
        # see, and a student erasing removes the link a guardian was using.
        (
            "guardianships",
            delete(Guardianship).where(
                or_(Guardianship.parent_id == user_id, Guardianship.student_id == user_id)
            ),
        ),
        ("memberships", delete(Membership).where(Membership.user_id == user_id)),
        # A queued mail holds a rendered body with a child's name and results in it.
        ("queued_emails", delete(EmailJob).where(EmailJob.user_id == user_id)),
        # Every device this account was open on, not only the one asking.
        ("sessions", delete(AuthToken).where(AuthToken.user_id == user_id)),
    ]


@router.delete("/me", response_model=ErasureOut)
@auth_limit
def erase_account(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    token: str = Depends(get_raw_token),
    db: Session = Depends(get_db),
) -> ErasureOut:
    """Erase the account this request is signed in to, and end every session on it.

    There is no body and no confirmation token, and that is a consequence of how signing in
    works here rather than a shortcut: this app asks for no password or email address, so
    the only thing proving this is the account's own device is the session it arrived with.
    Which is why the screen behind this call has to be the thing that stops a child pressing
    it by accident. A second call cannot repeat the erasure: the account is closed and its
    tokens are gone, so it never reaches this function — the 410 below is for the narrower
    case of a credential that is still valid against an already-erased row.

    The operator guard is here rather than only in the admin screen's "close account",
    because an erased operator would leave their own actions in the log attributed to a row
    that stopped existing — and the log is the reason that log is worth reading.
    """
    if user.erased_at is not None:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail=ALREADY_ERASED)
    if user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=OPERATOR_ACCOUNT)

    now = datetime.now(timezone.utc)
    removed: dict[str, int] = {}
    for label, statement in _removals(user.id):
        removed[label] = int(db.execute(statement).rowcount or 0)

    # Logged before the row is cleared, and committed with it, so an erasure and its entry
    # in the operator log either both happened or neither did. The name is dropped from the
    # entry deliberately: keeping the name this action exists to remove would be the log
    # undoing the erasure.
    event = audit.record(
        db,
        user,
        "user.erase",
        subject_type="user",
        subject_id=user.id,
        detail=f"erased {sum(removed.values())} rows; row kept, name and address cleared",
    )
    event.actor_name = None

    user.role = "erased"
    user.display_name = ""
    user.is_active = False
    # The three ways back in, all removed. Without the device digest this browser is a
    # stranger again, which is the point: a new visit from it makes a new account rather
    # than finding this one.
    user.device_hash = None
    user.comeback_index = None
    user.comeback_hash = None
    user.contact_email = None
    user.email_confirm_hash = None
    user.email_confirm_expires_at = None
    user.email_confirmed_at = None
    user.clerk_user_id = None
    user.clerk_linked_at = None
    user.is_admin = False
    user.erased_at = now
    db.commit()

    # The cookie goes last: the response is what tells this browser to stop offering the
    # credential it has been sending, and the server has already deleted its half.
    clear_session_cookie(request, response)
    log.info(
        "Account %s erased (%s rows removed)", user.id, sum(removed.values())
    )
    return ErasureOut(erased_at=now, removed=removed, kept=KEPT, message=DONE)
