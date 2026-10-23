"""Chat and voice conversation sessions."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.rate_limit import chat_limit
from ..models import (
    ConsentRecord,
    ConversationSession,
    InterestObservation,
    JourneyEvent,
    Message,
    Result,
    StudentProfile,
    User,
    UserSettings,
)
from ..schemas import (
    ChatIn,
    ChatOut,
    MessageOut,
    SessionOutInfo,
    SessionStartIn,
)
from ..security import ensure_settings, get_current_user, require_student
from ..services import ai_provider, entitlements, profile_facts, roadmap, tts
from ..services.language import detect as detect_language
from ..services.recommender import build_recommendations
from .auth import CLASS_TO_AGE

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

GREETING = {
    "en": "Hi! I'm your AI career guide. We can talk about school, hobbies, or anything you are curious about. There are no right or wrong answers. What would you like to talk about today?",
    "hi": "नमस्ते! मैं आपका AI करियर गाइड हूँ। हम स्कूल, शौक या जिस भी चीज़ में आपकी जिज्ञासा है उसके बारे में बात कर सकते हैं। यहाँ कोई सही या गलत जवाब नहीं है। आज आप किस बारे में बात करना चाहेंगे?",
    "hinglish": "Hi! Main tumhara AI career guide hoon. Hum school, hobbies, ya jo bhi tumhe interesting lage uske baare mein baat kar sakte hain. Koi right ya wrong answer nahi hai. Aaj kis cheez ke baare mein baat karna hai?",
}


def _voice_consent_ok(db: Session, user_id: int) -> bool:
    record = db.scalars(
        select(ConsentRecord).where(
            ConsentRecord.user_id == user_id,
            ConsentRecord.scope == "voice",
            ConsentRecord.granted.is_(True),
        )
    ).first()
    return record is not None


def _load_session(db: Session, session_id: int, student_id: int) -> ConversationSession:
    session = db.get(ConversationSession, session_id)
    # Ownership is checked here so a substituted id cannot read another child's chat.
    if session is None or session.student_id != student_id:
        raise HTTPException(status_code=404, detail="That conversation could not be found.")
    return session


@router.post("", response_model=SessionOutInfo, status_code=201)
@chat_limit
def start_session(
    request: Request,
    payload: SessionStartIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SessionOutInfo:
    student_id = require_student(user)
    if payload.kind == "voice" and not _voice_consent_ok(db, user.id):
        raise HTTPException(
            status_code=403,
            detail=(
                "Voice sessions need permission for microphone use. You can enable it in "
                "Settings and privacy, or keep using text chat."
            ),
        )

    session = ConversationSession(
        student_id=student_id, kind=payload.kind, language=payload.language, stage=1
    )
    db.add(session)
    db.flush()
    db.add(
        Message(
            session_id=session.id,
            role="assistant",
            content=GREETING.get(payload.language, GREETING["en"]),
            demo_generated=True,
        )
    )
    db.commit()
    db.refresh(session)
    out = SessionOutInfo.model_validate(session)
    out.greeting = GREETING.get(payload.language, GREETING["en"])
    return out


@router.post("/{session_id}/messages", response_model=ChatOut)
@chat_limit
async def send_message(
    request: Request,
    session_id: int,
    payload: ChatIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatOut:
    student_id = require_student(user)
    session = _load_session(db, session_id, student_id)
    settings = ensure_settings(db, user.id)

    if session.status != "active":
        raise HTTPException(
            status_code=409, detail="This conversation has ended. Please start a new one."
        )

    text = payload.message.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Please write or say something first.")

    # The plan limit, and it is checked here rather than in the browser because a
    # child's remaining chats are a server fact. Inside the guard, before any counting,
    # is the rule that matters more than the money: words that read as a disclosure of
    # danger are answered whatever plan the student is on.
    entitlements.guard_chat(db, user, text)

    # Answer in the language the student just used, not the one the session
    # started in: switching between English and Hindi mid-call is normal, and the
    # session language also chooses the text-to-speech voice.
    spoken = detect_language(text)
    if spoken != session.language:
        session.language = spoken

    profile_user = db.get(User, student_id)
    profile = db.get(StudentProfile, student_id)
    history = list(session.messages)

    # Onboarding asks a single question, so a fact the student states here fills
    # the gap in its place. Only empty fields are written, the values are normal
    # fixed descriptions rather than the student's own words, and a class or age
    # is trusted only when the message reads as an answer or clearly says who it
    # is about — see profile_facts.
    current_profile = {
        "class_level": profile.class_level if profile else None,
        "age": profile.age if profile else None,
        "age_range": profile.age_range if profile else None,
        "education_context": profile.education_context if profile else None,
        "financial_context": profile.financial_context if profile else None,
    }
    learned = profile_facts.applicable_facts(text, current_profile)
    if profile and learned:
        for key, value in learned.items():
            setattr(profile, key, value)
        if "age" in learned:
            # The number they just spoke outranks a band an earlier class answer
            # implied, which is the same rule the profile route follows.
            profile.age_range = profile_facts.band_for_age(learned["age"])
        elif "class_level" in learned and not profile.age_range:
            profile.age_range = CLASS_TO_AGE.get(learned["class_level"])

    # The plan the button on a result page sent them here with, if this message came
    # with one. Owned by this student or the request is refused — a plan is somebody's
    # scores written down, and reading a stranger's would be the same mistake as
    # reading their result, which `GET /api/assessments/result/{id}` already refuses.
    plan_note: str | None = None
    if payload.plan_of is not None:
        planned = db.scalar(
            select(Result).where(Result.id == payload.plan_of, Result.user_id == student_id)
        )
        if planned is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "There is no plan by that number on your account, so the guide was not "
                    "shown one. Your result may have been deleted — the questionnaire can be "
                    "taken again, and a new plan comes with it."
                ),
            )
        rendered = roadmap.render(planned.roadmap_json, session.language)
        # A result from before the plan existed, or one whose answers were too scattered to
        # aim a plan at, has nothing to hand over. The chat continues as an ordinary chat.
        plan_note = roadmap.guide_note(rendered) if rendered else None

    ctx = ai_provider.GuideContext(
        name=profile_user.display_name if profile_user else "friend",
        language=session.language,
        class_level=profile.class_level if profile else None,
        age_range=profile.age_range if profile else None,
        stage=session.stage,
        known_themes=_known_themes(db, student_id),
        career_suggestions=_suggestion_titles(db, student_id),
        next_activity=None,
        plan_note=plan_note,
        missing_facts=profile_facts.missing_facts(
            profile.class_level if profile else None,
            profile.age_range if profile else None,
            profile.education_context if profile else None,
            profile.financial_context if profile else None,
        ),
        asked_facts=profile_facts.asked_keys(history),
    )

    reply = await ai_provider.respond(text, ctx, history, db)

    db.add(
        Message(session_id=session.id, role="user", content=text[:2000])
    )
    db.add(
        Message(
            session_id=session.id,
            role="assistant",
            content=reply.text,
            demo_generated=reply.demo_generated,
        )
    )
    session.stage = reply.stage

    new_themes = _persist_observations(db, student_id, session.id, text, reply.themes)

    if reply.safety_flag:
        db.add(
            JourneyEvent(
                student_id=student_id,
                kind="safety_note",
                title="A safety concern came up",
                detail="The guide shared child-safety contact information. No conversation content is stored beyond the messages.",
            )
        )

    db.commit()

    audio_url = None
    audio_error = None
    if payload.speak and settings.speak_responses:
        try:
            audio_url = await tts.synthesize(reply.text, session.language, settings.voice)
        except tts.TTSError as exc:
            audio_error = str(exc)

    assistant_message = (
        db.scalars(
            select(Message)
            .where(Message.session_id == session.id, Message.role == "assistant")
            .order_by(Message.id.desc())
            .limit(1)
        )
        .first()
    )

    return ChatOut(
        reply=MessageOut.model_validate(assistant_message),
        stage=session.stage,
        audio_url=audio_url,
        audio_error=audio_error,
        detected_themes=new_themes,
        needs_support=reply.safety_flag,
        provider=reply.provider,
        language=session.language,
        profile_updates=learned,
    )


def _known_themes(db: Session, student_id: int) -> list[str]:
    rows = list(
        db.scalars(
            select(InterestObservation.theme)
            .where(InterestObservation.student_id == student_id)
            .distinct()
        )
    )
    return [r for r in rows if r]


def _suggestion_titles(db: Session, student_id: int) -> list[str]:
    recommendations, _ = build_recommendations(db, student_id, limit=3)
    return [item["career"].title for item in recommendations]


def _persist_observations(
    db: Session, student_id: int, session_id: int, text: str, themes: list[str]
) -> list[str]:
    """Store only the newest themes so evidence is not duplicated."""
    already = set(_known_themes(db, student_id))
    added: list[str] = []
    quote = text.strip()[:280]
    for theme in themes:
        if theme in already:
            continue
        db.add(
            InterestObservation(
                student_id=student_id,
                session_id=session_id,
                theme=theme,
                evidence=quote,
                source="conversation",
            )
        )
        added.append(theme)
    if added:
        db.add(
            JourneyEvent(
                student_id=student_id,
                kind="interest_noted",
                title="Noticed a new interest theme",
                detail=", ".join(added),
            )
        )
    return added


@router.get("/{session_id}/messages", response_model=list[MessageOut])
def get_messages(
    session_id: int,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[MessageOut]:
    session = _load_session(db, session_id, student_id)
    return [MessageOut.model_validate(m) for m in session.messages]


@router.post("/{session_id}/end", response_model=SessionOutInfo)
def end_session(
    session_id: int,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> SessionOutInfo:
    session = _load_session(db, session_id, student_id)
    if session.status == "active":
        session.status = "ended"
        session.ended_at = datetime.now(timezone.utc)
        db.add(
            JourneyEvent(
                student_id=student_id,
                kind="session_completed",
                title=f"Completed a {session.kind} exploration",
                detail=f"Conversation reached stage {session.stage} of 7.",
            )
        )
        if not ensure_settings(db, student_id).save_history:
            # "Don't keep my conversations" must actually mean that,
            # so the transcript is removed once the conversation closes.
            for message in list(session.messages):
                db.delete(message)
        db.commit()
        db.refresh(session)
    return SessionOutInfo.model_validate(session)


@router.post("/{session_id}/clear", status_code=204)
def clear_session(
    session_id: int,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> None:
    """Delete the transcript. The student stays signed in."""
    session = _load_session(db, session_id, student_id)
    for message in list(session.messages):
        db.delete(message)
    session.status = "cleared"
    db.commit()


@router.get("", response_model=list[SessionOutInfo])
def list_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> list[SessionOutInfo]:
    rows = list(
        db.scalars(
            select(ConversationSession)
            .where(ConversationSession.student_id == student_id)
            .order_by(ConversationSession.id.desc())
            .limit(limit)
        )
    )
    return [SessionOutInfo.model_validate(r) for r in rows]
