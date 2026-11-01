"""How many guide replies one account may spend in a day, and what happens at the last one.

Two per-minute rules and one per-day number guard the same call, and each answers a
different question:

* `rate_limit_chat` says *you are sending faster than a person types* — a script, a
  refresh loop, two tabs fighting. It refills itself in sixty seconds.
* `entitlements.guard_chat` says *your plan's conversations for today are used up*. It is
  a commercial line, it is switched off until pricing goes live (`PLAN_LIMITS_ENFORCED`),
  and it counts rows already in the database.
* This file says *one account cannot spend an unbounded amount of money on the AI
  provider tonight*. It is on by default, it counts requests rather than stored rows, and
  its number is deliberately far above any plan's allowance — a student who hits it is
  not being told to pay, they are the one case the bill cannot survive: a loop, a stuck
  retry, or a script holding a real session.

Why a counter here instead of another `COUNT(*)` over `messages`: counting the rows would
be honest about *delivered* replies but blind to the calls that failed and were retried,
which are the expensive half, and it would need a row to exist — this guard runs before
anything is written, so the transcript stays clean (see the refusal below). The cost is
that the number lives in a store rather than in the database, so it is stated as what it
is: a brake on spend, not an invoice.

The counter lives in `middleware.rate_limit.shared_store()` — the throttle's own store —
for the reason that file exists: on serverless hosting several warm workers must see one
number, or a "40 a day" ceiling is 40 per container. With no Redis configured it is this
process's memory, exactly like the throttle, and it behaves exactly as it does today.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status

from ..config import get_settings
from ..middleware.rate_limit import shared_store
from . import entitlements, themes

log = logging.getLogger(__name__)

# The counter's identity: the account and *their* day, not UTC's. The local date is part
# of the key rather than derived from a window length, because `limits` aligns a
# "per day" rule to epoch midnight — which in India is 05:30, and a sentence promising a
# reset "at midnight" would have been a lie that also handed out a second budget mid-evening.
_KEY = "ai-budget"


def _now(now: datetime | None) -> datetime:
    return entitlements._utc(now or datetime.now(timezone.utc))


def _window(now: datetime) -> tuple[str, int]:
    """This account's day as a key fragment, and how many seconds it has left to live.

    The fragment is the UTC instant local midnight *started* at, so it changes exactly
    once per local day and nowhere else. The lifetime is the distance to the end of that
    window plus a minute, which keeps a key written at 23:59 from sitting around for a
    full day after it stopped meaning anything.
    """
    start, end = entitlements.day_boundaries(now)
    return start.strftime("%Y%m%dT%H%M%SZ"), max(60, int((end - now).total_seconds()) + 60)


def _key(user_id: int, now: datetime) -> str:
    day, _ = _window(now)
    return f"{_KEY}:{user_id}:{day}"


def guard(user_id: int, text: str, now: datetime | None = None) -> None:
    """Refuse the reply after the day's budget is gone — and refuse it before anything is written.

    Raises 429 with one fixed sentence naming when the count starts again. Never 500, and
    never an empty answer: a student who is out of budget still gets a reply, and it is
    this one.

    A disclosure of danger is answered first, whatever the counter says, for the same
    reason `entitlements.guard_chat` does it and in the same order — the safety reply is
    reviewed word for word and does not call the provider at all, so it costs nothing and
    refusing it would be the worst bug in this file.
    """
    limit = get_settings().ai_daily_message_limit
    if limit <= 0:
        return
    if themes.possible_distress(text or ""):
        return

    at = _now(now)
    key = _key(user_id, at)
    _, ttl = _window(at)
    try:
        # Increment-then-compare, which is what the rate limiter itself does: reserving the
        # call before it is made is the only version that cannot over-spend when two of this
        # student's requests land on two warm workers at the same instant.
        spent = shared_store().incr(key, ttl)
    except Exception as exc:  # noqa: BLE001 - a counter that is down is not a 500
        # Same judgement as the read throttle and as `in_memory_fallback_enabled`: a Redis
        # that is restarting must not stand between a student and their question. The
        # ceiling is weaker for those minutes, and the deployment screen says so.
        log.warning("The AI daily budget is not counting (%s); letting the message through.", exc)
        return
    if spent <= limit:
        return
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=refusal_sentence(limit),
        headers={"Retry-After": str(max(1, ttl))},
    )


def refusal_sentence(limit: int) -> str:
    """The one sentence every exhausted account reads, fixed so nothing is guessed about them.

    It names the reset as *midnight, their time* because that is how the key is built
    (see `_window`), and it says what to do rather than what was broken. It does not
    mention a plan or a price, because this ceiling is not a commercial one and a child
    must not come away thinking they had been cut off from something they owned.
    """
    return (
        f"You have asked the guide {limit} questions today, which is more than one day "
        "should need. The count starts again at midnight, your time. Everything you have "
        "already been told stays saved, and the careers, streams and resources are all "
        "still open to you in the meantime."
    )


def spent_today(user_id: int, now: datetime | None = None) -> int:
    """How many of the day's replies this account has already asked for.

    Nothing in the product shows a student this number, and that is deliberate: the app has
    never counted their questions out loud, because one figure in the corner of a chat turns
    a free conversation into a meter. `scripts/security_test.py` reads it to prove the
    counter and the transcript agree with each other, which is the only reason it exists.
    """
    at = _now(now)
    try:
        return int(shared_store().get(_key(user_id, at)))
    except Exception:  # noqa: BLE001 - a counter that is down answers "unknown", not an error
        return 0
