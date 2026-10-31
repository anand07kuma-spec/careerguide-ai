"""What has been checked against an official page, and when — the public feed.

`/verified` on the website is a marketing page, and it answers one question a family can
ask: has anybody actually read this, or is the app asking me to check it myself. The data
for that answer is already stored — a date stamped by a person, and the page they named —
but it reaches a browser only inside each row's own payload. This router brings those dates
together in one response, newest first, so a page can list what was checked in a window
instead of describing the policy in the abstract.

Two rules the response has to keep, both inherited from `scripts/verify_data.py`:

* **A row appears only with a date and the flag agreeing.** `verified_at` is written by the
  script from its own clock and by the operator routes when they set the flag — never
  supplied with a claim — so a date is a signature. A row carrying a date whose warning
  flag is still raised, or a flag cleared with no date, is the half state `verify_data.py
  report` calls `IMPOSSIBLE`, and advertising it in a list of things that were checked
  would put this page on the wrong side of a data error rather than merely early.
* **Nothing is here that the row's own page does not already say.** Same fields, same
  nulls. A row verified before the source column existed shows its date with no link,
  because dropping it would hide a check that happened.

No session, no per-student data, and no per-caller answer, which is why this path is in
the read-exempt list in `app/middleware/rate_limit.py`: it is fetched by a server render on
behalf of every visitor at once, and a shared bucket there is a lockout for the whole site's
traffic, not a defence against anything.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Career, Exam, Scholarship, University
from ..schemas import VerificationItemOut, VerificationRecentOut

router = APIRouter(prefix="/api/verification", tags=["verification"])

# The window's upper bound on the request, not on the data. A year is already more history
# than this catalogue has; wider would turn a cheap index scan into a full table read for a
# number nobody displays.
MAX_DAYS = 365


def _items(rows: list, kind: str, name_of, date_of, source_of, path_of) -> list[VerificationItemOut]:
    items: list[VerificationItemOut] = []
    for row in rows:
        stamped = date_of(row)
        if stamped is None:
            # Guarded by the query; repeated here because the response model says a date is
            # always present, and a null slipping through would be a 500 on a marketing page.
            continue
        items.append(
            VerificationItemOut(
                kind=kind,
                name=name_of(row),
                verified_at=stamped,
                source_url=source_of(row),
                path=path_of(row),
            )
        )
    return items


@router.get("/recent", response_model=VerificationRecentOut)
def recent_verifications(
    days: int = Query(default=30, ge=1, le=MAX_DAYS),
    db: Session = Depends(get_db),
) -> VerificationRecentOut:
    """Every catalogue row checked in the last `days` days, newest first."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    careers = list(
        db.scalars(
            select(Career)
            .where(Career.verified_at.is_not(None), Career.verified_at >= since)
            .where(Career.needs_verification.is_(False))
            .order_by(Career.verified_at.desc())
        )
    )
    exams = list(
        db.scalars(
            select(Exam)
            .where(Exam.verified_at.is_not(None), Exam.verified_at >= since)
            .where(Exam.verified.is_(True))
            .order_by(Exam.verified_at.desc())
        )
    )
    scholarships = list(
        db.scalars(
            select(Scholarship)
            .where(Scholarship.last_verified_at.is_not(None), Scholarship.last_verified_at >= since)
            .where(Scholarship.verified.is_(True))
            .order_by(Scholarship.last_verified_at.desc())
        )
    )
    universities = list(
        db.scalars(
            select(University)
            .where(University.verified_at.is_not(None), University.verified_at >= since)
            .where(University.verified.is_(True))
            .order_by(University.verified_at.desc())
        )
    )

    items = (
        _items(
            careers, "career",
            lambda row: row.title, lambda row: row.verified_at, lambda row: row.source_url,
            # The public profile is the page the badge sits on, so a reader who wants to see
            # what was checked lands on it rather than on a list they have to search.
            lambda row: f"/careers/{row.slug}",
        )
        + _items(
            exams, "exam",
            lambda row: row.name, lambda row: row.verified_at, lambda row: row.source_url,
            # Exams live on `/app/exams`, behind a session. A public page that linked a
            # stranger into a login shell would be a dead result, so the row keeps its name
            # and its date and points at nothing.
            lambda row: None,
        )
        + _items(
            scholarships, "scholarship",
            lambda row: row.name, lambda row: row.last_verified_at, lambda row: row.source_url,
            lambda row: None,
        )
        + _items(
            universities, "university",
            lambda row: row.name, lambda row: row.verified_at, lambda row: row.source_url,
            # A university is shown on its destination's page, which is the public half of
            # this directory; `country` is loaded with the row by the session that is still open.
            lambda row: f"/study-abroad/{row.country.slug}" if row.country else None,
        )
    )
    items.sort(key=lambda item: item.verified_at, reverse=True)

    return VerificationRecentOut(
        days=days, since=since, count=len(items), items=items
    )
