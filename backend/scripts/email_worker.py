"""Drain the email outbox: send what is waiting, and queue what is due.

The app has no worker of its own. On Vercel there is nothing between two requests,
so a message that was not sent in the request that created it waits for the next
person to arrive — and if nobody arrives, it waits forever. This script is the fix
for whoever runs the site on a host that can schedule something (a cron entry, a
Railway/Fly service, a Windows task): one command, on a timer, and the weekly
summaries stop being a feature that depends on traffic.

What one pass does, in this order:

1. closes pending rows older than `EMAIL_STALE_AFTER_HOURS` as `stale`, so a digest
   of a month ago is never delivered as news;
2. queues the weekly summary for every account that agreed to it and has not had one
   for the newest week that has actually ended;
3. attempts up to `--limit` rows whose next try is due, retrying a real failure with
   backoff and never charging a missing `RESEND_API_KEY` as an attempt.

It is safe to run twice in a minute and safe to run while people are using the site:
every decision is a row transition guarded by the same uniqueness the request paths
use, so two drains are only ever redundant. It sends nothing that the account did not
agree to — the permission checks live in `app/services/email_consent.py` and this
script goes through them like everything else does.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/email_worker.py            # one pass
    .venv/Scripts/python.exe scripts/email_worker.py --every 900
"""

from __future__ import annotations

import argparse
import pathlib
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.database import SessionLocal  # noqa: E402
from app.services import email as transport  # noqa: E402
from app.services import email_jobs as jobs  # noqa: E402

parser = argparse.ArgumentParser(description="Send the queued CareerGuide AI emails.")
parser.add_argument(
    "--every",
    type=int,
    default=0,
    metavar="SECONDS",
    help="keep running, pausing this long between passes (default: one pass and exit)",
)
parser.add_argument(
    "--limit",
    type=int,
    default=20,
    help="maximum messages to attempt per pass, so one pass cannot run over into the "
    "next (default: 20)",
)
args = parser.parse_args()

if not transport.enabled():
    # Says it, and still does the rest of its job: rows keep their attempt counts
    # while no key is set, so the queue built up during the outage sends itself the
    # day one appears. Exiting here would throw that work away.
    print(f"[email] WARNING: email is not configured — missing {', '.join(transport.missing_settings())}")
    print("[email]          queued messages will stay pending until the keys are set.\n")

passes = 0
while True:
    passes += 1
    with SessionLocal() as db:
        report = jobs.drain(db, limit=args.limit)
    print(
        f"[email] pass {passes}: {report.attempted} attempted, {report.sent} sent, "
        f"{report.skipped} closed, {report.staled} too old, {report.failed} failed, "
        f"{report.waiting} still waiting, {len(report.created)} new digest rows queued"
    )
    if report.waiting and not transport.enabled():
        print("[email]          (waiting because this deployment cannot mail, not because of a failure)")
    if args.every <= 0:
        break
    try:
        time.sleep(args.every)
    except KeyboardInterrupt:
        print("\n[email] stopped.")
        break
