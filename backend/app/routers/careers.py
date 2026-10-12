"""Career catalogue, categories, and saved careers."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Career, JourneyEvent, SavedCareer
from ..schemas import CareerOut, CareerSummaryOut, CategoryOut, SavedCareerOut
from ..security import require_student

router = APIRouter(prefix="/api/careers", tags=["careers"])


@router.get("/categories", response_model=list[CategoryOut])
def categories(db: Session = Depends(get_db)) -> list[CategoryOut]:
    rows = db.execute(
        select(Career.category, func.count(Career.id)).group_by(Career.category)
    ).all()
    return [CategoryOut(name=name, count=count) for name, count in sorted(rows)]


@router.get("", response_model=list[CareerSummaryOut])
def list_careers(
    search: str | None = Query(default=None, max_length=80),
    category: str | None = Query(default=None, max_length=64),
    theme: str | None = Query(default=None, max_length=48),
    limit: int = Query(default=200, ge=1, le=400),
    db: Session = Depends(get_db),
) -> list[CareerSummaryOut]:
    stmt = select(Career)
    if category:
        stmt = stmt.where(Career.category == category)
    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Career.title).like(pattern),
                func.lower(Career.summary).like(pattern),
                func.lower(Career.category).like(pattern),
            )
        )
    careers = list(db.scalars(stmt.order_by(Career.title).limit(limit)))
    if theme:
        careers = [c for c in careers if theme in (c.interest_themes or [])]
    return [CareerSummaryOut.model_validate(c) for c in careers]


@router.get("/saved", response_model=list[SavedCareerOut])
def saved(
    student_id: int = Depends(require_student), db: Session = Depends(get_db)
) -> list[SavedCareerOut]:
    rows = db.execute(
        select(SavedCareer, Career)
        .join(Career, SavedCareer.career_id == Career.id)
        .where(SavedCareer.student_id == student_id)
        .order_by(SavedCareer.id.desc())
    ).all()
    return [
        SavedCareerOut(
            career=CareerSummaryOut.model_validate(career), saved_at=row.created_at
        )
        for row, career in rows
    ]


@router.get("/{slug}", response_model=CareerOut)
def career_detail(slug: str, db: Session = Depends(get_db)) -> CareerOut:
    career = db.scalars(select(Career).where(Career.slug == slug)).first()
    if career is None:
        raise HTTPException(status_code=404, detail="We could not find that career.")
    return CareerOut.model_validate(career)


@router.post("/{career_id}/save", status_code=201)
def save_career(
    career_id: int,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> dict:
    career = db.get(Career, career_id)
    if career is None:
        raise HTTPException(status_code=404, detail="We could not find that career.")
    existing = db.scalars(
        select(SavedCareer).where(
            SavedCareer.student_id == student_id, SavedCareer.career_id == career_id
        )
    ).first()
    if existing is None:
        db.add(SavedCareer(student_id=student_id, career_id=career_id))
        db.add(
            JourneyEvent(
                student_id=student_id,
                kind="career_saved",
                title=f"Saved {career.title}",
                detail=f"Added {career.category} to your list to explore.",
            )
        )
        db.commit()
        return {"saved": True, "title": career.title}
    return {"saved": False, "title": career.title, "message": "Already in your list."}


@router.delete("/{career_id}/save", status_code=204)
def unsave_career(
    career_id: int,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> None:
    row = db.scalars(
        select(SavedCareer).where(
            SavedCareer.student_id == student_id, SavedCareer.career_id == career_id
        )
    ).first()
    if row is not None:
        db.delete(row)
        db.commit()
