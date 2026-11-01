"""Stop asking an AI provider that has stopped answering.

The conversation route already falls back to the built-in guide when a provider call
fails, and that is the right answer for one turn. It is the wrong answer for a provider
that is down: every student in the app then pays a 45-second timeout for a reply that
will not come, the provider receives one request per child per message until it pages
somebody, and on a metered API the retries are not free either.

So the failure count is kept, and once it says *this provider is not there* the guide
answers from its own script for a fixed cooldown without asking. Three rules decide the
shape of this file:

* **Consecutive, inside a window.** Five failures in the same minute mean an outage; the
  same five spread over a week mean a flaky network, and a flaky network is not a reason
  to stop calling. A success clears the count, so one reply that came through ends the
  streak — which is why the counter is *failures since the last success*, not *failures
  today*.
* **The cooldown cannot be pushed out.** Opening the breaker writes one key with an
  expiry, and `limits` sets an expiry only when a key is created; further failures during
  the cooldown increment it but do not extend it. A provider that stays broken for an
  hour is retried thirty times, not four hundred, and the student is not told "try again
  in a minute" forever.
* **The reply is labelled.** What the cooldown serves is the built-in guide, and the
  transcript says so in the same words the demo deployment uses. A child must never be
  shown model-quality-sounding advice that is quietly a fallback.

Both counters live in `middleware.rate_limit.shared_store()`: one number for the whole
deployment when a Redis is configured, this process's own judgement when it is not — the
same trade `ai_budget.py` makes, and reported on the same screen.
"""

from __future__ import annotations

import logging
import time

from ..config import get_settings
from ..middleware.rate_limit import shared_store

log = logging.getLogger(__name__)

# Two keys, because the two questions have different lifetimes: how many failures this
# streak has, and whether the breaker is open right now. A cooldown that is still running
# with a reset streak of failures underneath it is the state a provider that comes back
# for ten seconds and dies again produces, and one key cannot hold both.
FAILS = "ai-breaker:failures"
OPEN = "ai-breaker:open"


def _store():
    """The counter store, or nothing.

    Every function here answers *conservatively* when the store cannot be reached: the
    breaker reports itself closed and the failure is not counted. A Redis that is down
    must not turn into either a 500 in front of a student or a deployment that has decided
    on its own that the provider is broken.
    """
    try:
        return shared_store()
    except Exception as exc:  # noqa: BLE001 - a counter that is down is not a 500
        log.warning("The provider circuit breaker is not counting (%s).", exc)
        return None


def note_failure() -> None:
    """Record that the provider did not answer, and open the breaker if the streak says so."""
    store = _store()
    if store is None:
        return
    settings = get_settings()
    window = max(1, settings.ai_breaker_window_seconds)
    try:
        streak = int(store.incr(FAILS, window))
        if streak >= max(1, settings.ai_breaker_failures):
            # The open marker's lifetime comes from its own creation, so this write during
            # an existing cooldown cannot make the wait longer for the student.
            store.incr(OPEN, max(1, settings.ai_breaker_cooldown_seconds))
            store.clear(FAILS)
            log.warning(
                "The AI provider failed %s times inside %ss; the guide answers from its "
                "own script for %ss.",
                streak,
                window,
                settings.ai_breaker_cooldown_seconds,
            )
    except Exception as exc:  # noqa: BLE001 - a counter that is down is not a 500
        log.warning("The provider circuit breaker is not counting (%s).", exc)


def note_success() -> None:
    """Record that the provider answered, and stand the breaker down if it was up."""
    store = _store()
    if store is None:
        return
    try:
        store.clear(FAILS)
        store.clear(OPEN)
    except Exception as exc:  # noqa: BLE001 - a counter that is down is not a 500
        log.warning("The provider circuit breaker is not counting (%s).", exc)


def is_open() -> bool:
    """Whether the next provider call should be skipped without trying it."""
    store = _store()
    if store is None:
        return False
    try:
        return int(store.get(OPEN)) > 0
    except Exception:  # noqa: BLE001 - an unreachable store means "try the provider"
        return False


def state() -> dict[str, int | bool]:
    """What the deployment screen prints, and the only way to see the breaker without waiting for it.

    `seconds_left` is the remaining cooldown, so an operator reading this at 2 a.m. knows
    whether the guide is scripted because a provider is down or because it was down a
    minute ago and the wait is nearly over.
    """
    store = _store()
    settings = get_settings()
    out: dict[str, int | bool] = {
        "open": False,
        "failures": 0,
        "seconds_left": 0,
        "trips_after": max(1, settings.ai_breaker_failures),
        "window_seconds": max(1, settings.ai_breaker_window_seconds),
        "cooldown_seconds": max(1, settings.ai_breaker_cooldown_seconds),
    }
    if store is None:
        return out
    try:
        out["failures"] = int(store.get(FAILS))
        out["open"] = int(store.get(OPEN)) > 0
        out["seconds_left"] = max(0, int(round(store.get_expiry(OPEN) - time.time())))
    except Exception as exc:  # noqa: BLE001 - a counter that is down reports "unknown"
        log.warning("The provider circuit breaker cannot be read (%s).", exc)
    return out
