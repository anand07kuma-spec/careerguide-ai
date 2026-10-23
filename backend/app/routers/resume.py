"""A student's own resume, and the suggestions that fill it in.

Two routers in one file, because the feature has two faces: the document
(`/api/resume`, read and written by its owner) and the helper that drafts parts of
it (`/api/ai/resume-suggest`, which costs an outside call). `exams.py` already
registers two routers from one module for the same reason — a guard that belongs
to one of them would be noise inside the other.

Nothing here trusts an id in a body. The row is found by the account the session
proved, so "fetch somebody else's resume" needs their session rather than their
number, and the erasure route in `users.py` deletes by the same key.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.rate_limit import resume_limit
from ..models import Resume, User
from ..schemas import (
    ResumeIn,
    ResumeOut,
    ResumeProjectIn,
    ResumeSkillIn,
    ResumeSuggestIn,
    ResumeSuggestionOut,
)
from ..security import get_current_user, require_student
from ..services import resume_suggest
from ..services.language import detect as detect_language

router = APIRouter(prefix="/api/resume", tags=["resume"])
ai_router = APIRouter(prefix="/api/ai", tags=["ai"])


def _row(db: Session, student_id: int) -> Resume | None:
    return db.scalar(select(Resume).where(Resume.user_id == student_id))


def _shape(row: Resume | None) -> ResumeOut:
    """The stored document, or an empty one for a student who has not started.

    A first visit is not a 404: the screen draws the same form either way, and no
    row is written just because somebody opened a page.
    """
    return ResumeOut(
        target_role=row.target_role if row else None,
        education=row.education if row else [],
        skills=row.skills if row else [],
        projects=row.projects if row else [],
        saved_at=row.updated_at if row else None,
    )


@router.get("", response_model=ResumeOut)
def read_resume(
    student_id: int = Depends(require_student), db: Session = Depends(get_db)
) -> ResumeOut:
    return _shape(_row(db, student_id))


@router.post("", response_model=ResumeOut)
def save_resume(
    payload: ResumeIn,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> ResumeOut:
    """Replace the whole document.

    Deliberately not a patch: the screen holds the entire resume on screen at once,
    so sending all of it is both the simplest contract and the one that cannot
    half-save a list the student was editing.
    """
    row = _row(db, student_id)
    if row is None:
        row = Resume(user_id=student_id)
        db.add(row)
    row.target_role = payload.target_role.strip() if payload.target_role else None
    row.education = [entry.model_dump() for entry in payload.education]
    row.skills = [skill.model_dump() for skill in payload.skills]
    row.projects = [project.model_dump() for project in payload.projects]
    db.commit()
    db.refresh(row)
    return _shape(row)


@ai_router.post("/resume-suggest", response_model=ResumeSuggestionOut)
@resume_limit
async def suggest_for_resume(
    request: Request,
    payload: ResumeSuggestIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResumeSuggestionOut:
    """Skills and project ideas for one target role.

    The answer says which of its own sources produced it. `demo_generated` is true
    whenever the suggestions came from this app's career catalogue — no AI provider
    configured, provider unreachable, or provider returned nonsense — and the
    screen has to repeat that back, because a list labelled "AI suggested" when no
    model was consulted is the one thing this project will not print.
    """
    # Checked for the 403 it raises. A parent has no use for a student's CV, and a
    # portal counsellor writing one for a client is a different feature with its
    # own audit trail.
    require_student(user)
    language = payload.language or detect_language(payload.target_role)
    result = await resume_suggest.suggest(db, payload.target_role.strip(), language)
    return ResumeSuggestionOut(
        skills=[ResumeSkillIn(**skill) for skill in result.skills],
        projects=[ResumeProjectIn(**project) for project in result.projects],
        matched_career=result.matched_career,
        provider=result.provider,
        demo_generated=result.demo_generated,
        error=result.error,
    )
