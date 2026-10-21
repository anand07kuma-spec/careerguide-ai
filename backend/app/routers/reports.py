"""Career reports and the parent-facing view."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Career,
    ConversationSession,
    Guardianship,
    InterestObservation,
    Recommendation,
    SavedCareer,
    StudentProfile,
    User,
)
from ..schemas import (
    CareerSummaryOut,
    JourneyOut,
    ObservationOut,
    ParentSummaryOut,
    ProfileOut,
    RecommendationOut,
    ReportOut,
    SavedCareerOut,
    SessionOutInfo,
    UserOut,
)
from ..security import linked_student_ids, require_parent, require_student, resolve_child
from ..services import entitlements
from ..services import report as report_service
from ..services.recommender import build_recommendations

router = APIRouter(tags=["reports and parenting"])


def _build_report_out(db: Session, student_id: int) -> ReportOut:
    content = report_service.build_report(db, student_id)
    from ..models import CareerReport

    record = CareerReport(student_id=student_id, content=content)
    db.add(record)
    db.commit()
    db.refresh(record)
    return ReportOut(id=record.id, generated_at=record.created_at, content=content)


@router.post("/api/reports", response_model=ReportOut, status_code=201)
def generate_report(
    student_id: int = Depends(require_student), db: Session = Depends(get_db)
) -> ReportOut:
    return _build_report_out(db, student_id)


@router.get("/api/reports/latest", response_model=ReportOut | None)
def latest_report(
    student_id: int = Depends(require_student), db: Session = Depends(get_db)
) -> ReportOut | None:
    from ..models import CareerReport

    record = db.scalars(
        select(CareerReport)
        .where(CareerReport.student_id == student_id, CareerReport.is_deleted.is_(False))
        .order_by(CareerReport.id.desc())
        .limit(1)
    ).first()
    if record is None:
        return None
    return ReportOut(id=record.id, generated_at=record.created_at, content=record.content)


@router.delete("/api/reports/{report_id}", status_code=204)
def delete_report(
    report_id: int,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> None:
    """Deletion is honoured, not just hidden from the caller's own list."""
    from ..models import CareerReport

    record = db.get(CareerReport, report_id)
    if record is None or record.student_id != student_id:
        raise HTTPException(status_code=404, detail="That report could not be found.")
    db.delete(record)
    db.commit()


@router.get("/api/parent/children")
def children(
    parent: User = Depends(require_parent), db: Session = Depends(get_db)
) -> list[dict]:
    # A guardian's view of progress is the paid part of this product (see /pricing).
    # What is *not* gated: a student's own screens, the whole careers catalogue, and
    # every consent and delete control — a family that stops paying loses a view, not
    # control of their data.
    entitlements.guard_feature(db, parent, "parent_dashboard", "The parent dashboard")
    ids = linked_student_ids(db, parent.id)
    out = []
    for student_id in ids:
        student = db.get(User, student_id)
        profile = db.get(StudentProfile, student_id)
        if student is None:
            continue
        out.append(
            {
                "student_id": student_id,
                "label": student.display_name,
                "class_level": profile.class_level if profile else None,
            }
        )
    return out


@router.get("/api/parent/summary", response_model=ParentSummaryOut)
def parent_summary(
    student_id: int = Query(ge=1),
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
) -> ParentSummaryOut:
    entitlements.guard_feature(db, parent, "parent_dashboard", "The parent dashboard")
    # The requested id is checked against this parent's own links, so changing
    # the number in a request cannot reach another family's data.
    child_id = resolve_child(db, parent, student_id)

    student = db.get(User, child_id)
    profile = db.get(StudentProfile, child_id)
    link = db.scalars(
        select(Guardianship).where(
            Guardianship.parent_id == parent.id, Guardianship.student_id == child_id
        )
    ).first()

    observations = list(
        db.scalars(
            select(InterestObservation)
            .where(InterestObservation.student_id == child_id)
            .order_by(InterestObservation.id.desc())
            .limit(20)
        )
    )

    payload, _ = build_recommendations(db, child_id, limit=4)
    recommendations = [
        RecommendationOut(
            career=CareerSummaryOut.model_validate(item["career"]),
            why=item["why"],
            supporting_statements=item["supporting_statements"],
            open_questions=item["open_questions"],
            skills_to_try=item["skills_to_try"],
            qualifications_to_check=item["qualifications_to_check"],
            alternatives=item["alternatives"],
            evidence_level=item["evidence_level"],
            next_activity=item["next_activity"],
        )
        for item in payload
    ]

    saved_rows = db.execute(
        select(SavedCareer, Career)
        .join(Career, SavedCareer.career_id == Career.id)
        .where(SavedCareer.student_id == child_id)
        .order_by(SavedCareer.id.desc())
    ).all()

    sessions = list(
        db.scalars(
            select(ConversationSession)
            .where(ConversationSession.student_id == child_id)
            .order_by(ConversationSession.id.desc())
            .limit(5)
        )
    )

    from ..models import CareerReport, StudyPlan, StudyPlanItem
    from sqlalchemy import func

    plan_ids = list(db.scalars(select(StudyPlan.id).where(StudyPlan.student_id == child_id)))
    total_items = db.execute(
        select(func.count(StudyPlanItem.id)).where(StudyPlanItem.plan_id.in_(plan_ids or [-1]))
    ).scalar() or 0
    done_items = db.execute(
        select(func.count(StudyPlanItem.id)).where(
            StudyPlanItem.plan_id.in_(plan_ids or [-1]), StudyPlanItem.status == "completed"
        )
    ).scalar() or 0

    latest = db.scalars(
        select(CareerReport)
        .where(CareerReport.student_id == child_id, CareerReport.is_deleted.is_(False))
        .order_by(CareerReport.id.desc())
        .limit(1)
    ).first()

    return ParentSummaryOut(
        student=UserOut.model_validate(student),
        profile=ProfileOut.model_validate(profile) if profile else None,
        themes=[ObservationOut.model_validate(o) for o in observations],
        recommendations=recommendations,
        saved_careers=[
            SavedCareerOut(
                career=CareerSummaryOut.model_validate(career), saved_at=row.created_at
            )
            for row, career in saved_rows
        ],
        journey=JourneyOut(
            events=[],
            sessions_completed=sum(1 for s in sessions if s.status == "ended"),
            careers_saved=len(saved_rows),
            themes_explored=len({o.theme for o in observations}),
            plans_active=len(plan_ids),
            activities_completed=int(done_items),
            activities_total=int(total_items),
        ),
        latest_report=ReportOut(
            id=latest.id, generated_at=latest.created_at, content=latest.content
        )
        if latest
        else None,
        share_transcripts=bool(link and link.share_conversation_transcripts),
        recent_sessions=[SessionOutInfo.model_validate(s) for s in sessions],
        guidance_note=(
            "Supporting exploration works better than pushing a decision. Ask what your "
            "child enjoyed about an activity, share your own worries plainly, and keep the "
            "conversation open for as long as it needs. If you disagree with a suggestion "
            "here, that is useful information rather than a problem to fix."
        ),
    )


@router.get("/api/parent/guidance")
def parent_guidance(
    concern: str = Query(min_length=3, max_length=600),
    student_id: int = Query(ge=1),
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
) -> dict:
    """Structured, non-pressuring replies to the worries families actually raise."""
    # Deliberately not gated behind a plan, unlike the dashboard routes above. This is
    # the answer a parent gets when they are worried about a child being pushed into
    # medicine at fourteen; putting that behind a paywall would be charging for help in
    # the one moment the product exists to give it.
    child_id = resolve_child(db, parent, student_id)
    lowered = concern.lower()
    payload, signals = build_recommendations(db, child_id, limit=3)
    titles = [item["career"].title for item in payload]

    if any(word in lowered for word in ("engineer", "doctor", "must become", "only")):
        return {
            "concern": "A preferred path is being insisted on",
            "acknowledgement": "Wanting a stable, respected career for your child comes from care, and that concern is reasonable.",
            "evidence": (
                f"Based on what your child shared, the fields with the most support so far are: {', '.join(titles) or 'not enough information yet'}. "
                "This is an observation from conversations, not a prediction."
            )
            if titles
            else "There is not enough exploration recorded yet to compare anything fairly.",
            "what_remains_unclear": [
                "Whether the preference comes from your child or from family expectation.",
                "What marks, subjects and entrance requirements actually say today.",
            ],
            "routes_and_costs": (
                "Engineering and medicine both have public, low-fee routes and expensive private ones. "
                "Fees, entrance exams and seat availability change yearly, so confirm on official portals."
            ),
            "alternatives": [
                "Government aided colleges, ITI and polytechnic diplomas, and state quota admissions.",
                "Related fields with shorter training, such as engineering technology, nursing, or applied data work.",
            ],
            "low_risk_tests": [
                "Ask your child to spend one weekend on a free intro lesson in each option and describe what they felt.",
                "Meet one working professional in each field before committing to fees.",
            ],
            "discussion_prompt": (
                "Try asking what your child finds enjoyable about a normal day in each field, rather than "
                "which field sounds impressive. Plans can be revised; pressure usually is not."
            ),
            "seek_help_from": (
                "A school counsellor, a teacher who knows the child, or an education officer at a government "
                "institute can help you compare realistically."
            ),
        }

    if any(word in lowered for word in ("fee", "money", "afford", "cost", "loan", "expensive")):
        return {
            "concern": "Cost is the main worry",
            "acknowledgement": "Money worries are real, and planning around them is responsible rather than limiting.",
            "evidence": (
                f"Cost should shape which route you choose, not which interests are allowed. "
                f"Fields your child is exploring: {', '.join(titles) or 'still early'}.",
            )[0],
            "what_remains_unclear": [
                "Exact current fees, and whether income-based concessions apply to your family.",
            ],
            "routes_and_costs": (
                "Government institutions, open and distance learning, skill India programmes, and "
                "need-cum-merit scholarships exist across nearly every field listed here."
            ),
            "alternatives": [
                "Diploma or ITI first, then lateral entry into degree programmes at lower total cost.",
                "Free online learning for the fundamentals before paying for any qualification.",
                "Education loans only after comparing total repayment with expected entry earnings.",
            ],
            "low_risk_tests": [
                "Shortlist three institutions and compare published fee structures side by side.",
                "Check one scholarship on the official National Scholarship Portal with your child.",
            ],
            "discussion_prompt": (
                "Say the budget honestly and invite your child to help solve for it. Children handle "
                "constraints well when they are included rather than protected from the conversation."
            ),
            "seek_help_from": (
                "The scholarship or student-support desk of any shortlisted institution, and the "
                "official National Scholarship Portal. No one should promise you an approval."
            ),
        }

    return {
        "concern": "A general parenting question",
        "acknowledgement": "It is normal to want more certainty before your child commits to anything.",
        "evidence": (
            f"What your child has shared so far points towards: {', '.join(titles) or 'not enough exploration yet'}. "
            "Recommendations here stay provisional until more conversations happen."
        ),
        "what_remains_unclear": [
            "How your child's interest holds up after a few weeks.",
            "Which subjects and exam routes are actually open to them.",
        ],
        "routes_and_costs": "Each career page lists pathways and cost notes, with official links to verify.",
        "alternatives": [
            "Try one free introduction activity per option before deciding.",
            "Keep two or three pathways open rather than narrowing early.",
        ],
        "low_risk_tests": [
            "Ask your child to explain what they did each day for a week; patterns show up faster in a diary than in a quiz.",
        ],
        "discussion_prompt": (
            "Share your own reasoning openly, including what you do not know. It gives your child "
            "permission to think out loud rather than perform certainty."
        ),
        "seek_help_from": "A qualified school counsellor or career educator who works with your child's board and state.",
    }
