"""My Journey timeline and progress indicators."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    ConversationSession,
    InterestObservation,
    JourneyEvent,
    SavedCareer,
    StudyPlan,
    StudyPlanItem,
)
from ..schemas import JourneyEventOut, JourneyOut
from ..security import require_student

router = APIRouter(prefix="/api/journey", tags=["journey"])


@router.get("/events", response_model=list[JourneyEventOut])
def events(
    # A negative limit is not "no rows" in SQLite — it means no limit at all, so
    # the bounds are checked here rather than clamped after the fact.
    limit: int = Query(default=60, ge=1, le=200),
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[JourneyEventOut]:
    rows = list(
        db.scalars(
            select(JourneyEvent)
            .where(JourneyEvent.student_id == student_id)
            .order_by(JourneyEvent.id.desc())
            .limit(limit)
        )
    )
    return [JourneyEventOut.model_validate(r) for r in rows]


@router.get("", response_model=JourneyOut)
def journey(
    student_id: int = Depends(require_student), db: Session = Depends(get_db)
) -> JourneyOut:
    def count(stmt) -> int:
        return int(db.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0)

    sessions_done = count(
        select(ConversationSession.id).where(
            ConversationSession.student_id == student_id,
            ConversationSession.status == "ended",
        )
    )
    saved = count(
        select(SavedCareer.id).where(SavedCareer.student_id == student_id)
    )
    themes = count(
        select(func.distinct(InterestObservation.theme)).where(
            InterestObservation.student_id == student_id
        )
    )
    plans = count(select(StudyPlan.id).where(StudyPlan.student_id == student_id))
    plan_ids = list(
        db.scalars(select(StudyPlan.id).where(StudyPlan.student_id == student_id))
    )
    total_items = (
        db.execute(
            select(func.count(StudyPlanItem.id)).where(StudyPlanItem.plan_id.in_(plan_ids or [-1]))
        ).scalar()
        or 0
    )
    done_items = (
        db.execute(
            select(func.count(StudyPlanItem.id)).where(
                StudyPlanItem.plan_id.in_(plan_ids or [-1]),
                StudyPlanItem.status == "completed",
            )
        ).scalar()
        or 0
    )

    events_rows = list(
        db.scalars(
            select(JourneyEvent)
            .where(JourneyEvent.student_id == student_id)
            .order_by(JourneyEvent.id.desc())
            .limit(60)
        )
    )

    return JourneyOut(
        events=[JourneyEventOut.model_validate(e) for e in events_rows],
        sessions_completed=sessions_done,
        careers_saved=saved,
        themes_explored=themes,
        plans_active=plans,
        activities_completed=int(done_items),
        activities_total=int(total_items),
    )
