"""Structured, explainable career recommendations."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Career, Recommendation
from ..schemas import CareerSummaryOut, RecommendationOut, RecommendationSetOut
from ..security import require_student
from ..services.recommender import build_recommendations, summary_note

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("", response_model=RecommendationSetOut)
def current(
    student_id: int = Depends(require_student), db: Session = Depends(get_db)
) -> dict:
    payload, signals = build_recommendations(db, student_id, limit=5)
    items: list[dict] = []
    for item in payload:
        items.append(
            {
                "career": CareerSummaryOut.model_validate(item["career"]),
                "why": item["why"],
                "supporting_statements": item["supporting_statements"],
                "open_questions": item["open_questions"],
                "skills_to_try": item["skills_to_try"],
                "qualifications_to_check": item["qualifications_to_check"],
                "alternatives": item["alternatives"],
                "evidence_level": item["evidence_level"],
                "next_activity": item["next_activity"],
            }
        )
    return {
        "recommendations": items,
        "note": summary_note(signals),
        "themes": signals.themes,
        "named_ambitions": signals.named_ambitions,
        "statement_count": len(signals.statements),
    }


@router.post("/persist", response_model=list[RecommendationOut])
def persist(
    student_id: int = Depends(require_student), db: Session = Depends(get_db)
) -> list[RecommendationOut]:
    """Store the current set so a parent view and report can reference it."""
    payload, _ = build_recommendations(db, student_id, limit=5)
    db.execute(delete(Recommendation).where(Recommendation.student_id == student_id))
    for item in payload:
        db.add(
            Recommendation(
                student_id=student_id,
                career_id=item["career_id"],
                why=item["why"],
                supporting_statements=item["supporting_statements"],
                open_questions=item["open_questions"],
                skills_to_try=item["skills_to_try"],
                qualifications_to_check=item["qualifications_to_check"],
                alternatives=item["alternatives"],
                evidence_level=item["evidence_level"],
                next_activity=item["next_activity"],
            )
        )
    db.commit()

    rows = db.execute(
        select(Recommendation, Career)
        .join(Career, Recommendation.career_id == Career.id)
        .where(Recommendation.student_id == student_id)
        .order_by(Recommendation.id)
    ).all()
    return [
        RecommendationOut(
            career=CareerSummaryOut.model_validate(career),
            why=rec.why,
            supporting_statements=rec.supporting_statements or [],
            open_questions=rec.open_questions or [],
            skills_to_try=rec.skills_to_try or [],
            qualifications_to_check=rec.qualifications_to_check or [],
            alternatives=rec.alternatives or [],
            evidence_level=rec.evidence_level,
            next_activity=rec.next_activity,
        )
        for rec, career in rows
    ]
