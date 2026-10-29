"""The three questionnaires: start, autosave answers, submit, read the result.

Ownership is resolved from the bearer token on every route, so a substituted
session id in a request reaches nothing — a sitting that is not yours answers 404,
exactly like one that never existed.

The age limit is enforced here rather than hidden in the interface: a student whose
profile still says class 4 — one of the rows written before this app served only
classes 6 to 12 — is not served a set because a screen forgot to hide it.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..config import get_settings
from ..middleware.rate_limit import answer_limit, assessment_limit, roadmap_limit
from ..models import (
    Assessment,
    Career,
    JourneyEvent,
    Question,
    Response,
    Result,
    StudentProfile,
    User,
    utcnow,
)
from ..schemas import (
    AssessmentQuestionOut,
    AssessmentResultOut,
    AssessmentStartIn,
    AssessmentSubmitIn,
    QuestionResponseIn,
    SittingOut,
)
from ..security import get_current_user, require_student
from ..services import assessment_bank, email_jobs, entitlements, roadmap, scoring
from ..services.themes import THEMES

router = APIRouter(prefix="/api/assessments", tags=["assessments"])

INSTRUMENT_NAMES = "interest, personality and aptitude"

NOT_SUBMITTED = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="This assessment is already finished. Open the result instead of answering again.",
)

NO_BANK = HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    detail="The question bank could not be loaded, so no assessment can be started right now.",
)

TOO_YOUNG = (
    "This questionnaire is written for older students. Your guide and the interest "
    "conversation are not age-gated — use those instead."
)


def _language(value: str) -> str:
    """Hinglish reads the English items inside Hindi interface text; unknown is English."""
    return value if value in assessment_bank.ITEM_LANGUAGES else "en"


def _class_number(class_level: str | None) -> int | None:
    raw = (class_level or "").replace("class-", "")
    return int(raw) if raw.isdigit() and 1 <= int(raw) <= 12 else None


def _meta(assessment_type: str) -> dict:
    try:
        return assessment_bank.instrument(assessment_type)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"There is no such assessment. This app offers {INSTRUMENT_NAMES}.",
        ) from None


def _own(db: Session, assessment_id: int, student_id: int) -> Assessment:
    row = db.get(Assessment, assessment_id)
    if row is None or row.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That assessment does not belong to this account, or it is no longer here.",
        )
    return row


def _bank(db: Session, assessment_type: str) -> list[Question]:
    assessment_bank.ensure_bank(db)
    rows = assessment_bank.questions_for(db, assessment_type)
    if not rows:
        raise NO_BANK
    return rows


def _for_scoring(row: Question) -> dict:
    """The bank shape the scorer needs, answer key included — it never leaves here."""
    return {
        "code": row.code,
        "dimension": row.dimension,
        "response_type": row.response_type,
        "keyed": row.keyed,
        "options_json": row.options_json or [],
        "correct_value": row.correct_value,
    }


def _client_view(row: Question, language: str) -> AssessmentQuestionOut:
    return AssessmentQuestionOut(
        code=row.code,
        text=row.text_hi if language == "hi" else row.text_en,
        response_type=row.response_type,  # type: ignore[arg-type]
        options=[
            {
                "value": option["value"],
                "label": option["label"].get(language) or option["label"]["en"],
            }
            for option in (row.options_json or [])
        ]
        if row.response_type == "choice"
        else [],
    )


def _answered_codes(db: Session, assessment_id: int) -> dict[str, str]:
    return {
        row.code: row.value
        for row in db.scalars(select(Response).where(Response.assessment_id == assessment_id))
    }


def _career_suggestions(
    db: Session, themes: list[str], class_number: int | None, limit: int = 5
) -> list[dict]:
    """Match the result's themes against the catalogue the app already ships."""
    if not themes:
        return []
    ranked: list[tuple[int, Career, list[str]]] = []
    for career in db.scalars(select(Career)):
        if class_number and career.min_class > class_number:
            continue
        hits = [theme for theme in (career.interest_themes or []) if theme in themes]
        if hits:
            ranked.append((len(hits), career, hits))
    ranked.sort(key=lambda entry: (-entry[0], entry[1].title))

    out: list[dict] = []
    for _, career, hits in ranked[:limit]:
        out.append(
            {
                "slug": career.slug,
                "title": career.title,
                "category": career.category,
                "needs_verification": career.needs_verification,
                # The names the career matched on, not a finished sentence: the
                # page assembles the line in the language the student reads in,
                # because these labels are already in its own dictionary.
                "matched": [
                    THEMES[theme]["label"] for theme in hits[:2] if theme in THEMES
                ],
            }
        )
    return out


def _career_note(language: str) -> str:
    if language == "hi":
        return (
            "ये सुझाव ऐप के अपने कैटलॉग से हैं — 55 करियर का सैंपल डेटा, जिसे आधिकारिक स्रोतों "
            "से जाँचा नहीं गया है। किसी के बारे में योजना बनाने से पहले फ़ीस, प्रवेश शर्तें और काम "
            "की असली भूमिका खुद पुष्टि करें।"
        )
    return (
        "These suggestions come from the app's own catalogue — sample data on 55 careers that has "
        "not been checked against official sources. Verify fees, entry requirements and what the "
        "work actually involves before planning around any of them."
    )


def result_payload(
    db: Session, result: Result, language: str, note: str | None = None
) -> AssessmentResultOut:
    assessment = db.get(Assessment, result.assessment_id)
    scored = result.score_json or {}
    traits = scoring.traits(result.assessment_type, language, scored)
    profile = db.get(StudentProfile, result.user_id)
    return AssessmentResultOut(
        result_id=result.id,
        assessment_id=result.assessment_id,
        assessment_type=result.assessment_type,
        name=scoring.pick(assessment_bank.instrument(result.assessment_type)["name"], language),
        item_language=_language(assessment.language if assessment else "en"),
        completed_at=result.completed_at,
        scores=scored.get("dimensions", {}),
        traits=traits,
        top_traits=[entry for entry in traits if entry["score"] is not None][:5],
        totals=scored.get("totals", {}),
        themes=list((result.detail_json or {}).get("themes", [])),
        careers=_career_suggestions(db, list((result.detail_json or {}).get("themes", [])), _class_number(profile.class_level if profile else None)),
        career_note=_career_note(language),
        caveats=scoring.caveats(result.assessment_type, language),
        roadmap=roadmap.render(result.roadmap_json, language),
        roadmap_ai_available=get_settings().ai_configured,
        roadmap_note=note,
    )


@router.get("/history", response_model=list[SittingOut])
def history(
    language: str = Query(default="en", max_length=16),
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[SittingOut]:
    """Every questionnaire this account has finished, newest first.

    The catalogue gives one sitting per instrument — the one to continue. A profile
    screen needs the opposite: all of them, including the second time the same
    questionnaire was taken, each with the `result_id` that opens it. The name comes
    back in the language the page is being read in; `language` says which language
    the questions themselves were asked in.
    """
    chosen = _language(language)
    rows = list(
        db.scalars(
            select(Result)
            .where(Result.user_id == student_id)
            .order_by(Result.completed_at.desc(), Result.id.desc())
        )
    )
    out: list[SittingOut] = []
    for result in rows:
        totals = (result.score_json or {}).get("totals", {})
        out.append(
            SittingOut(
                result_id=result.id,
                assessment_id=result.assessment_id,
                assessment_type=result.assessment_type,
                name=scoring.pick(
                    assessment_bank.instrument(result.assessment_type)["name"], chosen
                ),
                # The language the questions were asked in lives on the sitting, not
                # on the result — the result only ever records what was scored.
                language=_language(result.assessment.language),
                completed_at=result.completed_at,
                answered=int(totals.get("answered", 0)),
                total=int(totals.get("items", 0)),
            )
        )
    return out


@router.get("")
def catalogue(
    language: str = Query(default="en", max_length=16),
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> dict:
    """The three instruments, each with this student's most recent sitting."""
    chosen = _language(language)
    assessment_bank.ensure_bank(db)
    profile = db.get(StudentProfile, student_id)
    class_number = _class_number(profile.class_level if profile else None)

    latest: dict[str, Assessment] = {}
    for row in db.scalars(
        select(Assessment).where(Assessment.user_id == student_id).order_by(Assessment.id)
    ):
        latest[row.assessment_type] = row

    instruments: list[dict] = []
    for assessment_type, meta in assessment_bank.instruments().items():
        row = latest.get(assessment_type)
        available = class_number is None or class_number >= meta["min_class"]
        instruments.append(
            {
                "type": assessment_type,
                "name": scoring.pick(meta["name"], chosen),
                "blurb": scoring.pick(meta["blurb"], chosen),
                "minutes": meta["minutes"],
                "min_class": meta["min_class"],
                "item_count": len(assessment_bank.items(assessment_type)),
                "available": available,
                "reason": (
                    ""
                    if available
                    else (
                        f"यह सेट कक्षा {meta['min_class']} और उससे बड़ों के लिए लिखा गया है।"
                        if chosen == "hi"
                        else f"This set is written for class {meta['min_class']} and above."
                    )
                ),
                "latest": (
                    None
                    if row is None
                    else {
                        "assessment_id": row.id,
                        "status": row.status,
                        "started_at": row.started_at,
                        "completed_at": row.completed_at,
                        "result_id": row.result.id if row.result else None,
                    }
                ),
            }
        )

    return {
        "instruments": instruments,
        "note": scoring.pick(assessment_bank.note(), chosen),
        "language": chosen,
    }


@router.post("/{assessment_type}/start")
@assessment_limit
def start(
    request: Request,
    assessment_type: str,
    payload: AssessmentStartIn,
    user: User = Depends(get_current_user),
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> dict:
    meta = _meta(assessment_type)
    chosen = _language(payload.language)
    profile = db.get(StudentProfile, student_id)
    class_number = _class_number(profile.class_level if profile else None)
    if class_number is not None and class_number < meta["min_class"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=TOO_YOUNG)

    questions = _bank(db, assessment_type)

    existing = db.scalars(
        select(Assessment)
        .where(
            Assessment.user_id == student_id,
            Assessment.assessment_type == assessment_type,
            Assessment.status == "in_progress",
        )
        .order_by(Assessment.id.desc())
    ).first()
    if existing is not None:
        if existing.language != chosen:
            # Answers are stored by item code, so switching the wording language
            # part-way through a sitting loses nothing.
            existing.language = chosen
            db.commit()
        return {
            "assessment_id": existing.id,
            "resumed": True,
            "language": existing.language,
            "status": existing.status,
            "item_count": len(questions),
        }

    # A new sitting is where an allowance is spent, so this is checked only after the
    # resume branch above has returned: a student halfway through the one questionnaire
    # their plan includes can always come back and finish it.
    entitlements.guard_assessment_start(db, user)

    row = Assessment(
        user_id=student_id,
        assessment_type=assessment_type,
        language=chosen,
        bank_version=assessment_bank.version(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "assessment_id": row.id,
        "resumed": False,
        "language": row.language,
        "status": row.status,
        "item_count": len(questions),
    }


@router.get("/session/{assessment_id}/questions")
def questions(
    assessment_id: int,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> dict:
    row = _own(db, assessment_id, student_id)
    chosen = _language(row.language)
    meta = assessment_bank.instrument(row.assessment_type)
    items = _bank(db, row.assessment_type)
    return {
        "assessment_id": row.id,
        "assessment_type": row.assessment_type,
        "language": chosen,
        "status": row.status,
        "completed_at": row.completed_at,
        "result_id": row.result.id if row.result else None,
        "name": scoring.pick(meta["name"], chosen),
        "caveat": scoring.pick(meta["caveat"], chosen),
        "scale": (
            [
                {
                    "value": entry["value"],
                    "label": entry["label"].get(chosen) or entry["label"]["en"],
                }
                for entry in assessment_bank.scale()
            ]
            if meta["response"] == "likert"
            else []
        ),
        "answered": _answered_codes(db, row.id),
        "items": [_client_view(item, chosen) for item in items],
    }


@router.post("/session/{assessment_id}/answer")
@answer_limit
def answer(
    request: Request,
    assessment_id: int,
    payload: QuestionResponseIn,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> dict:
    row = _own(db, assessment_id, student_id)
    if row.status == "submitted":
        raise NOT_SUBMITTED

    question = db.scalars(
        select(Question).where(
            Question.assessment_type == row.assessment_type, Question.code == payload.code
        )
    ).first()
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="That question is not part of this assessment.",
        )

    value = payload.value.strip()
    if question.response_type == "choice":
        allowed = {str(option["value"]) for option in (question.options_json or [])}
        valid = value in allowed
    else:
        valid = value.isdigit() and scoring.LIKERT_MIN <= int(value) <= scoring.LIKERT_MAX
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "That option is not one of the choices for this question."
                if question.response_type == "choice"
                else "Choose one of the five answers on the scale."
            ),
        )

    saved = db.scalars(
        select(Response).where(Response.assessment_id == row.id, Response.code == payload.code)
    ).first()
    if saved is None:
        db.add(
            Response(assessment_id=row.id, question_id=question.id, code=payload.code, value=value)
        )
    else:
        saved.value = value
    db.commit()

    return {
        "saved": True,
        "code": payload.code,
        "value": value,
        "answered": int(
            db.scalar(select(func.count()).select_from(Response).where(Response.assessment_id == row.id))
            or 0
        ),
        "item_count": len(assessment_bank.items(row.assessment_type)),
    }


@router.post("/session/{assessment_id}/submit")
@assessment_limit
def submit(
    request: Request,
    assessment_id: int,
    payload: AssessmentSubmitIn | None = None,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> AssessmentResultOut:
    row = _own(db, assessment_id, student_id)
    language = _language(payload.language if payload and payload.language else row.language)

    if row.result is not None:
        # Submitting twice is a reload, not a second attempt: the first result stands.
        return result_payload(db, row.result, language)

    answers = _answered_codes(db, row.id)
    if not answers:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "Nothing has been answered yet, so there is nothing to score. Answer a few "
                "questions, or leave this and come back another day."
            ),
        )

    scored = scoring.score_items([_for_scoring(item) for item in _bank(db, row.assessment_type)], answers)
    totals = scored["totals"]
    themes = scoring.career_themes(row.assessment_type, scored)
    profile = db.get(StudentProfile, student_id)
    # The plan is written here, in the same transaction as the scores it reads, and by
    # the app's own rules rather than by a model: a result that arrives with an empty
    # plan card is a result the student has to work again to understand, and a model
    # that is down would make this page depend on somebody else's uptime. The ✨ button
    # on the card is the one that asks a model, and it is the student's own click.
    plan = roadmap.plan_for(
        db,
        assessment_type=row.assessment_type,
        scored=scored,
        themes=themes,
        class_number=_class_number(profile.class_level if profile else None),
    )
    result = Result(
        assessment_id=row.id,
        user_id=student_id,
        assessment_type=row.assessment_type,
        score_json=scored,
        traits_json=[entry["dimension"] for entry in scoring.traits(row.assessment_type, "en", scored)],
        detail_json={"themes": themes},
        roadmap_json=plan or {},
    )
    db.add(result)
    row.status = "submitted"
    row.completed_at = utcnow()
    db.add(
        JourneyEvent(
            student_id=student_id,
            kind="assessment",
            title=f"Completed the {row.assessment_type} questionnaire",
            detail=f"{totals['answered']} of {totals['items']} questions answered.",
        )
    )
    db.commit()
    db.refresh(result)
    # The copy an account asked for, if it asked. Row first, send second: a student
    # who agreed to result mails gets a retry from the queue when the service is
    # unreachable, and a student who never agreed gets a row that closes itself as
    # `skipped` on the first attempt. Neither outcome can lose a result — this route
    # has already returned one by the time the mail is tried.
    email_jobs.try_now(
        db, email_jobs.enqueue(db, student_id, "email_result", ref_id=result.id)
    )
    return result_payload(db, result, language)


@router.get("/result/{result_id}")
def result(
    result_id: int,
    language: str = Query(default="", max_length=16),
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> AssessmentResultOut:
    row = db.get(Result, result_id)
    if row is None or row.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That result does not belong to this account, or it has been deleted.",
        )
    assessment = db.get(Assessment, row.assessment_id)
    return result_payload(db, row, _language(language or (assessment.language if assessment else "en")))


@router.post("/result/{result_id}/roadmap")
@roadmap_limit
async def rebuild_roadmap(
    request: Request,
    result_id: int,
    language: str = Query(default="", max_length=16),
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> AssessmentResultOut:
    """Ask the configured model to rewrite this result's plan. A POST because it
    spends an outside call and replaces a document the student may have printed; the
    whole answer is the fresh result payload, so the page re-renders from one round
    trip rather than reading back a row it already has.

    Ownership is the same rule as reading a result: a substituted id reaches a 404,
    not somebody else's plan. And a failure is not a blank page — the rules plan that
    was already there stays saved and the response carries the one true sentence
    about why it did not change.
    """
    row = db.get(Result, result_id)
    if row is None or row.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That result does not belong to this account, or it has been deleted.",
        )
    assessment = db.get(Assessment, row.assessment_id)
    chosen = _language(language or (assessment.language if assessment else "en"))

    if not (row.roadmap_json or {}):
        # A sitting from before the plan existed, or one whose answers matched no
        # career. Write the rules version first: it is what the model's answer is
        # built from, and it is what stays if the model cannot be reached.
        profile = db.get(StudentProfile, student_id)
        row.roadmap_json = (
            roadmap.plan_for(
                db,
                assessment_type=row.assessment_type,
                scored=row.score_json or {},
                themes=list((row.detail_json or {}).get("themes", [])),
                class_number=_class_number(profile.class_level if profile else None),
            )
            or {}
        )
        db.commit()

    plan, note = await roadmap.plan_with_ai(row, chosen)
    if plan is not None:
        row.roadmap_json = plan
        db.commit()
    return result_payload(db, row, chosen, note=note)
