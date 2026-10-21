"""The operator's own screen: what is happening on the site, and what may be changed.

One thing decides the shape of this whole file, and it is the brief's security line read
strictly: **`role=admin` is not what makes an account an operator.** The account's own
`role` column says only `student` or `parent` — what it is to its own family — and the
portal roles (`counsellor`, `school_admin`) live on a membership row inside one
organisation. The flag that makes an account run the site is `users.is_admin`, set by
`scripts/admin_grant.py` and readable by nothing else. Every route below is therefore
guarded by `get_admin_user`, which re-reads that column on each request.

Four rules the rest of the file is arranged around:

* **The guard is on the router, not in the routes.** `APIRouter(dependencies=...)` means a
  route cannot be added under this prefix without passing the check. That is a stronger
  position than the "add a middleware that blocks `/api/admin`" the brief asked for, and
  it is why no such middleware exists here. A path-prefix middleware sees a URL, not a
  verified caller: at that point the bearer token has not been looked up, so it would have
  to either resolve the session itself — a second copy of the auth logic, and the next
  person to change one forgets the other — or run before authentication and be a rule
  about strings that any request can satisfy. Middlewares in this app do presentation and
  provenance: which portal a page renders as (`middleware/tenant.py`), which bucket a call
  is counted in (`middleware/rate_limit.py`). Authorisation happens where the account is
  known. A test asserts this from the outside rather than trusting the sentence:
  `scripts/admin_test.py` calls every route in this file as an anonymous caller, as a
  student and as a parent, and requires 401 or 403 on each.
* **What an operator may see is a list, not a schema.** `AdminUserRowOut`,
  `AdminSummaryOut` and `AuditEventOut` in `app/schemas.py` hold no device id, no come-back
  code or hash, no token, no transcript and no answer value — those columns are absent from
  those models, so there is no field to hide later and forget. The *count* of a child's
  conversations is here; the conversations are not, and no query in this file reads
  `Message.content`. Reading one takes that account's own session, or the guardian route a
  parent was given.
* **Every change writes one log row, in the same transaction.** See
  `app/services/audit.py`. The log holds the action, the subject and which fields were
  touched — never the values, because the values include a student's name and a family's
  enquiry, and a log gets read by more people than those rows were meant for.
* **Nothing that spends money or makes a claim about a child is edited from here.** The
  question bank refuses an item that already has answers under it; a career entry can be
  corrected but its `needs_verification` flag is the catalogue's own statement that nobody
  has checked it; and this file neither reads nor can bypass the payment routes' rule that
  a plan which is not sellable is not purchasable.

Where the middleware layer does apply, in the two directions that are honest:
`middleware/rate_limit.py` gives the mutating routes their own bucket
(`RATE_LIMIT_ADMIN`, ten a minute) and puts every read — this screen's own numbers
included — in the shared `RATE_LIMIT_READ` bucket, which is sixty a minute per session and
therefore not a ceiling an operator reloading a dashboard will reach. CORS and the security
headers in `main.py` apply unchanged — an operator's fetch is a same-origin browser request
like any other, and a rule that exempted it would be a rule with an exception in it.

English only, like the portals: the Hindi dictionary covers the student's and the
family's product surfaces, and an operator's tables are not translated. The screens say so
rather than rendering half a sentence.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.exceptions import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..middleware.rate_limit import admin_limit
from ..models import (
    Assessment,
    AuditEvent,
    Career,
    ConversationSession,
    EmailJob,
    Membership,
    Message,
    Organization,
    PdfReport,
    Payment,
    Question,
    Response,
    Result,
    SessionNote,
    StudyLead,
    Subscription,
    User,
    utcnow,
)
from ..schemas import (
    AdminAccountStatusIn,
    AdminAssessmentMetricsOut,
    AdminBucketOut,
    AdminCareerIn,
    AdminCareerPageOut,
    AdminCareerRowOut,
    AdminChatMetricsOut,
    AdminContentMetricsOut,
    AdminDeploymentOut,
    AdminOperatorIn,
    AdminPortalMetricsOut,
    AdminQuestionIn,
    AdminQuestionPageOut,
    AdminQuestionRowOut,
    AdminRevenueMetricsOut,
    AdminSummaryOut,
    AdminUserMetricsOut,
    AdminUserPageOut,
    AdminUserRowOut,
    AuditEventOut,
    AuditPageOut,
)
from ..security import get_admin_user
from ..services import audit

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    # The one guard, applied where a route cannot forget it. `get_admin_user` runs
    # `get_current_user` first, so a token that belongs to nobody is a 401 and a closed
    # account is a 403 even with the flag still set on it.
    dependencies=[Depends(get_admin_user)],
)

log = logging.getLogger(__name__)


# --------------------------------------------------------------------- refusals
# Named constants, because a screen prints these sentences and a test asserts them, and
# both read better than a string buried in a branch.

NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail=(
        "There is no row at that address. An id copied from another screen, or a page "
        "reloaded since, is the usual reason."
    ),
)

LAST_OPERATOR = HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    detail=(
        "That is the last account with the flag on. Taking it would leave nobody able to "
        "open this screen, and the only way back in would be the database. Give it to "
        "somebody else first."
    ),
)

SELF_DEMOTE = HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    detail=(
        "You cannot take the flag off your own account while you are signed in to it. The "
        "person who should be able to undo that is the account you would just have "
        "demoted. Hand the site to somebody else, and let them close your access."
    ),
)

SELF_CLOSE = HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    detail=(
        "This is not how an account closes itself. All this route does is stop somebody "
        "signing in, and using it on yourself would leave a shut account holding the "
        "operator flag."
    ),
)

OPERATOR_ON_CLOSED = HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    detail=(
        "That account is closed, so the flag would be a key left in a locked door: it "
        "grants nothing while the account is shut, and it still reads as an operator to "
        "anybody counting the rows. Open the account first, if that is what you mean."
    ),
)

QUESTION_ANSWERED = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail=(
        "Somebody has already answered this question, so its wording is now part of a "
        "score that has been given to a child. Add an item with a new code and raise the "
        "bank version instead, so old sittings keep being read against the text they were "
        "answered under."
    ),
)

VERIFICATION_NOT_MINE = HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    detail=(
        "The verified flag is not editable here. It is the catalogue's statement that a "
        "person read a source for this entry, and a form that could switch it off would be "
        "this screen making that claim about work it has not seen. It is set where the "
        "reading happens — the seed files and the scripts that check them."
    ),
)

NOTHING_TO_CHANGE = HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    detail=(
        "The request carried no field to change. Nothing was written, and nothing was "
        "logged."
    ),
)


# ------------------------------------------------------------------------ shape


def _count(db: Session, stmt) -> int:
    return int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)


def _pages(db: Session, model, where=None) -> int:
    stmt = select(model)
    return _count(db, stmt.where(where) if where is not None else stmt)


def _paise(db: Session, where) -> int:
    """Money, in paise, with no float anywhere near it."""
    return int(
        db.scalar(
            select(func.coalesce(func.sum(Payment.amount_paise), 0)).where(where)
        )
        or 0
    )


def _days(n: int) -> datetime:
    return utcnow() - timedelta(days=n)


def _grouped(db: Session, stmt) -> dict:
    return {label: int(how_many) for label, how_many in db.execute(stmt)}


def _rows(db: Session, accounts: list[User]) -> list[AdminUserRowOut]:
    """The accounts as the operator sees them: what they are, how much they have used,
    nothing inside.

    Four grouped queries for the whole page rather than four per row. And none of them can
    return a value from a conversation — the only thing taken from `Message` and
    `Response` is a count, which is the difference between "this account has talked twice"
    and a platform operator being able to read a child.
    """
    if not accounts:
        return []
    ids = [account.id for account in accounts]

    conversations = _grouped(
        db,
        select(ConversationSession.student_id, func.count(ConversationSession.id))
        .where(ConversationSession.student_id.in_(ids))
        .group_by(ConversationSession.student_id),
    )
    started = _grouped(
        db,
        select(Assessment.user_id, func.count(Assessment.id))
        .where(Assessment.user_id.in_(ids))
        .group_by(Assessment.user_id),
    )
    completed = _grouped(
        db,
        select(Assessment.user_id, func.count(Assessment.id))
        .where(Assessment.user_id.in_(ids), Assessment.completed_at.is_not(None))
        .group_by(Assessment.user_id),
    )
    # Active places only. A school's unaccepted invitation is a row holding an address and
    # no person, and counting it would report a membership that does not exist yet.
    memberships = _grouped(
        db,
        select(Membership.user_id, func.count(Membership.id))
        .where(Membership.user_id.in_(ids), Membership.status == "active")
        .group_by(Membership.user_id),
    )
    plans = {
        user_id: subscription
        for user_id, subscription in db.execute(
            select(Subscription.user_id, Subscription).where(
                Subscription.user_id.in_(ids)
            )
        )
    }

    return [
        AdminUserRowOut(
            id=account.id,
            role=account.role,
            display_name=account.display_name,
            preferred_language=account.preferred_language,
            is_active=bool(account.is_active),
            is_admin=bool(account.is_admin),
            created_at=account.created_at,
            contact_email=account.contact_email,
            email_confirmed_at=account.email_confirmed_at,
            plan_code=(
                plans[account.id].plan_code if account.id in plans else "free"
            ),
            plan_expires_at=(
                plans[account.id].expires_at if account.id in plans else None
            ),
            conversations=conversations.get(account.id, 0),
            assessments=started.get(account.id, 0),
            assessments_completed=completed.get(account.id, 0),
            portal_memberships=memberships.get(account.id, 0),
        )
        for account in accounts
    ]


def _row(db: Session, account: User) -> AdminUserRowOut:
    return _rows(db, [account])[0]


# ------------------------------------------------------------------- the numbers


@router.get("/me")
def who(user: User = Depends(get_admin_user)) -> dict[str, bool]:
    """Is this the operator? One boolean, and the reason it is not in the token.

    Nothing else about the account comes back: the shell already knows who it signed in
    as, and an endpoint that also returned their email, plan and usage would be a second
    place for that data to leak from for no benefit. The flag is read from the database on
    every call, so revoking access takes effect on the next request rather than whenever a
    session happens to expire.
    """
    return {"is_admin": bool(user.is_admin)}


@router.get("/summary", response_model=AdminSummaryOut)
def summary(db: Session = Depends(get_db)) -> AdminSummaryOut:
    """The four numbers the brief named — people, conversations, sittings, money — plus
    what has grown around them since.

    Every figure is a count or a sum over rows that already exist, taken at this instant.
    There is no trend, growth rate or projection in here, deliberately: dividing two
    seven-day counts on a deployment with forty students produces a percentage with no
    meaning attached to it, and a number that looks like a forecast is how a demo becomes a
    promise.

    Two pairs are split rather than added, because a dashboard that mixed them would be
    reporting something untrue:

    * `demo_replies` / `real_replies` — a reply written by the canned script is not the
      work of a model, and the total alone cannot say which one happened.
    * `captured_paise` / `test_paise` — a payment made with a test key moved no money.
      Both come from `Payment.test_mode`, which is read off the key that made the payment
      rather than set by hand.
    """
    week = _days(7)
    now = utcnow()

    users = AdminUserMetricsOut(
        total=_pages(db, User),
        students=_pages(db, User, User.role == "student"),
        parents=_pages(db, User, User.role == "parent"),
        closed=_pages(db, User, User.is_active.is_(False)),
        operators=_pages(
            db, User, and_(User.is_admin.is_(True), User.is_active.is_(True))
        ),
        new_7d=_pages(db, User, User.created_at >= week),
        new_30d=_pages(db, User, User.created_at >= _days(30)),
    )

    assistant = Message.role == "assistant"
    chats = AdminChatMetricsOut(
        sessions=_pages(db, ConversationSession),
        chat_sessions=_pages(db, ConversationSession, ConversationSession.kind == "chat"),
        voice_sessions=_pages(
            db, ConversationSession, ConversationSession.kind == "voice"
        ),
        messages=_pages(db, Message),
        sessions_7d=_pages(
            db, ConversationSession, ConversationSession.created_at >= week
        ),
        messages_7d=_pages(db, Message, Message.created_at >= week),
        demo_replies=_pages(db, Message, and_(assistant, Message.demo_generated.is_(True))),
        real_replies=_pages(
            db, Message, and_(assistant, Message.demo_generated.is_(False))
        ),
    )

    finished = Assessment.completed_at.is_not(None)
    assessments = AdminAssessmentMetricsOut(
        started=_pages(db, Assessment),
        completed=_pages(db, Assessment, finished),
        in_progress=_pages(db, Assessment, Assessment.status == "in_progress"),
        results=_pages(db, Result),
        completed_7d=_pages(db, Assessment, and_(finished, Assessment.completed_at >= week)),
        pdf_reports=_pages(db, PdfReport),
        by_type=[
            AdminBucketOut(label=str(code), count=int(how_many))
            for code, how_many in db.execute(
                select(Assessment.assessment_type, func.count(Assessment.id)).group_by(
                    Assessment.assessment_type
                )
            )
        ],
    )

    captured = Payment.status == "captured"
    was_test = Payment.test_mode.is_(True)
    unexpired = or_(
        Subscription.expires_at.is_(None), Subscription.expires_at > now
    )
    revenue = AdminRevenueMetricsOut(
        captured_paise=_paise(db, and_(captured, was_test.is_(False))),
        captured_paise_30d=_paise(
            db, and_(captured, was_test.is_(False), Payment.captured_at >= _days(30))
        ),
        captured_orders=_pages(db, Payment, and_(captured, was_test.is_(False))),
        failed_orders=_pages(db, Payment, Payment.status == "failed"),
        refunded_paise=_paise(db, Payment.status == "refunded"),
        test_paise=_paise(db, and_(captured, was_test)),
        test_orders=_pages(db, Payment, and_(captured, was_test)),
        paying_accounts=_pages(
            db, Subscription, and_(Subscription.source == "payment", unexpired)
        ),
        granted_accounts=_pages(
            db, Subscription, and_(Subscription.source == "granted", unexpired)
        ),
        # The same `unexpired` as the two counts above it, because a bucket that counted
        # lapses would disagree with them on the same screen: a plan that ended last month
        # is not somebody's plan today, in either half of the block.
        by_plan=[
            AdminBucketOut(label=str(code), count=int(how_many))
            for code, how_many in db.execute(
                select(Subscription.plan_code, func.count(Subscription.user_id))
                .where(Subscription.plan_code != "free", unexpired)
                .group_by(Subscription.plan_code)
            )
        ],
    )

    portals = AdminPortalMetricsOut(
        organizations=_pages(db, Organization),
        schools=_pages(db, Organization, Organization.kind == "school"),
        practices=_pages(db, Organization, Organization.kind == "counsellor"),
        members_active=_pages(db, Membership, Membership.status == "active"),
        members_invited=_pages(db, Membership, Membership.status == "invited"),
        notes_shared=_pages(db, SessionNote, SessionNote.shared_with_family.is_(True)),
    )

    content = AdminContentMetricsOut(
        careers=_pages(db, Career),
        careers_to_verify=_pages(db, Career, Career.needs_verification.is_(True)),
        questions=_pages(db, Question),
        leads_open=_pages(db, StudyLead, StudyLead.status != "closed"),
        leads_total=_pages(db, StudyLead),
        email_queued=_pages(db, EmailJob, EmailJob.status == "pending"),
        email_failed=_pages(db, EmailJob, EmailJob.status == "failed"),
    )

    return AdminSummaryOut(
        generated_at=now,
        users=users,
        chats=chats,
        assessments=assessments,
        revenue=revenue,
        portals=portals,
        content=content,
    )


@router.get("/users", response_model=AdminUserPageOut)
def list_users(
    q: str | None = Query(default=None, max_length=80),
    role: str | None = Query(default=None, max_length=12),
    state: str | None = Query(default=None, max_length=8),
    flag: str | None = Query(default=None, max_length=8),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> AdminUserPageOut:
    """Find accounts. Newest first, paged, and never a way to read one.

    `q` matches a label, or an exact id when it is all digits. It does **not** match an
    email address, and that is the reason there is no email search on this screen: a list
    you can enumerate by address is a way to test which addresses have accounts here, which
    is the exact question the confirmation mail exists to keep private.

    `state` is `open` or `closed`, `flag` is `operator` or anything else. There is no sort
    by "who has talked most" or "whose scores are highest": an operator's useful question
    is about access and state, and the second of those is a claim about a child that this
    file has no business ranking.
    """
    stmt = select(User)
    needle = (q or "").strip()
    if needle:
        matches = [func.lower(User.display_name).like(f"%{needle.lower()}%")]
        if needle.isdigit():
            matches.append(User.id == int(needle))
        stmt = stmt.where(or_(*matches))
    if role in ("student", "parent"):
        stmt = stmt.where(User.role == role)
    if state == "open":
        stmt = stmt.where(User.is_active.is_(True))
    elif state == "closed":
        stmt = stmt.where(User.is_active.is_(False))
    if flag == "operator":
        stmt = stmt.where(User.is_admin.is_(True))

    total = _count(db, stmt)
    found = list(
        db.scalars(
            stmt.order_by(User.created_at.desc(), User.id.desc()).limit(limit).offset(offset)
        )
    )
    return AdminUserPageOut(
        total=total, limit=limit, offset=offset, items=_rows(db, found)
    )


@router.patch("/users/{user_id}/operator", response_model=AdminUserRowOut)
@admin_limit
def set_operator(
    request: Request,
    user_id: int,
    body: AdminOperatorIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminUserRowOut:
    """Hand the site to somebody else, or take it back.

    Three refusals, each against a failure that is easy to cause by accident from a screen
    like this:

    * **The flag cannot be removed from your own account** (`SELF_DEMOTE`). The account
      that would have to undo it is the one being demoted, and a deployment whose last
      operator demoted themselves is reachable only through the database — which is a
      recovery, not a workflow.
    * **It cannot be removed from the last open operator** (`LAST_OPERATOR`), so the site
      always has somebody who can open this screen.
    * **It cannot be granted to a closed account** (`OPERATOR_ON_CLOSED`). A flag on a shut
      account grants nothing, because `get_current_user` refuses the sign-in first, and it
      misleads the next person reading the row.

    An unchanged value writes no log row. A log of "nothing happened", repeated by every
    screen refresh that resubmits a form, is noise that buries the actions worth reading.
    """
    account = db.get(User, user_id)
    if account is None:
        raise NOT_FOUND
    wanted = body.is_admin

    if wanted == bool(account.is_admin):
        return _row(db, account)

    if not wanted:
        if account.id == actor.id:
            raise SELF_DEMOTE
        remaining = _pages(
            db,
            User,
            and_(
                User.is_admin.is_(True),
                User.is_active.is_(True),
                User.id != account.id,
            ),
        )
        if remaining == 0:
            raise LAST_OPERATOR
    elif not account.is_active:
        raise OPERATOR_ON_CLOSED

    account.is_admin = wanted
    audit.record(
        db,
        actor,
        "user.admin_grant" if wanted else "user.admin_revoke",
        subject_type="user",
        subject_id=account.id,
        # The action and the target, and nothing about either beyond that.
        detail=f"is_admin -> {str(wanted).lower()}",
    )
    db.commit()
    db.refresh(account)
    log.info("admin: user %s operator flag set to %s", account.id, wanted)
    return _row(db, account)


@router.patch("/users/{user_id}/status", response_model=AdminUserRowOut)
@admin_limit
def set_account_status(
    request: Request,
    user_id: int,
    body: AdminAccountStatusIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminUserRowOut:
    """Open or close an account, which is the whole extent of what may be done to one here.

    Closing takes effect on the next request rather than at token expiry: `get_current_user`
    reads `is_active` from the database, so a bearer string that still exists stops being
    enough.

    What this does **not** do, stated because a screen with a button called "disable" invites
    the opposite assumption:

    * It deletes nothing. The account's conversations, sittings, results and printed reports
      stay exactly where they are, and reopening the account returns to them. Erasure is not
      a thing this route can do, and there is no operator-facing endpoint in this app that
      erases a person's rows — a request to remove somebody's data is handled outside this
      screen, by whoever runs the deployment, and `README` says so rather than implying a
      button.
    * It does not touch what a guardian was allowed to see. Guardianships and sharing
      switches are the family's own, and a closed account's shared report stays shared until
      somebody with a right to it unshares it.
    * It cannot be used on your own account (`SELF_CLOSE`), for the reason in the sentence:
      the shut account would still be holding the flag.
    * Closing the last open operator is refused (`LAST_OPERATOR`), which is the same lockout
      as demoting them.
    """
    account = db.get(User, user_id)
    if account is None:
        raise NOT_FOUND
    wanted = body.is_active

    if wanted == bool(account.is_active):
        return _row(db, account)

    if not wanted:
        if account.id == actor.id:
            raise SELF_CLOSE
        if account.is_admin:
            remaining = _pages(
                db,
                User,
                and_(
                    User.is_admin.is_(True),
                    User.is_active.is_(True),
                    User.id != account.id,
                ),
            )
            if remaining == 0:
                raise LAST_OPERATOR

    account.is_active = wanted
    audit.record(
        db,
        actor,
        "user.status",
        subject_type="user",
        subject_id=account.id,
        detail=f"is_active -> {str(wanted).lower()}",
    )
    db.commit()
    db.refresh(account)
    log.info("admin: user %s active=%s", account.id, wanted)
    return _row(db, account)


# ---------------------------------------------------------------------- content


def _question_row(question: Question, answers: int) -> AdminQuestionRowOut:
    """One bank item, and the count that decides whether it may be edited.

    `answers` is passed in rather than looked up here, because the list page gets all of
    them in one grouped query and the single-row routes know it already.
    """
    return AdminQuestionRowOut(
        id=question.id,
        assessment_type=question.assessment_type,
        code=question.code,
        dimension=question.dimension,
        order=question.order,
        response_type=question.response_type,
        keyed=question.keyed,
        text_en=question.text_en,
        text_hi=question.text_hi,
        options=list(question.options_json or []),
        correct_value=question.correct_value,
        answers=answers,
        editable=answers == 0,
    )


@router.get("/content/careers", response_model=AdminCareerPageOut)
def list_careers(
    q: str | None = Query(default=None, max_length=80),
    category: str | None = Query(default=None, max_length=64),
    to_verify: bool | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> AdminCareerPageOut:
    """The career catalogue as it is stored, newest edits aside.

    `to_verify=true` is the working view, and the reason this screen exists: every entry
    carries the flag the seed set, and the honest task is to clear it row by row against a
    real source rather than to add rows. Sorting is by category then title rather than by
    popularity, because popularity is a fact about children and this list is a fact about
    the catalogue.
    """
    stmt = select(Career)
    needle = (q or "").strip()
    if needle:
        pattern = f"%{needle.lower()}%"
        stmt = stmt.where(
            or_(func.lower(Career.title).like(pattern), func.lower(Career.slug).like(pattern))
        )
    if category:
        stmt = stmt.where(Career.category == category)
    if to_verify is not None:
        stmt = stmt.where(Career.needs_verification.is_(to_verify))

    total = _count(db, stmt)
    found = list(
        db.scalars(stmt.order_by(Career.category, Career.title).limit(limit).offset(offset))
    )
    return AdminCareerPageOut(
        total=total,
        limit=limit,
        offset=offset,
        items=[AdminCareerRowOut.model_validate(row) for row in found],
    )


CAREER_FIELDS = (
    "title",
    "category",
    "summary",
    "typical_activities",
    "useful_skills",
    "school_subjects",
    "education_pathways",
    "entry_requirements",
    "preparation_stages",
    "typical_day",
    "costs_and_alternatives",
    "benefits",
    "challenges",
    "explore_activities",
    "official_links",
    "related_slugs",
    "interest_themes",
    "min_class",
    "needs_verification",
)


@router.patch("/content/careers/{slug}", response_model=AdminCareerRowOut)
@admin_limit
def update_career(
    request: Request,
    slug: str,
    body: AdminCareerIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminCareerRowOut:
    """Correct a career entry that a child may be reading right now.

    `slug` is not editable and not in the body: it is the address in somebody's saved list
    and in a report that has already been printed, so a rename would break a link a family
    kept. A wrong slug is corrected by editing the row.

    `needs_verification` is refused in both directions (`VERIFICATION_NOT_MINE`), for the
    reason written there: this screen has not read a source, and a flag meaning "somebody
    checked" that a form can set is a flag that means nothing.

    The log entry names the fields that changed and not their new values, which is the
    difference between "the summary was corrected on 14 October" and a log that contains a
    copy of the site's content.
    """
    career = db.scalar(select(Career).where(Career.slug == slug))
    if career is None:
        raise NOT_FOUND

    payload = body.model_dump(exclude_unset=True, exclude_none=True)
    if "needs_verification" in payload:
        raise VERIFICATION_NOT_MINE
    if not payload:
        raise NOTHING_TO_CHANGE

    for field, value in payload.items():
        setattr(career, field, value)

    audit.record(
        db,
        actor,
        "career.update",
        subject_type="career",
        subject_id=career.slug,
        detail="changed: " + ", ".join(sorted(payload)),
    )
    db.commit()
    db.refresh(career)
    log.info("admin: career %s updated (%d fields)", career.slug, len(payload))
    return AdminCareerRowOut.model_validate(career)


@router.get("/content/questions", response_model=AdminQuestionPageOut)
def list_questions(
    assessment_type: str | None = Query(default=None, max_length=16),
    dimension: str | None = Query(default=None, max_length=24),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> AdminQuestionPageOut:
    """The bank, with the number of answers each item already carries.

    That count is not decoration — it is the evidence for the immutability rule in the next
    route, shown on the row so the refusal is visible before somebody types an edit. An item
    with answers under it is part of a score that has been handed to a child.
    """
    stmt = select(Question)
    if assessment_type:
        stmt = stmt.where(Question.assessment_type == assessment_type)
    if dimension:
        stmt = stmt.where(Question.dimension == dimension)

    total = _count(db, stmt)
    found = list(
        db.scalars(stmt.order_by(Question.assessment_type, Question.order, Question.code).limit(limit).offset(offset))
    )
    codes = {row.code for row in found}
    answered: dict[tuple[str, str], int] = {}
    if codes:
        for atype, code, how_many in db.execute(
            select(Assessment.assessment_type, Response.code, func.count(Response.id))
            .join(Response, Response.assessment_id == Assessment.id)
            .where(Response.code.in_(codes))
            .group_by(Assessment.assessment_type, Response.code)
        ):
            answered[(atype, code)] = int(how_many)

    items = [
        _question_row(
            row, answered.get((row.assessment_type, row.code), 0)
        )
        for row in found
    ]
    return AdminQuestionPageOut(
        total=total, limit=limit, offset=offset, items=items
    )


@router.patch("/content/questions/{question_id}", response_model=AdminQuestionRowOut)
@admin_limit
def update_question(
    request: Request,
    question_id: int,
    body: AdminQuestionIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminQuestionRowOut:
    """Reword an item nobody has answered. An item somebody has, refused (409).

    The rule and its reason are in `QUESTION_ANSWERED`, and the reason it is a hard refusal
    rather than a warning is what a score is used for. `Assessment.bank_version` exists so a
    stored answer set is still readable after the bank moves on; editing an answered item in
    place would leave that column pointing at text nobody was ever shown, and a result page
    would then be describing a questionnaire the student did not sit.

    The log names the fields, never the new wording: the wording of an item is public
    catalogue text anyway, but a log that stores edited content is a log that trains people
    to store it.
    """
    question = db.get(Question, question_id)
    if question is None:
        raise NOT_FOUND

    answered = int(
        db.scalar(
            select(func.count(Response.id))
            .join(Assessment, Assessment.id == Response.assessment_id)
            .where(
                Response.code == question.code,
                Assessment.assessment_type == question.assessment_type,
            )
        )
        or 0
    )
    if answered:
        raise QUESTION_ANSWERED

    payload = body.model_dump(exclude_unset=True, exclude_none=True)
    if not payload:
        raise NOTHING_TO_CHANGE
    for field, value in payload.items():
        setattr(question, "options_json" if field == "options" else field, value)

    audit.record(
        db,
        actor,
        "question.update",
        subject_type="question",
        subject_id=question.code,
        detail="changed: " + ", ".join(sorted(payload)),
    )
    db.commit()
    db.refresh(question)
    log.info("admin: question %s updated", question.code)
    return _question_row(question, 0)


@router.get("/content/blog")
def blog_status() -> dict[str, object]:
    """Why there is no blog editor here, in the API's own words.

    A post is a markdown file in this repository at `frontend/src/content/blog/`, rendered
    by the same deploy that serves the site. This backend has no copy of that filesystem, no
    writable persistent disk, and no route that could publish a page — so there is nothing to
    build a form against. The honest version of "manage blog" is this response: the fact, the
    path, and the way a post actually gets published. A screen with a Save button that
    discarded the text would be the worse product, and the standing rule of this repository is
    that an unimplemented feature is labelled, not pretended at.
    """
    return {
        "editable_here": False,
        "where": "frontend/src/content/blog/",
        "how": "a commit and a deploy",
        "note": (
            "Posts are files next to the code that renders them. This API cannot read or "
            "write that directory, so there is no editor on the admin screens."
        ),
    }


# -------------------------------------------------------------------------- audit


@router.get("/audit", response_model=AuditPageOut)
def list_audit(
    action: str | None = Query(default=None, max_length=48),
    actor: int | None = Query(default=None, ge=1),
    since: datetime | None = None,
    until: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> AuditPageOut:
    """Read the operator log. Newest first, filterable, and append-only.

    There is no delete and no edit anywhere in this file, and that is the point: the person
    who would want an action removed from the log is the person with the keys to remove it.
    The screen shows this list rather than a "clear" button, and a correction is made by
    writing the action that undoes it — which then appears here too.

    Rows never contain a value that was written, only the name of what changed, and never a
    conversation: see `app/models.py::AuditEvent` and `app/services/audit.py`.
    """
    stmt = select(AuditEvent)
    if action:
        stmt = stmt.where(AuditEvent.action == action)
    if actor:
        stmt = stmt.where(AuditEvent.actor_user_id == actor)
    if since is not None:
        stmt = stmt.where(AuditEvent.created_at >= since)
    if until is not None:
        stmt = stmt.where(AuditEvent.created_at <= until)

    total = _count(db, stmt)
    found = list(
        db.scalars(stmt.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).limit(limit).offset(offset))
    )
    actions = sorted(
        {str(name) for (name,) in db.execute(select(AuditEvent.action).distinct())}
    )
    return AuditPageOut(
        total=total,
        limit=limit,
        offset=offset,
        items=[AuditEventOut.model_validate(row) for row in found],
        actions=actions,
    )


# --------------------------------------------------------------------- deployment


@router.get("/deployment", response_model=AdminDeploymentOut)
def deployment() -> AdminDeploymentOut:
    """What this process is running on, with no secret in it.

    Read field by field from a whitelist for a reason: `Settings` also holds the AI,
    Razorpay, Clerk, Gemini and Resend keys, and an endpoint that walked its attributes
    would put five live credentials into a JSON response a browser keeps in its history. So
    presence is a boolean and a key is never sent — not truncated, not fingerprinted, because
    the last four characters of a secret are still a way to recognise it.

    Nothing here can be changed by a request, and that is not laziness. These values come
    from the environment of the process answering this call; a route that "saved" one would
    either write to a file the hosting platform owns or pretend to have changed something it
    did not. Each screen instead names the variable and the command that does the job, so the
    control that is missing is missing visibly rather than present and dead.
    """
    s = get_settings()
    # The scheme is read off the URL rather than matched against three fixed strings.
    # A driver-specific address — `postgresql+psycopg://`, which is what this stack
    # actually ships — is not `postgresql://`, so a `startswith` test on the plain name
    # left a Postgres installation reporting itself as SQLite on the one screen whose
    # only job is to say which database is running. The driver suffix is dropped, and
    # the file path is never included: the URL holds a password.
    scheme = s.database_url.split("://", 1)[0] if "://" in s.database_url else ""
    engine = scheme.split("+", 1)[0].strip().lower() or "not configured"
    return AdminDeploymentOut(
        app_name=s.app_name,
        ai_provider=s.ai_provider,
        ai_model=s.ai_model,
        ai_configured=s.ai_configured,
        tts_provider=s.tts_provider,
        gemini_tts_model=s.gemini_tts_model,
        azure_speech_region=s.azure_speech_region,
        has_gemini_key=bool(s.gemini_api_key.strip()),
        has_azure_key=bool(s.azure_speech_key.strip()),
        has_clerk_key=bool(s.clerk_secret_key.strip()),
        has_clerk_webhook_secret=bool(s.clerk_webhook_signing_secret.strip()),
        has_resend_key=bool(s.resend_api_key.strip()),
        email_enabled=s.email_enabled,
        from_email=s.from_email or None,
        lead_notify_email=s.lead_notify_email or None,
        razorpay_configured=s.razorpay_configured,
        webhook_verifiable=s.webhook_verifiable,
        razorpay_test_mode=s.razorpay_test_mode,
        cors_origins=[origin.strip() for origin in s.cors_origins.split(",") if origin.strip()],
        public_site_url=s.public_site_url,
        public_repo_url=s.public_repo_url,
        tenant_base_domain=s.tenant_base_domain,
        tenant_trust_forwarded_host=s.tenant_trust_forwarded_host,
        rate_limit_trust_forwarded_for=s.rate_limit_trust_forwarded_for,
        rate_limit_enabled=s.rate_limit_enabled,
        rate_limit_read=s.rate_limit_read,
        rate_limit_admin=s.rate_limit_admin,
        rate_limit_lead=s.rate_limit_lead,
        rate_limit_org=s.rate_limit_org,
        rate_limit_shared_storage=bool(s.rate_limit_redis_url.strip()),
        database_engine=engine,
        db_auto_setup=s.db_auto_setup,
        plan_limits_enforced=s.plan_limits_enforced,
        free_daily_chats=s.free_daily_chats,
        free_assessment_total=s.free_assessment_total,
        quota_utc_offset_minutes=s.quota_utc_offset_minutes,
    )
