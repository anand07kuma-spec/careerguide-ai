"""SQLAlchemy models. Only fields the product actually needs are stored."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
)
from sqlalchemy import JSON as _JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# Generic JSON keeps working on SQLite (stored as TEXT); hosted Postgres gets
# JSONB so the columns stay indexable there.
JSON = _JSON().with_variant(JSONB, "postgresql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """SQLite drops tzinfo on read, which makes aware/naive comparisons crash.

    Store every timestamp as naive UTC and hand it back as aware UTC so the API
    always emits an offset and the browser shows the right relative time.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


# ---------------------------------------------------------------- auth & people


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(16))  # student | parent
    display_name: Mapped[str] = mapped_column(String(80))
    preferred_language: Mapped[str] = mapped_column(String(8), default="en")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    profile: Mapped[StudentProfile | None] = relationship(uselist=False)
    settings: Mapped[UserSettings | None] = relationship(uselist=False)


class AuthToken(Base, TimestampMixin):
    __tablename__ = "auth_tokens"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)


class StudentProfile(Base, TimestampMixin):
    __tablename__ = "student_profiles"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    class_level: Mapped[str | None] = mapped_column(String(16))  # e.g. "class-9"
    age_range: Mapped[str | None] = mapped_column(String(16))
    board: Mapped[str | None] = mapped_column(String(32))
    # A short code the student chooses to hand to a parent. Revocable, and the
    # only way a second account can ever attach itself to this profile.
    share_code: Mapped[str | None] = mapped_column(String(12), unique=True)
    interest_areas: Mapped[list] = mapped_column(JSON, default=list)
    # Optional, freely supplied by a parent. Never required.
    education_context: Mapped[str | None] = mapped_column(Text)
    financial_context: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="profile")


class Guardianship(Base, TimestampMixin):
    """Links a parent account to a student account they may support."""

    __tablename__ = "guardianships"
    __table_args__ = (UniqueConstraint("parent_id", "student_id", name="uq_guard"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    relationship: Mapped[str | None] = mapped_column(String(32))
    # Parents only see what the student chose to share, plus summary data.
    share_conversation_transcripts: Mapped[bool] = mapped_column(Boolean, default=False)


class ConsentRecord(Base, TimestampMixin):
    __tablename__ = "consent_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    scope: Mapped[str] = mapped_column(String(48))  # profile | voice | history_sharing
    granted: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[str] = mapped_column(String(16), default="1")
    note: Mapped[str | None] = mapped_column(Text)


class UserSettings(Base, TimestampMixin):
    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    language: Mapped[str] = mapped_column(String(8), default="hinglish")
    voice: Mapped[str | None] = mapped_column(String(48))
    speak_responses: Mapped[bool] = mapped_column(Boolean, default=True)
    continuous_conversation: Mapped[bool] = mapped_column(Boolean, default=True)
    save_history: Mapped[bool] = mapped_column(Boolean, default=True)
    reduced_motion: Mapped[bool] = mapped_column(Boolean, default=False)
    high_contrast: Mapped[bool] = mapped_column(Boolean, default=False)


# --------------------------------------------------------------- conversations


class ConversationSession(Base, TimestampMixin):
    __tablename__ = "conversation_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(8), default="chat")  # chat | voice
    language: Mapped[str] = mapped_column(String(8), default="en")
    stage: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(16), default="active")
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    messages: Mapped[list[Message]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="Message.id"
    )


class Message(Base, TimestampMixin):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("conversation_sessions.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(10))  # user | assistant | system
    content: Mapped[str] = mapped_column(Text)
    demo_generated: Mapped[bool] = mapped_column(Boolean, default=False)

    session: Mapped[ConversationSession] = relationship(back_populates="messages")


class InterestObservation(Base, TimestampMixin):
    """An exploratory theme, never a diagnosis or aptitude score."""

    __tablename__ = "interest_observations"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("conversation_sessions.id", ondelete="SET NULL")
    )
    theme: Mapped[str] = mapped_column(String(48))
    evidence: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(16), default="conversation")


# ---------------------------------------------------------------- career data


class Career(Base, TimestampMixin):
    __tablename__ = "careers"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(64), index=True)
    summary: Mapped[str] = mapped_column(Text)
    typical_activities: Mapped[list] = mapped_column(JSON, default=list)
    useful_skills: Mapped[list] = mapped_column(JSON, default=list)
    school_subjects: Mapped[list] = mapped_column(JSON, default=list)
    education_pathways: Mapped[list] = mapped_column(JSON, default=list)
    entry_requirements: Mapped[list] = mapped_column(JSON, default=list)
    preparation_stages: Mapped[list] = mapped_column(JSON, default=list)
    typical_day: Mapped[str | None] = mapped_column(Text)
    costs_and_alternatives: Mapped[str | None] = mapped_column(Text)
    benefits: Mapped[list] = mapped_column(JSON, default=list)
    challenges: Mapped[list] = mapped_column(JSON, default=list)
    explore_activities: Mapped[list] = mapped_column(JSON, default=list)
    official_links: Mapped[list] = mapped_column(JSON, default=list)
    related_slugs: Mapped[list] = mapped_column(JSON, default=list)
    interest_themes: Mapped[list] = mapped_column(JSON, default=list)
    min_class: Mapped[int] = mapped_column(Integer, default=3)
    needs_verification: Mapped[bool] = mapped_column(Boolean, default=True)


class SavedCareer(Base, TimestampMixin):
    __tablename__ = "saved_careers"
    __table_args__ = (
        UniqueConstraint("student_id", "career_id", name="uq_saved_career"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    career_id: Mapped[int] = mapped_column(ForeignKey("careers.id", ondelete="CASCADE"))


class Recommendation(Base, TimestampMixin):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    career_id: Mapped[int] = mapped_column(ForeignKey("careers.id", ondelete="CASCADE"))
    why: Mapped[str] = mapped_column(Text)
    supporting_statements: Mapped[list] = mapped_column(JSON, default=list)
    open_questions: Mapped[list] = mapped_column(JSON, default=list)
    skills_to_try: Mapped[list] = mapped_column(JSON, default=list)
    qualifications_to_check: Mapped[list] = mapped_column(JSON, default=list)
    alternatives: Mapped[list] = mapped_column(JSON, default=list)
    evidence_level: Mapped[str] = mapped_column(String(16), default="early")
    next_activity: Mapped[str | None] = mapped_column(Text)


# ------------------------------------------------------------------- learning


class StudyPlan(Base, TimestampMixin):
    __tablename__ = "study_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(120))
    goal: Mapped[str] = mapped_column(Text)
    career_id: Mapped[int | None] = mapped_column(
        ForeignKey("careers.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(16), default="active")

    items: Mapped[list[StudyPlanItem]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="StudyPlanItem.order",
    )


class StudyPlanItem(Base, TimestampMixin):
    __tablename__ = "study_plan_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(
        ForeignKey("study_plans.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String(160))
    detail: Mapped[str | None] = mapped_column(Text)
    estimated_effort: Mapped[str | None] = mapped_column(String(48))
    resource_url: Mapped[str | None] = mapped_column(String(400))
    status: Mapped[str] = mapped_column(String(16), default="pending")
    order: Mapped[int] = mapped_column(Integer, default=0)

    plan: Mapped[StudyPlan] = relationship(back_populates="items")


class JourneyEvent(Base, TimestampMixin):
    __tablename__ = "journey_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(160))
    detail: Mapped[str | None] = mapped_column(Text)


class Resource(Base, TimestampMixin):
    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(32))  # tutorial|video|project|book|portal
    category: Mapped[str] = mapped_column(String(64), index=True)
    level: Mapped[str] = mapped_column(String(24), default="beginner")
    language: Mapped[str] = mapped_column(String(8), default="en")
    description: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(String(500))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)


class Scholarship(Base, TimestampMixin):
    __tablename__ = "scholarships"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    provider: Mapped[str] = mapped_column(String(120))
    scope: Mapped[str] = mapped_column(String(16), default="national")  # central|state|institution
    education_levels: Mapped[list] = mapped_column(JSON, default=list)
    states: Mapped[list] = mapped_column(JSON, default=list)
    categories: Mapped[list] = mapped_column(JSON, default=list)
    benefit_summary: Mapped[str] = mapped_column(Text)
    eligibility_summary: Mapped[str] = mapped_column(Text)
    application_steps: Mapped[list] = mapped_column(JSON, default=list)
    official_url: Mapped[str] = mapped_column(String(500))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    disclaimer: Mapped[str] = mapped_column(Text, default="")


class Institution(Base, TimestampMixin):
    __tablename__ = "institutions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    city: Mapped[str] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(60))
    institution_type: Mapped[str] = mapped_column(String(24))  # public|private|aided
    mode: Mapped[str] = mapped_column(String(16), default="offline")
    education_level: Mapped[str] = mapped_column(String(32), default="undergraduate")
    career_areas: Mapped[list] = mapped_column(JSON, default=list)
    courses: Mapped[list] = mapped_column(JSON, default=list)
    fee_range: Mapped[str | None] = mapped_column(Text)
    admission_info: Mapped[str | None] = mapped_column(Text)
    scholarships_note: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str] = mapped_column(String(400))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    sponsored: Mapped[bool] = mapped_column(Boolean, default=False)
    sponsorship_disclosure: Mapped[str | None] = mapped_column(Text)


class CareerReport(Base, TimestampMixin):
    __tablename__ = "career_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    content: Mapped[dict] = mapped_column(JSON, default=dict)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
