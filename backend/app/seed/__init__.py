"""Idempotent catalogue seeding.

Everything here is reference content for exploration. Fees, exams, seats and
scheme details change every year, so rows carry `needs_verification` /
`verified=False` unless an official source is linked and checked.
"""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Career, Exam, ExamGroup, Institution, Resource, Scholarship

log = logging.getLogger("careerguide.seed")


def _count(db: Session, model) -> int:
    return int(db.execute(select(func.count()).select_from(model)).scalar() or 0)


def _seed_exams(db: Session) -> dict[str, int]:
    """Write the doors and the exams under them, with no figure on any row.

    A separate function rather than another `if _count(...) == 0` block in the loop below
    because one source file describes two tables: an exam cannot be inserted before the
    group that owns it, and the group order is the order the file lists them in.
    """
    from .exam_data import GROUPS

    for group_order, group in enumerate(GROUPS):
        row = ExamGroup(
            title=group["title"],
            description=group["description"],
            sort_order=group_order,
        )
        db.add(row)
        # The id is needed for the children, and there is no second commit here: this
        # whole seeding runs in the caller's one transaction, so a half-written catalogue
        # cannot be left behind.
        db.flush()
        for exam_order, exam in enumerate(group["exams"]):
            db.add(Exam(group_id=row.id, sort_order=exam_order, **exam))
    return {"exam_groups": len(GROUPS), "exams": sum(len(g["exams"]) for g in GROUPS)}


def seed_if_empty(db: Session) -> dict:
    """Seed each catalogue table independently so partial runs can be resumed."""
    from .careers_data import CAREERS
    from .catalogue_data import INSTITUTIONS, RESOURCES, SCHOLARSHIPS
    from .study_abroad import seed_study_abroad

    written: dict[str, int] = {}

    if _count(db, Career) == 0:
        for entry in CAREERS:
            db.add(Career(**entry))
        written["careers"] = len(CAREERS)

    # Both tables or neither: a catalogue where an exam has no door would render as a
    # page of orphans, and the public read drops a group with nothing under it anyway.
    if _count(db, ExamGroup) == 0 and _count(db, Exam) == 0:
        written.update(_seed_exams(db))

    if _count(db, Resource) == 0:
        for entry in RESOURCES:
            db.add(Resource(**entry))
        written["resources"] = len(RESOURCES)

    if _count(db, Scholarship) == 0:
        for entry in SCHOLARSHIPS:
            db.add(Scholarship(**entry))
        written["scholarships"] = len(SCHOLARSHIPS)

    if _count(db, Institution) == 0:
        for entry in INSTITUTIONS:
            db.add(Institution(**entry))
        written["institutions"] = len(INSTITUTIONS)

    # Not "if empty": this loader writes only the slugs that are missing, so adding a
    # university to `data/universities.json` and restarting brings that one row in
    # without touching a row the owner has already filled in and verified.
    written.update(seed_study_abroad(db))

    if written:
        db.commit()
        log.info("Seeded %s", written)
    return written
