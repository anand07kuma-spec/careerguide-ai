"""Learning resources, scholarships, and institutions.

Anything that could mislead a family about money or admissions is labelled by
its `verified` flag and carries an official link for confirmation.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Institution, Resource, Scholarship
from ..schemas import InstitutionOut, ResourceOut, ScholarshipOut

router = APIRouter(tags=["catalogue"])


@router.get("/api/resources", response_model=list[ResourceOut])
def list_resources(
    search: str | None = Query(default=None, max_length=80),
    category: str | None = Query(default=None, max_length=64),
    kind: str | None = Query(default=None, max_length=32),
    language: str | None = Query(default=None, max_length=8),
    verified_only: bool = False,
    limit: int = Query(default=120, ge=1, le=400),
    db: Session = Depends(get_db),
) -> list[ResourceOut]:
    stmt = select(Resource)
    if category:
        stmt = stmt.where(Resource.category == category)
    if kind:
        stmt = stmt.where(Resource.kind == kind)
    if language:
        stmt = stmt.where(Resource.language == language)
    if verified_only:
        stmt = stmt.where(Resource.verified.is_(True))
    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Resource.title).like(pattern),
                func.lower(Resource.description).like(pattern),
                func.lower(Resource.category).like(pattern),
            )
        )
    rows = list(db.scalars(stmt.order_by(Resource.title).limit(limit)))
    return [ResourceOut.model_validate(r) for r in rows]


@router.get("/api/resources/categories")
def resource_categories(db: Session = Depends(get_db)) -> list[str]:
    return [
        row
        for row in db.execute(
            select(func.distinct(Resource.category)).order_by(Resource.category)
        ).scalars()
    ]


@router.get("/api/scholarships", response_model=list[ScholarshipOut])
def list_scholarships(
    search: str | None = Query(default=None, max_length=80),
    state: str | None = Query(default=None, max_length=40),
    level: str | None = Query(default=None, max_length=40),
    scope: str | None = Query(default=None, max_length=16),
    db: Session = Depends(get_db),
) -> list[ScholarshipOut]:
    """Filters are interface-level only; eligibility always needs official checks."""
    stmt = select(Scholarship)
    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Scholarship.name).like(pattern),
                func.lower(Scholarship.provider).like(pattern),
                func.lower(Scholarship.benefit_summary).like(pattern),
            )
        )
    rows = list(db.scalars(stmt.order_by(Scholarship.name)))

    if state:
        rows = [r for r in rows if not r.states or state.lower() in {s.lower() for s in r.states} or "all-india" in [s.lower() for s in r.states]]
    if level:
        rows = [r for r in rows if not r.education_levels or level.lower() in {x.lower() for x in r.education_levels}]
    if scope:
        rows = [r for r in rows if r.scope == scope]
    return [ScholarshipOut.model_validate(r) for r in rows]


@router.get("/api/scholarships/{scholarship_id}", response_model=ScholarshipOut)
def scholarship_detail(scholarship_id: int, db: Session = Depends(get_db)) -> ScholarshipOut:
    row = db.get(Scholarship, scholarship_id)
    if row is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="That scheme could not be found.")
    return ScholarshipOut.model_validate(row)


@router.get("/api/institutions", response_model=list[InstitutionOut])
def list_institutions(
    search: str | None = Query(default=None, max_length=80),
    state: str | None = Query(default=None, max_length=40),
    career_area: str | None = Query(default=None, max_length=64),
    institution_type: str | None = Query(default=None, max_length=16),
    mode: str | None = Query(default=None, max_length=16),
    db: Session = Depends(get_db),
) -> list[InstitutionOut]:
    stmt = select(Institution)
    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Institution.name).like(pattern),
                func.lower(Institution.city).like(pattern),
                func.lower(Institution.state).like(pattern),
            )
        )
    if institution_type:
        stmt = stmt.where(Institution.institution_type == institution_type)
    if mode:
        stmt = stmt.where(Institution.mode == mode)
    rows = list(db.scalars(stmt.order_by(Institution.name)))

    if state:
        rows = [r for r in rows if state.lower() in r.state.lower()]
    if career_area:
        rows = [r for r in rows if any(career_area.lower() in a.lower() for a in (r.career_areas or []))]
    # Sponsored listings stay visible but never get sorted above better matches.
    rows.sort(key=lambda r: (r.sponsored, r.name))
    return [InstitutionOut.model_validate(r) for r in rows]
