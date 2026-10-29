"""The exams catalogue: one public read, and the operator's side of the same table.

`/api/exams` answers the whole screen in one call — the doors, and under each door the
exams that are live — because the page is read as a single map and was previously a
`const` in the frontend bundle. Moving it here is what lets a wrong sentence about NEET
be corrected without a deploy.

The operator routes are the reason this file exists, and they carry the rule the previous
page enforced by not having the data at all. **A student may read a date or a fee from
this API only when a human read it off a source first.** Concretely:

* `exam_date` and `fee_note` cannot be set on a new row — `ExamCreateIn` has no field for
  either, so an added exam is a name, a conducting body and four sentences.
* The update route refuses a non-empty `exam_date` or `fee_note` unless the row carries a
  `source_url`, and refuses `verified: true` without one — the same rule
  `app/routers/study_abroad.py` sets for a tuition figure.
* The public read then withholds both from any row that is not `verified`, so a value
  typed in without a source cannot reach a child even if it is sitting in the column.
* `verified_at` is stamped here, never accepted from a body. "Verified" therefore means
  "somebody opened the notification on this day", not "somebody ticked a box".

Nothing here is counselling. The four sentences an exam row carries are general
information about what an exam is for, and the screen that renders them keeps naming the
official notification as the only authority for everything that changes year to year.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, status
from fastapi.exceptions import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.rate_limit import admin_limit
from ..models import Exam, ExamGroup, User
from ..schemas import (
    ExamAdminOut,
    ExamCreateIn,
    ExamGroupAdminOut,
    ExamGroupCreateIn,
    ExamGroupOut,
    ExamGroupUpdateIn,
    ExamOut,
    ExamUpdateIn,
)
from ..security import get_admin_user
from ..services import audit

router = APIRouter(prefix="/api/exams", tags=["exams"])
admin_router = APIRouter(
    prefix="/api/exams/admin",
    tags=["exams"],
    # The guard is on the router, as it is on every operator surface: a route that
    # forgot to check is the one that gets found in six months.
    dependencies=[Depends(get_admin_user)],
)

log = logging.getLogger(__name__)

NO_SOURCE = (
    "A date or a fee needs the page it came from. Set source_url to the official "
    "notification or conducting body's page and the value can be stored with it."
)
SOURCE_OF_A_VERIFIED_ROW = (
    "This row is verified, so the page it was read from is part of the record. Put in the "
    "page you have read now instead of clearing this one — or set verified back to false "
    "first, if the figure is no longer something to stand behind."
)
GROUP_NOT_EMPTY = (
    "This door still has exams under it. Move them to another door or delete them first "
    "— removing the group would take the cards under it off a page somebody is reading."
)
DUPLICATE_NAME = (
    "An exam with that name is already listed. Edit that row instead of adding a second "
    "one, so a student cannot see two different answers to the same question."
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _valid_url(value: str | None) -> bool:
    value = (value or "").strip()
    return bool(value) and value.startswith(("https://", "http://")) and "." in value


def _refused(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=detail)


def _group_by_id(db: Session, group_id: int) -> ExamGroup:
    row = db.get(ExamGroup, group_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That group of exams is not in the catalogue.",
        )
    return row


def _exam_by_id(db: Session, exam_id: int) -> Exam:
    row = db.get(Exam, exam_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That exam is not in the catalogue.",
        )
    return row


# ------------------------------------------------------------------ public reads


def _public(row: Exam) -> ExamOut:
    """A card, with the figures withheld until a human has read a source.

    The column may hold text that an operator typed while meaning to paste it from a
    notification and then never checked. Publishing it because it exists is how a stale
    fee reaches a child, so the row's own `verified` flag is what gates the two fields —
    and the screen's fallback for `null` is the sentence it has always printed: the
    official notification is the authority.
    """
    out = ExamOut.model_validate(row)
    if not row.verified:
        out.exam_date = None
        out.fee_note = None
    return out


@router.get("", response_model=list[ExamGroupOut])
def list_exams(db: Session = Depends(get_db)) -> list[ExamGroupOut]:
    """Every live door, with its live exams, in the order the page prints them.

    A group with nothing under it is left out rather than shown as an empty heading: an
    operator who deleted the last exam of a door has removed that route from a student's
    map, and a heading over nothing reads like a bug.
    """
    groups = db.scalars(
        select(ExamGroup).where(ExamGroup.is_active.is_(True)).order_by(ExamGroup.sort_order, ExamGroup.id)
    ).all()
    out: list[ExamGroupOut] = []
    for group in groups:
        exams = [
            _public(exam)
            for exam in sorted(
                (e for e in group.exams if e.is_active), key=lambda e: (e.sort_order, e.id)
            )
        ]
        if not exams:
            continue
        card = ExamGroupOut.model_validate(group)
        card.exams = exams
        out.append(card)
    return out


# ---------------------------------------------------------------- operator routes


def _admin_exam(row: Exam) -> ExamAdminOut:
    """The operator sees what is stored, including an unverified date and its source."""
    return ExamAdminOut.model_validate(row)


def _admin_group(db: Session, group: ExamGroup) -> ExamGroupAdminOut:
    card = ExamGroupAdminOut.model_validate(group)
    card.exams = [
        _admin_exam(exam)
        for exam in sorted(group.exams, key=lambda e: (e.sort_order, e.id))
    ]
    return card


@admin_router.get("", response_model=list[ExamGroupAdminOut])
def admin_catalogue(db: Session = Depends(get_db)) -> list[ExamGroupAdminOut]:
    """The whole catalogue, inactive rows included — an operator needs to see what is hidden."""
    groups = db.scalars(
        select(ExamGroup).order_by(ExamGroup.sort_order, ExamGroup.id)
    ).all()
    return [_admin_group(db, group) for group in groups]


@admin_router.post("/groups", response_model=ExamGroupAdminOut, status_code=status.HTTP_201_CREATED)
@admin_limit
def admin_create_group(
    request: Request,
    body: ExamGroupCreateIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> ExamGroupAdminOut:
    """Add a door. It starts with no exams under it, so the public page does not show it."""
    listed = db.scalar(select(func.count(ExamGroup.id)))
    row = ExamGroup(
        title=body.title.strip(),
        description=body.description.strip(),
        # After the seeded ones: a new door at position zero would move every heading a
        # student has been reading, and ordering is a decision rather than a default.
        sort_order=body.sort_order if body.sort_order is not None else int(listed or 0) + 1,
    )
    db.add(row)
    db.flush()
    audit.record(
        db,
        actor,
        "exam_group.create",
        subject_type="exam_group",
        subject_id=row.id,
        detail="group added, no exams yet",
    )
    db.commit()
    db.refresh(row)
    return _admin_group(db, row)


@admin_router.patch("/groups/{group_id}", response_model=ExamGroupAdminOut)
@admin_limit
def admin_update_group(
    request: Request,
    group_id: int,
    body: ExamGroupUpdateIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> ExamGroupAdminOut:
    """Reword a door or take it off the page. Absent means unchanged, empty means cleared."""
    row = _group_by_id(db, group_id)
    changes = body.model_dump(exclude_unset=True)
    for name in ("title", "description", "is_active", "sort_order"):
        if name in changes:
            setattr(row, name, changes[name])
    audit.record(
        db,
        actor,
        "exam_group.update",
        subject_type="exam_group",
        subject_id=row.id,
        detail=f"changed: {', '.join(sorted(changes))}" if changes else "nothing changed",
    )
    db.commit()
    db.refresh(row)
    return _admin_group(db, row)


@admin_router.delete("/groups/{group_id}", status_code=204)
@admin_limit
def admin_delete_group(
    request: Request,
    group_id: int,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> None:
    """Remove a door — only once nothing is standing under it.

    The foreign key is `CASCADE`, so this route could take a group and its exams away in
    one statement. It does not: a group is a heading on a page a child is reading, and
    deleting a heading should not be able to delete the eleven cards that came with it.
    """
    row = _group_by_id(db, group_id)
    if row.exams:
        raise _refused(GROUP_NOT_EMPTY)
    audit.record(
        db,
        actor,
        "exam_group.delete",
        subject_type="exam_group",
        subject_id=group_id,
        detail="empty group removed",
    )
    db.delete(row)
    db.commit()


@admin_router.post("/exams", response_model=ExamAdminOut, status_code=status.HTTP_201_CREATED)
@admin_limit
def admin_create_exam(
    request: Request,
    body: ExamCreateIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> ExamAdminOut:
    """Add an exam. No date, no fee, and no way to arrive already verified.

    Both figures need a source, and a brand-new row has none yet — so they enter through
    the update route, which checks for one. This is the same shape `admin_create_university`
    has, and for the same reason: the person adding a row is usually the person who could
    be tempted to guess.
    """
    group = _group_by_id(db, body.group_id)
    name = body.name.strip()
    clash = db.scalars(
        select(Exam).where(func.lower(Exam.name) == name.lower())
    ).first()
    if clash is not None:
        raise _refused(DUPLICATE_NAME)
    listed = db.scalar(
        select(func.count(Exam.id)).where(Exam.group_id == group.id)
    )
    row = Exam(
        group_id=group.id,
        name=name,
        authority=body.authority.strip(),
        description=body.description.strip(),
        careers=body.careers.strip(),
        timeline=body.timeline.strip(),
        preparation=body.preparation.strip(),
        sort_order=body.sort_order if body.sort_order is not None else int(listed or 0) + 1,
    )
    db.add(row)
    # Before the log line, so the audit row can name the id it just created.
    db.flush()
    audit.record(
        db,
        actor,
        "exam.create",
        subject_type="exam",
        subject_id=row.id,
        detail="row added, no date or fee, unverified",
    )
    db.commit()
    db.refresh(row)
    log.info("Exam %s added under group %s", row.name, group.title)
    return _admin_exam(row)


@admin_router.patch("/exams/{exam_id}", response_model=ExamAdminOut)
@admin_limit
def admin_update_exam(
    request: Request,
    exam_id: int,
    body: ExamUpdateIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> ExamAdminOut:
    """Fill an exam in. Verification is the one thing this cannot be told.

    Three refusals, all about the same failure — a number that outlives the notification
    it came from:

    * a date or a fee with no `source_url` on the row (now or already there) is refused,
      because the value would be a claim rather than a record;
    * `verified: true` without a source is refused;
    * clearing the `source_url` of a verified row is refused, so a badge cannot survive
      the loss of the thing that earned it.

    `verified_at` is stamped here. Turning verification off clears the date, because a
    row that is no longer verified should not keep the evidence that it was.
    """
    row = _exam_by_id(db, exam_id)
    changes = body.model_dump(exclude_unset=True)

    if changes.get("source_url") and not _valid_url(changes["source_url"]):
        raise _refused("The source URL has to start with https:// or http://.")

    source_after = changes.get("source_url", row.source_url)
    for name in ("exam_date", "fee_note"):
        if changes.get(name):
            if not source_after:
                raise _refused(NO_SOURCE)
            # Setting a figure and saying where it came from in one body is the normal
            # case; refusing it would only push the operator to send two requests.
            changes[name] = changes[name].strip()
    wants_verified = bool(changes.get("verified"))
    if wants_verified and not source_after:
        raise _refused(NO_SOURCE)
    clearing_source = (
        "source_url" in changes
        and not changes["source_url"]
        and (row.verified or wants_verified)
    )
    if clearing_source:
        raise _refused(SOURCE_OF_A_VERIFIED_ROW)

    for name in (
        "name",
        "authority",
        "description",
        "careers",
        "timeline",
        "preparation",
        "exam_date",
        "fee_note",
        "source_url",
        "is_active",
        "sort_order",
    ):
        if name in changes:
            value = changes[name]
            setattr(row, name, value.strip() if isinstance(value, str) else value)

    if "verified" in changes:
        row.verified = wants_verified
        row.verified_at = _now() if wants_verified else None

    # The verification gets its own action name: "the fee was typed in on this day" and
    # "somebody read a source on this day" are different answers when a family later asks
    # why a number was on the page.
    audit.record(
        db,
        actor,
        "exam.verify" if wants_verified else "exam.update",
        subject_type="exam",
        subject_id=row.id,
        detail=(
            f"verified -> true from source; changed: {', '.join(sorted(changes))}"
            if wants_verified
            else f"changed: {', '.join(sorted(changes)) or 'nothing'}"
        ),
    )
    db.commit()
    db.refresh(row)
    return _admin_exam(row)


@admin_router.delete("/exams/{exam_id}", status_code=204)
@admin_limit
def admin_delete_exam(
    request: Request,
    exam_id: int,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> None:
    """Take an exam off the page.

    `is_active: false` is the usual answer and this route says so in the audit line: a
    card can be wrong for a year and right again, and the row that already carries four
    careful sentences is worth keeping out of sight rather than retyping. Deletion is
    here because the operator asked for it, and it removes only the catalogue row — no
    student's work references this table.
    """
    row = _exam_by_id(db, exam_id)
    audit.record(
        db,
        actor,
        "exam.delete",
        subject_type="exam",
        subject_id=exam_id,
        detail=f"removed from group {row.group_id}",
    )
    db.delete(row)
    db.commit()
