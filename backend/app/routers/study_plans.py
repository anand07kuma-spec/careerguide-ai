"""Study and skill plans: editable, free-resource friendly milestones."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Career, JourneyEvent, StudyPlan, StudyPlanItem
from ..schemas import PlanCreateIn, PlanItemCreateIn, PlanItemOut, PlanItemStatusIn, PlanOut
from ..security import require_student

router = APIRouter(prefix="/api/study-plans", tags=["study-plans"])

# Beginner routes that do not assume any purchase.
GOAL_TEMPLATES: dict[str, list[dict]] = {
    "default": [
        {"title": "Find out what the field is really like", "detail": "Spend thirty minutes reading or watching how practitioners describe an ordinary working day, not the highlights.", "estimated_effort": "1 session"},
        {"title": "Try one small hands-on activity", "detail": "Pick the simplest version of the work and finish it. Notice which part held your attention.", "estimated_effort": "2-3 hours over a week"},
        {"title": "Talk to someone doing it", "detail": "Ask a teacher, relative, or local professional what they like and dislike about the work.", "estimated_effort": "1 conversation"},
        {"title": "Check the real requirements", "detail": "Look up subjects, exams, and fees on an official website and write down anything unclear.", "estimated_effort": "1 hour"},
        {"title": "Decide whether to go deeper", "detail": "Based on the above, choose to continue, switch to a related field, or park it and revisit later.", "estimated_effort": "anytime"},
    ],
}


def _plan_items_for(career: Career | None) -> list[dict]:
    if career is None:
        return GOAL_TEMPLATES["default"]
    items: list[dict] = []
    for activity in (career.explore_activities or [])[:2]:
        items.append(
            {
                "title": activity[:150],
                "detail": f"A first look at {career.title}, chosen so you can try it before committing to anything.",
                "estimated_effort": "1-2 hours",
            }
        )
    for skill in (career.useful_skills or [])[:2]:
        items.append(
            {
                "title": f"Get comfortable with {skill.lower()}",
                "detail": "Free lessons and practice are enough at this stage. No paid course is needed to find out if you like it.",
                "estimated_effort": "2-4 weeks, lightly",
            }
        )
    items.extend(GOAL_TEMPLATES["default"][-2:])
    return items


@router.get("", response_model=list[PlanOut])
def list_plans(
    student_id: int = Depends(require_student), db: Session = Depends(get_db)
) -> list[PlanOut]:
    plans = list(
        db.scalars(
            select(StudyPlan)
            .where(StudyPlan.student_id == student_id)
            .order_by(StudyPlan.id.desc())
        )
    )
    return [PlanOut.model_validate(p) for p in plans]


@router.post("", response_model=PlanOut, status_code=201)
def create_plan(
    payload: PlanCreateIn,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> PlanOut:
    career = db.get(Career, payload.career_id) if payload.career_id else None
    title = payload.title or (f"Exploring {career.title}" if career else "My next exploration")
    plan = StudyPlan(student_id=student_id, title=title[:120], goal=payload.goal[:300], career_id=payload.career_id)
    db.add(plan)
    db.flush()

    for order, item in enumerate(_plan_items_for(career)):
        db.add(
            StudyPlanItem(
                plan_id=plan.id,
                title=item["title"][:160],
                detail=item.get("detail"),
                estimated_effort=item.get("estimated_effort"),
                resource_url=item.get("resource_url"),
                order=order,
            )
        )
    db.add(
        JourneyEvent(
            student_id=student_id,
            kind="plan_created",
            title=f"Started a plan: {title[:80]}",
            detail=payload.goal[:200],
        )
    )
    db.commit()
    db.refresh(plan)
    return PlanOut.model_validate(plan)


@router.get("/{plan_id}", response_model=PlanOut)
def get_plan(
    plan_id: int,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> PlanOut:
    return PlanOut.model_validate(_owned_plan(db, plan_id, student_id))


def _owned_plan(db: Session, plan_id: int, student_id: int) -> StudyPlan:
    plan = db.get(StudyPlan, plan_id)
    if plan is None or plan.student_id != student_id:
        raise HTTPException(status_code=404, detail="That plan could not be found.")
    return plan


@router.post("/{plan_id}/items", response_model=PlanItemOut, status_code=201)
def add_item(
    plan_id: int,
    payload: PlanItemCreateIn,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> PlanItemOut:
    plan = _owned_plan(db, plan_id, student_id)
    item = StudyPlanItem(
        plan_id=plan.id,
        title=payload.title[:160],
        detail=payload.detail,
        estimated_effort=payload.estimated_effort,
        resource_url=payload.resource_url,
        order=len(plan.items),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return PlanItemOut.model_validate(item)


@router.patch("/{plan_id}/items/{item_id}", response_model=PlanItemOut)
def set_item_status(
    plan_id: int,
    item_id: int,
    payload: PlanItemStatusIn,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> PlanItemOut:
    plan = _owned_plan(db, plan_id, student_id)
    item = db.get(StudyPlanItem, item_id)
    if item is None or item.plan_id != plan.id:
        raise HTTPException(status_code=404, detail="That step could not be found.")
    item.status = payload.status
    if payload.status == "completed":
        db.add(
            JourneyEvent(
                student_id=student_id,
                kind="activity_completed",
                title=f"Completed: {item.title[:100]}",
                detail=plan.title,
            )
        )
    db.commit()
    db.refresh(item)
    return PlanItemOut.model_validate(item)


@router.delete("/{plan_id}/items/{item_id}", status_code=204)
def delete_item(
    plan_id: int,
    item_id: int,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> None:
    plan = _owned_plan(db, plan_id, student_id)
    item = db.get(StudyPlanItem, item_id)
    if item is not None and item.plan_id == plan.id:
        db.delete(item)
        db.commit()


@router.delete("/{plan_id}", status_code=204)
def delete_plan(
    plan_id: int,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> None:
    plan = _owned_plan(db, plan_id, student_id)
    db.delete(plan)
    db.commit()
