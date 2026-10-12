"""Idempotent catalogue seeding.

Everything here is reference content for exploration. Fees, exams, seats and
scheme details change every year, so rows carry `needs_verification` /
`verified=False` unless an official source is linked and checked.
"""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Career, Institution, Resource, Scholarship

log = logging.getLogger("careerguide.seed")


def _count(db: Session, model) -> int:
    return int(db.execute(select(func.count()).select_from(model)).scalar() or 0)


def seed_if_empty(db: Session) -> dict:
    """Seed each catalogue table independently so partial runs can be resumed."""
    from .careers_data import CAREERS
    from .catalogue_data import INSTITUTIONS, RESOURCES, SCHOLARSHIPS

    written: dict[str, int] = {}

    if _count(db, Career) == 0:
        for entry in CAREERS:
            db.add(Career(**entry))
        written["careers"] = len(CAREERS)

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

    if written:
        db.commit()
        log.info("Seeded %s", written)
    return written
