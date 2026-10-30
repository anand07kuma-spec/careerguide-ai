"""Who is allowed to do what, and how many times today.

Two different questions get answered here, and keeping them apart matters:

* **Entitlement** — which plan an account is on, and whether a paid period is still
  running. This is a fact about money and a date.
* **Quota** — how many conversations that plan allows in a day. This is a count over
  rows that already exist, derived on every request and never stored in a counter
  column of its own. Counting the child's own messages is the only version that
  cannot drift: a separate "chats used today" column would need to be written in the
  same transaction as the message, and the day it forgot would be a day a student was
  locked out of a question or given fifty free of charge.

The whole mechanism sits behind `PLAN_LIMITS_ENFORCED`, off by default, and that is
explained in `config.py`: this app has told every child that talking to the guide is
free, so a daily cap is a decision made on the day pricing goes live rather than
something a merged branch does quietly.

What is never gated:

* **A disclosure.** `guard_chat` looks at the student's own words before it looks at
  their remaining chats. A child who writes that they are being hurt gets the reviewed
  safety reply whatever their plan is and however many questions they have asked,
  because a limit that silences that message is the one bug in this file that could
  do real harm.
* **Anything about careers.** The catalogue, streams, exams, resources, scholarships
  and institutes are readable on every plan — see `plans.py`.
* **Leaving.** Deleting an account, exporting data, and the consent controls are never
  behind a plan, including for someone whose paid period has just ended.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import ConversationSession, Guardianship, Message, Result, Subscription, User
from . import plans, themes

# One month is 30 days and one year is 365, taken from the plan rather than guessed
# here, so an order and the period it unlocks cannot disagree.


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def day_boundaries(now: datetime) -> tuple[datetime, datetime]:
    """The UTC instants that bracket *today* where the student is.

    The offset is a setting rather than a `tzinfo` lookup so a deployment in another
    country can move its day without this server needing the system's tz database.
    """
    offset = timedelta(minutes=get_settings().quota_utc_offset_minutes)
    local = _utc(now).astimezone(timezone(offset))
    local_start = datetime.combine(local.date(), time.min, tzinfo=timezone(offset))
    return local_start.astimezone(timezone.utc), local_start.astimezone(timezone.utc) + timedelta(
        days=1
    )


def subscription_row(db: Session, user_id: int) -> Subscription | None:
    return db.get(Subscription, user_id)


def _family_rows(db: Session, user: User) -> list[Subscription]:
    """This account's row plus the rows of the account linked to it by a share code.

    A family buys once. A parent who pays for Pro should unlock the child's chats, and
    a student whose school licence is real should let their guardian open the dashboard.
    The link is one hop in either direction — `guardianships` rows only, never a chain
    through a friend — so a paid plan cannot spread by being shared onward.
    """
    rows: list[Subscription] = []
    mine = subscription_row(db, user.id)
    if mine is not None:
        rows.append(mine)

    other_ids = set(
        db.scalars(
            select(Guardianship.student_id).where(Guardianship.parent_id == user.id)
        )
    ) | set(
        db.scalars(
            select(Guardianship.parent_id).where(Guardianship.student_id == user.id)
        )
    )
    if other_ids:
        rows.extend(db.scalars(select(Subscription).where(Subscription.user_id.in_(other_ids))))
    return rows


def _still_running(sub: Subscription, now: datetime) -> bool:
    if sub.plan_code == "free":
        return False
    # No end date means it does not lapse on its own: a granted school licence.
    return sub.expires_at is None or _utc(sub.expires_at) > _utc(now)


def _expiry_key(sub: Subscription) -> datetime:
    return _utc(sub.expires_at) if sub.expires_at else datetime.max.replace(tzinfo=timezone.utc)


def active_subscription(db: Session, user: User, now: datetime | None = None) -> Subscription | None:
    """The row currently paying for this account's features — possibly not its own.

    Exposed because the billing screen has to name the *row*, not just the plan: a
    parent whose own account is Free needs to see that the running period belongs to
    their child, and a child with a school licence needs to see it came from the family.
    Reading the account's own row instead would report both of those as "free".
    """
    now = now or datetime.now(timezone.utc)
    running = [sub for sub in _family_rows(db, user) if _still_running(sub, now)]
    if not running:
        return None
    # The longest-running paid period in the family wins, whatever its code is.
    return max(running, key=_expiry_key)


def current_plan(db: Session, user: User, now: datetime | None = None) -> plans.Plan:
    best = active_subscription(db, user, now)
    if best is None:
        return plans.effective_free()
    return plans.plan_for(best.plan_code)


def plan_detail(db: Session, user: User, now: datetime | None = None) -> dict[str, Any]:
    """What the billing screen shows: the plan, where it came from, when it ends.

    An expired period is reported as it is — plan code and end date included, with
    `active: false` — because a family whose payment lapsed needs to see the date it
    happened, not a silent "Free" that looks like a downgrade nobody told them about.
    """
    now = now or datetime.now(timezone.utc)
    mine = subscription_row(db, user.id)
    active = current_plan(db, user, now)
    granted = active_subscription(db, user, now)
    # A row of *this* account that has stopped running, kept so the screen can name the
    # plan that lapsed instead of printing "Free" as if nobody had ever paid.
    lapsed = (
        mine.plan_code
        if mine and mine.plan_code != "free" and not _still_running(mine, now)
        else None
    )

    return {
        "plan_code": active.code,
        "plan_name": active.name,
        # `shared_from_family` below is how a parent on Free knows why their child
        # still has unlimited chats: the family's paid period is what is being read.
        "source": granted.source if granted else "free",
        "interval": granted.interval if granted else None,
        "started_at": granted.started_at if granted else None,
        "expires_at": granted.expires_at if granted else None,
        "active": granted is not None,
        "lapsed_plan": lapsed,
        "shared_from_family": bool(granted and granted.user_id != user.id),
        "daily_chats": active.daily_chats,
        "total_assessments": active.total_assessments,
        "pdf_reports": active.pdf_reports,
        "parent_dashboard": active.parent_dashboard,
    }


def chats_used_today(db: Session, student_id: int, now: datetime) -> int:
    start, end = day_boundaries(now)
    return int(
        db.scalar(
            select(func.count(Message.id))
            .join(ConversationSession, ConversationSession.id == Message.session_id)
            .where(
                ConversationSession.student_id == student_id,
                Message.role == "user",
                Message.created_at >= start,
                Message.created_at < end,
            )
        )
        or 0
    )


def assessments_finished(db: Session, student_id: int) -> int:
    """Finished questionnaires, ever. A retake that produced a result counts again."""
    return int(
        db.scalar(select(func.count(Result.id)).where(Result.user_id == student_id)) or 0
    )


def usage(db: Session, user: User, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    plan = current_plan(db, user, now)
    used = chats_used_today(db, user.id, now)
    done = assessments_finished(db, user.id)
    limit = plan.daily_chats
    return {
        "plan_code": plan.code,
        "chats_today": used if limit is not None else None,
        "chats_allowed": limit,
        # `None` is "not capped", which the screen prints as "Unlimited" rather than
        # as a number nobody agreed to.
        "chats_left": None if limit is None else max(0, limit - used),
        "assessments_done": done,
        "assessments_allowed": plan.total_assessments,
        "enforced": get_settings().plan_limits_enforced,
    }


def _upgrade_hint(what: str) -> str:
    return (
        f"{what} This plan is free and stays free — you have not been cut off from "
        "anything you already made. See /pricing for what a paid plan adds."
    )


def guard_chat(db: Session, user: User, text: str, now: datetime | None = None) -> None:
    """Refuse the day's fourth conversation — unless the student is in trouble."""
    settings = get_settings()
    if not settings.plan_limits_enforced:
        return

    # First, always: a disclosure is answered before any question of money.
    if themes.possible_distress(text or ""):
        return

    plan = current_plan(db, user)
    limit = plan.daily_chats
    if limit is None:
        return
    used = chats_used_today(db, user.id, now or datetime.now(timezone.utc))
    if used < limit:
        return
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail=_upgrade_hint(
            f"You have used today's {limit} free conversations with the guide."
        ),
    )


def guard_assessment_start(db: Session, user: User, now: datetime | None = None) -> None:
    """Refuse a *new* questionnaire once the free allowance is finished.

    Called after the router has found an unfinished sitting, so a student who is
    halfway through their one free questionnaire can always come back and finish it —
    the allowance is about how many results a free account collects, not about how
    many times it is allowed to sit down.
    """
    settings = get_settings()
    if not settings.plan_limits_enforced:
        return
    plan = current_plan(db, user)
    limit = plan.total_assessments
    if limit is None:
        return
    done = assessments_finished(db, user.id)
    if done < limit:
        return
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail=_upgrade_hint(
            f"This free plan includes {limit} assessment, and yours is finished."
        ),
    )


def guard_feature(db: Session, user: User, feature: str, label: str) -> None:
    """Gate one named feature — the printed report and the parent's dashboard.

    Only these two are gated, and both are things a family buys rather than something
    a child needs to keep working: a report of finished questionnaires, and a
    guardian's view. Nothing on the student's own path through the app stops.
    """
    if not get_settings().plan_limits_enforced:
        return
    plan = current_plan(db, user)
    if getattr(plan, feature):
        return
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail=_upgrade_hint(f"{label} is part of a paid plan."),
    )


def set_plan(
    db: Session,
    user_id: int,
    plan_code: str,
    source: str,
    interval: str | None = None,
    expires_at: datetime | None = None,
    now: datetime | None = None,
) -> Subscription:
    """Write the entitlement directly — the path a granted licence and a downgrade use.

    `source` is not decoration: a row that says `payment` is a claim that money moved,
    so only the payment routes may write it, and a person setting a plan by hand must
    use `granted`. Keeping the two apart in one column is what lets the billing screen
    tell a family the truth about why they have Pro.
    """
    now = now or datetime.now(timezone.utc)
    sub = db.get(Subscription, user_id)
    if sub is None:
        sub = Subscription(user_id=user_id)
        db.add(sub)
    sub.plan_code = plan_code
    sub.source = source
    sub.interval = interval
    sub.started_at = now
    sub.expires_at = expires_at
    sub.changed_at = now
    db.flush()
    return sub


def apply_captured_payment(
    db: Session, user_id: int, plan_code: str, now: datetime | None = None
) -> Subscription:
    """Unlock the plan a payment bought, without throwing away time already paid for.

    A paid period that is still running is extended from its own end rather than
    restarted. A family that buys a year while eight days of a month are left gets
    those eight days *and* the year: the alternative — resetting to today — silently
    deletes paid time they could ask a refund for, and which nothing in this app can
    honestly give back.
    """
    now = now or datetime.now(timezone.utc)
    plan = plans.get(plan_code)
    if plan is None or plan.period_days is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="That plan has no paid period to apply.",
        )

    existing = db.get(Subscription, user_id)
    start = now
    if existing and _still_running(existing, now) and existing.expires_at is not None:
        start = _utc(existing.expires_at)
    elif existing and _still_running(existing, now) and existing.expires_at is None:
        # A granted licence with no end date is not something a payment replaces: the
        # paid period starts now, and the licence's own row is left for a person to fix.
        start = now

    expires = start + timedelta(days=plan.period_days)
    existing = set_plan(
        db, user_id, plan.code, source="payment", interval=plan.interval,
        expires_at=expires, now=now,
    )
    return existing


def new_receipt(user_id: int, plan_code: str, when: datetime) -> str:
    """Our own reference for an order: opaque, no name in it, safe to print.

    Razorpay shows `receipt` on the payment and on the statement a parent gets. A
    child's display name or device id in a payment provider's records would be a
    second place their data lives, so this is a number, a plan and a date.
    """
    local = _utc(when).date().isoformat().replace("-", "")
    return f"cg{local}-u{user_id}-{plan_code}"
