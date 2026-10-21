"""The outbox: a message as a row, and the one loop that turns rows into mail.

Serverless hosting has no worker, no queue and no clock — between two requests
nothing runs at all, and a process that outlives one HTTP call is not something this
deployment can promise. So a non-critical message is written as an `EmailJob` row in
the request that decided to send it, tried once immediately in that same request, and
tried again by whoever next drains the queue: another request, or
`scripts/email_worker.py` on a host that has a scheduler.

The limit is real and stated in the README rather than hidden in a comment: on a
deployment where nobody arrives and nothing is scheduled, a queued message waits.
That is the trade this design makes against the alternative of holding a conversation
turn open while a third-party mailbox is being contacted.

Two rules do most of the work here:

* **A row is a pointer, never a copy.** The address comes from the account at send
  time, so deleting an address stops a queued message immediately; and a digest whose
  week produced nothing is closed as `skipped` rather than mailed, because "you did
  none of this" is a report about a child's absence that nobody asked for.
* **`disabled` is not a failure.** With no key set, a row stays pending and its
  attempt count does not move: the day somebody adds `RESEND_API_KEY`, the queue that
  built up sends itself. A refusal from the provider is the opposite — four of those
  and the row is left failed, because a mailbox that has refused an address four times
  is not going to start accepting it, and every further retry is a paid call about a
  person who cannot get their message.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import EmailJob, User
from . import email_messages
from . import email_consent as consent

# What a row is allowed to be about, and which message that purpose renders. Two
# names for one concept would be a bug waiting to drift; this dictionary is the whole
# mapping and both `enqueue` and `attempt` read through it.
#
# The first two keys are consent scopes, which is no accident: a queued purpose is
# exactly a message somebody agreed to in advance, so the row and the agreement share
# a name. `receipt` is the exception and needs explaining — a proof of payment needs
# no consent scope (see `email_consent`), but it does need the queue's other two
# services: a provider that is unreachable at the moment of capture gets retried, and
# the unique index means the browser's callback and Razorpay's webhook for the same
# order can only ever produce one receipt, never two.
QUEUED = {
    "email_result": "result",
    "email_digest": "digest",
    "receipt": "receipt",
}

RETRY_MINUTES = 15

PENDING = "pending"
SENT = "sent"
FAILED = "failed"
STALE = "stale"
SKIPPED = "skipped"

# Answers that mean "this row will never become a message", so it is closed instead of
# retried. `disabled` is deliberately absent: see the module docstring.
CLOSED = ("not-agreed", "no-address", "closed", "nothing-to-say", "invalid-address")

# Two of those refusals are the account's to undo: agreeing later, or confirming an
# address later, change the facts the row was judged on. So when somebody asks for the
# same message again, a row closed for one of these reasons is reopened rather than
# reported as a permanent "no". The others are not reopenable — a week with nothing in
# it stays empty, and a row the provider has refused stays refused.
REOPENABLE = ("not-agreed", "no-address")


@dataclass
class Report:
    """What one drain did, in counts a worker can print and a test can assert on."""

    attempted: int = 0
    sent: int = 0
    skipped: int = 0
    staled: int = 0
    failed: int = 0
    waiting: int = 0
    created: list[int] = field(default_factory=list)

    def as_dict(self) -> dict[str, object]:
        return {
            "attempted": self.attempted,
            "sent": self.sent,
            "skipped": self.skipped,
            "staled": self.staled,
            "failed": self.failed,
            "waiting": self.waiting,
            "created": len(self.created),
        }


def enqueue(
    db: Session,
    user_id: int,
    purpose: str,
    *,
    ref_id: int | None = None,
    ref_key: str | None = None,
    now: datetime | None = None,
) -> EmailJob | None:
    """Write one row, or return the one that already exists.

    Idempotency lives here rather than in each caller because every caller gets it
    wrong in a different way: a student who double-taps submit, a webhook delivered
    twice, a digest created by two requests that arrived in the same minute. Two
    partial unique indexes (`ux_email_jobs_ref` for a row that names a result or a
    payment, `ux_email_jobs_week` for a row that names a week) refuse the duplicate at
    the database, and this check is what turns that refusal into a boring answer
    instead of an IntegrityError — and what still guards a row whose pointer columns
    are both empty, which no unique index can refuse on either engine.

    One exception: a row closed because the account had not agreed yet, or had no
    usable address, is a refusal the account can undo. When the same message is asked
    for again after that, the row is reopened rather than returned as a permanent "no"
    — see `REOPENABLE`. A week's digest is only ever asked for by the worker once that
    week has closed, and a week with nothing in it closes as `nothing-to-say`, which is
    not reopenable, so this cannot bring a finished week back to life.
    """
    if purpose not in QUEUED:
        raise ValueError(f"{purpose} is not a queued purpose")
    moment = now or datetime.now(timezone.utc)
    clause = [EmailJob.user_id == user_id, EmailJob.purpose == purpose]
    # NULL is a value of its own here, not a wildcard: a result row and a digest row
    # must not match each other because neither filled the other's column in.
    clause.append(EmailJob.ref_id == ref_id if ref_id is not None else EmailJob.ref_id.is_(None))
    clause.append(
        EmailJob.ref_key == ref_key if ref_key is not None else EmailJob.ref_key.is_(None)
    )
    existing = db.scalars(select(EmailJob).where(*clause).limit(1)).first()
    if existing is not None:
        if existing.status == SKIPPED and existing.detail in REOPENABLE:
            # Asked for again, and the reason it was refused is one the account has
            # since undone. The same row is reused rather than a second one written,
            # because the unique index would refuse it anyway and a second row would
            # mean the person gets the message twice if the first ever wakes up.
            existing.status = PENDING
            existing.detail = None
            existing.attempts = 0
            existing.next_attempt_at = moment
            db.commit()
            db.refresh(existing)
        return existing
    job = EmailJob(user_id=user_id, purpose=purpose, ref_id=ref_id, ref_key=ref_key)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def due_monday(now: datetime) -> date:
    """The Monday of the newest week that has actually ended.

    A summary is only ever about a finished week: a range still in progress would
    report a Tuesday's work as a whole week and then refuse to send again until the
    next Monday.
    """
    offset = timezone(timedelta(minutes=get_settings().quota_utc_offset_minutes))
    local = now.astimezone(offset).date()
    this_monday = local - timedelta(days=local.weekday())
    return this_monday - timedelta(days=7)


def create_due_digests(db: Session, now: datetime) -> list[int]:
    """Queue the weekly summary for every account that asked for it.

    There is no cron on this host, so the interval is measured against the last row
    rather than a schedule: whoever first drains the queue after a week ends is what
    makes the digest arrive. One week per account, decided by a single query —
    `due_monday` returns the newest week that has fully closed, and the same Monday
    is the newest for every account at a given moment, so "already has a row for this
    week" is the whole of the deduping.

    An account that agreed and then produced nothing still gets a row, which closes
    as `skipped` at drain time rather than mailing: the decision to stay silent is
    made with the counts in hand, not guessed here from a timestamp.
    """
    target = due_monday(now)
    week_start, week_end = email_messages.week_bounds(target)
    already = select(EmailJob.user_id).where(
        EmailJob.purpose == "email_digest", EmailJob.ref_key == target.isoformat()
    )
    accounts = list(
        db.scalars(
            select(User).where(
                User.is_active.is_(True),
                User.email_confirmed_at.is_not(None),
                User.id.not_in(already),
                # An account created after the week it would summarise ended has no
                # week to summarise. Its first digest waits for a whole one.
                User.created_at < week_end,
            )
        )
    )
    created: list[int] = []
    for user in accounts:
        if not consent.consented(db, user, "email_digest"):
            continue
        if user.created_at is not None and user.created_at >= week_start:
            # Created in the middle of the week: the counts would describe a week the
            # account only partly lived, and the next one will describe it properly.
            continue
        job = enqueue(db, user.id, "email_digest", ref_key=target.isoformat())
        if job is not None and job.created_at is not None and job.status == PENDING:
            created.append(job.id)
    return created


def _close(job: EmailJob, status: str, detail: str | None, now: datetime) -> None:
    job.status = status
    job.detail = detail[:60] if detail else None
    job.sent_at = now if status == SENT else None


def attempt(db: Session, job: EmailJob, now: datetime) -> str:
    """One send, one write. Returns the row's new status."""
    if job.status != PENDING:
        return job.status
    user = db.get(User, job.user_id)
    if user is None:
        # The account is gone, and the row went with it by cascade on a real
        # delete; this branch is the one where a drain raced the deletion.
        _close(job, SKIPPED, "no-account", now)
        db.commit()
        return job.status
    kind = QUEUED.get(job.purpose)
    if kind is None:
        _close(job, SKIPPED, "unknown-purpose", now)
        db.commit()
        return job.status

    answer = email_messages.send(db, user, kind, ref_id=job.ref_id, ref_key=job.ref_key)
    if answer.delivered:
        _close(job, SENT, None, now)
        job.next_attempt_at = now
    elif answer.reason in CLOSED:
        job.attempts += 1
        _close(job, SKIPPED, answer.reason, now)
    elif answer.reason == "disabled":
        # Not charged as an attempt: a deployment that has not been configured yet
        # is not the address's fault, and the row should still be alive the day a
        # key appears.
        job.detail = "disabled"
        job.next_attempt_at = now + timedelta(minutes=RETRY_MINUTES)
    else:
        job.attempts += 1
        limit = get_settings().email_jobs_max_attempts
        if job.attempts >= limit:
            _close(job, FAILED, answer.reason, now)
        else:
            job.detail = answer.reason[:60]
            job.next_attempt_at = now + timedelta(minutes=RETRY_MINUTES * job.attempts)
    db.commit()
    return job.status


def drain(db: Session, *, limit: int = 20, now: datetime | None = None) -> Report:
    """Send what is waiting, and queue any weekly summary whose week has closed.

    Called after anything is enqueued, by the email routes when the account screen is
    opened, and by `scripts/email_worker.py`. It writes no state of its own beyond the
    rows it touched, so two drains running at the same moment are only ever redundant.
    """
    moment = now or datetime.now(timezone.utc)
    report = Report()

    stale_after = timedelta(hours=get_settings().email_stale_after_hours)
    for job in db.scalars(
        select(EmailJob).where(
            EmailJob.status == PENDING, EmailJob.created_at < moment - stale_after
        )
    ):
        _close(job, STALE, "too-old", moment)
        report.staled += 1
    db.commit()

    report.created = create_due_digests(db, moment)

    rows = list(
        db.scalars(
            select(EmailJob)
            .where(EmailJob.status == PENDING, EmailJob.next_attempt_at <= moment)
            .order_by(EmailJob.id)
            .limit(limit)
        )
    )
    for job in rows:
        report.attempted += 1
        status = attempt(db, job, moment)
        if status == SENT:
            report.sent += 1
        elif status == SKIPPED:
            report.skipped += 1
        elif status == FAILED:
            report.failed += 1
        else:
            report.waiting += 1
    return report


def try_now(db: Session, job: EmailJob | None) -> str | None:
    """Best effort, in the request that created the row, so the common case is not
    left waiting for a worker nobody scheduled."""
    if job is None:
        return None
    return attempt(db, job, datetime.now(timezone.utc))


def drain_for(db: Session, user_id: int, *, limit: int = 5, now: datetime | None = None) -> int:
    """Attempt one account's own waiting rows and return how many were tried.

    The narrow version of `drain`, for a page load. It deliberately does not create
    digests and does not look at anybody else's queue: opening a settings screen must
    not make someone else's mail go out, which is the difference between a helper a
    route may call and one only a worker may.
    """
    moment = now or datetime.now(timezone.utc)
    rows = list(
        db.scalars(
            select(EmailJob)
            .where(
                EmailJob.user_id == user_id,
                EmailJob.status == PENDING,
                EmailJob.next_attempt_at <= moment,
            )
            .order_by(EmailJob.id)
            .limit(limit)
        )
    )
    for job in rows:
        attempt(db, job, moment)
    return len(rows)


def cancel_pending(db: Session, user_id: int, reason: str, now: datetime | None = None) -> int:
    """Close every message waiting for an account that can no longer receive one.

    Called when an address is removed. Without it a queued digest would sit there
    until it went stale, and the row's whole contract is that it points at an account
    rather than at a copy of an address — so if the account has no address, the row
    has nowhere to go, and saying `skipped` now is truer than finding out later.
    """
    moment = now or datetime.now(timezone.utc)
    closed = 0
    for job in db.scalars(
        select(EmailJob).where(EmailJob.user_id == user_id, EmailJob.status == PENDING)
    ):
        _close(job, SKIPPED, reason, moment)
        closed += 1
    db.commit()
    return closed
