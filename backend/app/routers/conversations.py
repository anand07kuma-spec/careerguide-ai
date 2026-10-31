"""Chat and voice conversation sessions."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
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

log = logging.getLogger(__name__)

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


@dataclass
class TurnSetup:
    """Everything about a turn that is decided before the guide is called.

    Both the answering route and the streaming route get one from `_prepare_turn`, so the
    rules a child's conversation runs under are written exactly once: whose session this
    is, whether it is still open, whether the plan allows another message, what language
    the student just used, what their words teach the profile, and which plan a result
    page pinned to this chat. A second copy of that list is how a stream ends up skipping
    one of them, and a stream that skips one is a way into another child's conversation.

    `history` and `ctx` are plain data by the time they are stored here — no database
    access happens while the reply is being streamed, which is what lets the streaming
    route outlive the request that started it.
    """

    student_id: int
    session_id: int
    language: str
    text: str
    learned: dict[str, Any]
    ctx: ai_provider.GuideContext
    history: list[Message]
    speak: bool
    voice: str


def _prepare_turn(
    db: Session, user: User, session_id: int, payload: ChatIn
) -> tuple[TurnSetup, ConversationSession]:
    """Run every guard, then build what the guide needs to answer.

    Returns the session too, for the route that stores the reply on this same database
    connection. The streaming route must not use it: FastAPI closes `get_db` before the
    response body is produced, so that session is gone by the first fragment.
    """
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

    return (
        TurnSetup(
            student_id=student_id,
            session_id=session.id,
            language=session.language,
            text=text,
            learned=learned,
            ctx=ctx,
            history=history,
            # Read here rather than at the end of a stream, when the settings row this
            # object came from no longer has a connection to read through.
            speak=payload.speak and settings.speak_responses,
            voice=settings.voice,
        ),
        session,
    )


def _store_reply(
    db: Session, session: ConversationSession, turn: TurnSetup, reply: ai_provider.GuideReply
) -> tuple[Message, list[str]]:
    """Write the guide's answer, once, and say which themes it noticed.

    Both routes call this, so a streamed answer cannot be stored under different rules
    from an answered one: the same stage advance, the same one observation per new
    theme, the same safety note that records a concern without quoting the child.
    """
    answer = Message(
        session_id=session.id,
        role="assistant",
        content=reply.text,
        demo_generated=reply.demo_generated,
    )
    db.add(answer)
    session.stage = reply.stage

    new_themes = _persist_observations(db, turn.student_id, session.id, turn.text, reply.themes)

    if reply.safety_flag:
        db.add(
            JourneyEvent(
                student_id=turn.student_id,
                kind="safety_note",
                title="A safety concern came up",
                detail="The guide shared child-safety contact information. No conversation content is stored beyond the messages.",
            )
        )

    db.commit()
    db.refresh(answer)
    return answer, new_themes


def _chat_out(
    session: ConversationSession,
    turn: TurnSetup,
    reply: ai_provider.GuideReply,
    answer: Message,
    new_themes: list[str],
    audio_url: str | None,
    audio_error: str | None,
) -> ChatOut:
    """The body both routes hand back — `done` on a stream, the response otherwise."""
    return ChatOut(
        reply=MessageOut.model_validate(answer),
        stage=session.stage,
        audio_url=audio_url,
        audio_error=audio_error,
        detected_themes=new_themes,
        needs_support=reply.safety_flag,
        provider=reply.provider,
        language=session.language,
        profile_updates=turn.learned,
    )


@router.post("/{session_id}/messages", response_model=ChatOut)
@chat_limit
async def send_message(
    request: Request,
    session_id: int,
    payload: ChatIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatOut:
    turn, session = _prepare_turn(db, user, session_id, payload)

    reply = await ai_provider.respond(turn.text, turn.ctx, turn.history, db)

    db.add(Message(session_id=session.id, role="user", content=turn.text[:2000]))
    answer, new_themes = _store_reply(db, session, turn, reply)

    audio_url = None
    audio_error = None
    if turn.speak:
        try:
            audio_url = await tts.synthesize(reply.text, session.language, turn.voice)
        except tts.TTSError as exc:
            audio_error = str(exc)

    return _chat_out(session, turn, reply, answer, new_themes, audio_url, audio_error)


def _sse(event: str, data: dict) -> str:
    """One `text/event-stream` frame.

    `ensure_ascii=False` so a Hindi reply leaves this server as Hindi; the frames are
    UTF-8 and a client that had to decode `\\u0905` would be reading an escape rather
    than the words a child is watching arrive.
    """
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# Both sentences are written for a parent reading the screen over a child's shoulder,
# and both say what happened to the child's own words, because that is the thing a
# failed send makes you wonder about.
CUT_SHORT_MESSAGE = (
    "The guide's reply stopped partway. What it managed to say is kept, and nothing you "
    "wrote has been lost — send it again when you are ready."
)
STREAM_FAILED_MESSAGE = (
    "The guide could not finish answering just now. Nothing you wrote has been lost — "
    "please send it again."
)


async def _stream_turn(turn: TurnSetup, question_id: int) -> AsyncIterator[str]:
    """Produce the body of a streamed reply: `meta`, then `delta`s, then `done`.

    The database session is this generator's own, and it has to be: FastAPI closes the
    session the route was handed before the response body starts being written, so by
    the first fragment there is nothing to write through. One reply, stored once at the
    end, is what that buys — storing per fragment would put a half-finished sentence in
    a child's transcript every time the model pauses.
    """
    db = SessionLocal()
    try:
        # The guards have all passed by now (they run before this generator exists), so
        # this frame is the answer to "did my message reach the right conversation?".
        yield _sse(
            "meta",
            {
                "session_id": turn.session_id,
                # The student's own message: the guide's row cannot have an id before
                # its words exist, and `done` carries that one in full.
                "message_id": question_id,
                "language": turn.language,
            },
        )

        reply: ai_provider.GuideReply | None = None
        try:
            async for chunk in ai_provider.stream_respond(turn.text, turn.ctx, turn.history):
                if chunk.text:
                    yield _sse("delta", {"text": chunk.text})
                if chunk.reply is not None:
                    reply = chunk.reply
        except Exception:  # noqa: BLE001
            # A bug or a lost connection inside the guide must not reach the student as
            # a stream that quietly stops; it reaches them as the sentence below.
            log.exception("streamed reply failed for session %s", turn.session_id)
            yield _sse("error", {"code": "failed", "message": STREAM_FAILED_MESSAGE})
            return

        if reply is None:
            yield _sse("error", {"code": "failed", "message": STREAM_FAILED_MESSAGE})
            return

        session = db.get(ConversationSession, turn.session_id)
        if session is None:
            # The conversation was cleared or the account deleted mid-reply. There is no
            # thread left to write into, and inventing one would put words somewhere a
            # child never asked for them.
            yield _sse("error", {"code": "failed", "message": STREAM_FAILED_MESSAGE})
            return

        # Stored once, here — including the partway reply below, because words a child
        # has already read belong in their transcript even when the sentence never
        # finished.
        try:
            answer, new_themes = _store_reply(db, session, turn, reply)
        except Exception:  # noqa: BLE001
            log.exception("could not store the streamed reply for session %s", turn.session_id)
            yield _sse("error", {"code": "failed", "message": STREAM_FAILED_MESSAGE})
            return

        if reply.partial:
            yield _sse("error", {"code": "cut_short", "message": CUT_SHORT_MESSAGE})
            return

        audio_url = None
        audio_error = None
        if turn.speak:
            try:
                audio_url = await tts.synthesize(reply.text, session.language, turn.voice)
            except tts.TTSError as exc:
                audio_error = str(exc)

        out = _chat_out(session, turn, reply, answer, new_themes, audio_url, audio_error)
        yield _sse("done", out.model_dump(mode="json"))
    finally:
        db.close()


@router.post("/{session_id}/messages/stream")
@chat_limit
async def send_message_stream(
    request: Request,
    session_id: int,
    payload: ChatIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Answer a turn as it is written, so the first words arrive inside a second.

    Four events, and a client written for them works against a streaming model, a model
    that ignores `stream`, and the built-in guide alike, because `stream_respond` keeps
    the same shape for all three:

      * `meta`  — `{session_id, message_id, language}`, after every guard has passed;
      * `delta` — `{text}`, one fragment of the guide's reply;
      * `done`  — the complete `ChatOut`, the same body the non-streaming route returns;
      * `error` — `{code, message}`, one sentence a family can read.

    The guards are the non-streaming route's own (`_prepare_turn`), and so is the chat
    throttle: this address is a write, and it is counted as one. What a second URL must
    not be able to buy is the day's allowance, and it cannot — `entitlements.guard_chat`
    counts the child's stored messages, whichever address stored them. A stream that
    skipped any of the guards would be a way into another child's conversation, which is
    why the tests prove each one.
    """
    turn, session = _prepare_turn(db, user, session_id, payload)

    # The student's question is stored — with the profile facts it taught — before the
    # first fragment goes out. A reply that never arrives must not take their message
    # with it, and `meta` has to name a message that really exists.
    question = Message(session_id=session.id, role="user", content=turn.text[:2000])
    db.add(question)
    db.commit()
    db.refresh(question)

    return StreamingResponse(
        _stream_turn(turn, question.id),
        # `no-transform` and `X-Accel-Buffering` both exist for the same reason: a proxy
        # that helpfully waits for the whole body would make this route answer exactly as
        # slowly as the one it replaced.
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
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
