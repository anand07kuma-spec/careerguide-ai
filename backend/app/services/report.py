"""Builds the student career report from stored observations and recommendations.

Everything here is phrased as exploration. The report states what is known,
what is missing, and never claims certainty about a child's future.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import (
    Career,
    ConversationSession,
    InterestObservation,
    SavedCareer,
    StudentProfile,
    User,
)
from . import recommender
from .themes import THEMES

EVIDENCE_COPY = {
    "early": "Early signal. Only one or two things to go on so far.",
    "some": "Some supporting detail from your conversations.",
    "good": "Several of your own statements point this way.",
}


def build_report(db: Session, student_id: int) -> dict:
    signals = recommender.collect_signals(db, student_id)
    recommendations, _ = recommender.build_recommendations(db, student_id, limit=5)

    profile = db.get(StudentProfile, student_id)
    student = db.get(User, student_id)

    observations = list(
        db.scalars(
            select(InterestObservation)
            .where(InterestObservation.student_id == student_id)
            .order_by(InterestObservation.id.desc())
            .limit(40)
        )
    )

    themes_observed = [
        {
            "theme": theme,
            "label": THEMES[theme]["label"],
            "blurb": THEMES[theme]["blurb"],
            "evidence": [o.evidence for o in observations if o.theme == theme][:3],
        }
        for theme in signals.themes
        if theme in THEMES
    ]

    sessions = list(
        db.scalars(
            select(ConversationSession)
            .where(ConversationSession.student_id == student_id)
            .order_by(ConversationSession.id.desc())
            .limit(10)
        )
    )

    # execute().all() because a two-entity select yields (SavedCareer, Career) rows;
    # db.scalars() would hand back only the first entity and break the unpacking below.
    saved = list(
        db.execute(
            select(SavedCareer, Career)
            .join(Career, SavedCareer.career_id == Career.id)
            .where(SavedCareer.student_id == student_id)
            .limit(10)
        ).all()
    )

    missing: list[str] = []
    if not signals.themes:
        missing.append("We have not yet heard what you enjoy doing in your free time.")
    if not signals.named_ambitions:
        missing.append("You have not named a career you are curious about, so options stay broad.")
    if len(sessions) < 2:
        missing.append("One more conversation would help confirm whether these interests hold.")
    if not (profile and (profile.education_context or profile.financial_context)):
        missing.append("Nothing is known about subject choices or family constraints, which real decisions depend on.")

    return {
        "student": {
            "name": student.display_name if student else "",
            "class_level": profile.class_level if profile else None,
            "language": student.preferred_language if student else "en",
        },
        "framing": (
            "This report describes what a student has said they are interested in. "
            "It is not an aptitude test, and it does not predict a career."
        ),
        "note": recommender.summary_note(signals),
        "themes_observed": themes_observed,
        "activities_enjoyed": signals.statements[:8],
        "named_ambitions": signals.named_ambitions,
        "recommendations": [
            {
                "career_id": item["career_id"],
                "career": item["career"].title,
                "category": item["career"].category,
                "why": item["why"],
                "supporting_statements": item["supporting_statements"],
                "open_questions": item["open_questions"],
                "skills_to_try": item["skills_to_try"],
                "qualifications_to_check": item["qualifications_to_check"],
                "alternatives": item["alternatives"],
                "evidence_level": item["evidence_level"],
                "evidence_note": EVIDENCE_COPY[item["evidence_level"]],
                "next_activity": item["next_activity"],
            }
            for item in recommendations
        ],
        "saved_careers": [{"id": c.id, "title": c.title, "category": c.category} for _, c in saved],
        "suggested_experiments": _experiments(recommendations),
        "next_steps": [
            "Pick one field above and spend thirty minutes finding out what the work is really like.",
            "Talk to a teacher or someone already working in a field that interests you.",
            "Check entry requirements and fees on an official website before believing any summary, including this one.",
            "Revisit this report after a few more explorations and change anything that no longer fits.",
        ],
        "financial_resources_to_verify": (
            "Scholarship and fee details shown anywhere in CareerGuide AI must be confirmed on "
            "official government or institution portals before you rely on them."
        ),
        "unanswered_questions": missing,
        "sessions_reviewed": len(sessions),
    }


def _experiments(recommendations: list[dict]) -> list[str]:
    out: list[str] = []
    for item in recommendations[:3]:
        activity = item.get("next_activity")
        if activity:
            out.append(activity)
    if not out:
        out.append(
            "Choose any topic you were curious about this week and spend twenty minutes "
            "on one free lesson about it. Notice whether the time felt short."
        )
    return out
