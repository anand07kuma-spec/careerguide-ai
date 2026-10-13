"""Pydantic request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["student", "parent"]
Language = Literal["en", "hi", "hinglish"]
MessageRole = Literal["user", "assistant", "system"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------------------ auth


class OnboardingIn(BaseModel):
    role: Role
    display_name: str = Field(min_length=1, max_length=80)
    preferred_language: Language = "en"
    # student
    class_level: str | None = Field(default=None, max_length=16)
    age_range: str | None = Field(default=None, max_length=16)
    interest_areas: list[str] = Field(default_factory=list, max_length=12)
    # parent
    relationship: str | None = Field(default=None, max_length=32)
    student_name: str | None = Field(default=None, min_length=1, max_length=80)
    student_class_level: str | None = Field(default=None, max_length=16)
    education_context: str | None = Field(default=None, max_length=2000)
    financial_context: str | None = Field(default=None, max_length=2000)
    # consent
    consent_profile: bool = False
    consent_voice: bool = False
    consent_age: Literal["3-5", "6-8", "9-10", "11-12", "adult"] = "6-8"


class SessionOut(BaseModel):
    token: str
    user: "UserOut"
    profile: "ProfileOut | None"
    settings: "SettingsOut"


class UserOut(ORMModel):
    id: int
    role: Role
    display_name: str
    preferred_language: str


class ProfileOut(ORMModel):
    class_level: str | None
    age_range: str | None
    interest_areas: list[str]
    education_context: str | None
    financial_context: str | None


class SettingsOut(ORMModel):
    language: str
    voice: str | None
    speak_responses: bool
    continuous_conversation: bool
    save_history: bool
    reduced_motion: bool
    high_contrast: bool


class SettingsIn(BaseModel):
    language: Language | None = None
    voice: str | None = Field(default=None, max_length=48)
    speak_responses: bool | None = None
    continuous_conversation: bool | None = None
    save_history: bool | None = None
    reduced_motion: bool | None = None
    high_contrast: bool | None = None


class ProfileIn(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    class_level: str | None = Field(default=None, max_length=16)
    age_range: str | None = Field(default=None, max_length=16)
    interest_areas: list[str] | None = Field(default=None, max_length=12)
    # Families may revise these after onboarding; the guide uses them only to
    # prefer affordable routes, and they stay on this profile.
    education_context: str | None = Field(default=None, max_length=2000)
    financial_context: str | None = Field(default=None, max_length=2000)


class ConsentIn(BaseModel):
    scope: Literal["profile", "voice", "history_sharing"]
    granted: bool


class ConsentOut(ORMModel):
    scope: str
    granted: bool
    version: str
    created_at: datetime


class ShareCodeOut(BaseModel):
    code: str | None
    note: str


class LinkChildIn(BaseModel):
    code: str = Field(min_length=4, max_length=12)
    relationship: str | None = Field(default=None, max_length=32)


class GuardianOut(BaseModel):
    guardianship_id: int
    name: str
    relationship: str | None
    can_see_summary: bool
    can_see_transcripts: bool
    linked_at: datetime


class TranscriptSharingIn(BaseModel):
    share_transcripts: bool


# ------------------------------------------------------------------ careers


class CareerSummaryOut(ORMModel):
    id: int
    slug: str
    title: str
    category: str
    summary: str
    interest_themes: list[str]
    min_class: int


class CareerOut(CareerSummaryOut):
    typical_activities: list[str]
    useful_skills: list[str]
    school_subjects: list[str]
    education_pathways: list[str]
    entry_requirements: list[str]
    preparation_stages: list[str]
    typical_day: str | None
    costs_and_alternatives: str | None
    benefits: list[str]
    challenges: list[str]
    explore_activities: list[str]
    official_links: list[dict]
    related_slugs: list[str]
    needs_verification: bool


class CategoryOut(BaseModel):
    name: str
    count: int


class SavedCareerOut(BaseModel):
    career: CareerSummaryOut
    saved_at: datetime


# ------------------------------------------------------------------- chat


class SessionStartIn(BaseModel):
    kind: Literal["chat", "voice"] = "chat"
    # Hinglish is the default opening register for now; the guide then follows
    # whatever the student actually writes in, message by message.
    language: Language = "hinglish"


class SessionOutInfo(ORMModel):
    id: int
    kind: str
    language: str
    stage: int
    status: str
    created_at: datetime
    greeting: str | None = None


class MessageOut(ORMModel):
    id: int
    role: MessageRole
    content: str
    demo_generated: bool
    created_at: datetime


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    speak: bool = False


class ChatOut(BaseModel):
    reply: MessageOut
    stage: int
    audio_url: str | None = None
    audio_error: str | None = None
    detected_themes: list[str] = Field(default_factory=list)
    provider: str
    # The language the reply was written in, so playback and dictation can follow it.
    language: str = "en"
    # What this turn taught the app about the student, already saved to their
    # profile. Onboarding asks one question, so the conversation is where the
    # rest of the picture comes from — and it is shown, not stored silently.
    profile_updates: dict[str, Any] = Field(default_factory=dict)


# ------------------------------------------------------------ interests


class InterestAnswerIn(BaseModel):
    prompt_id: str = Field(max_length=48)
    answer: str = Field(min_length=1, max_length=2000)
    session_id: int | None = None


class ThemeSummary(BaseModel):
    theme: str
    label: str
    blurb: str
    evidence: list[str]
    suggested_categories: list[str]


class InterestSummaryOut(BaseModel):
    themes: list[ThemeSummary]
    note: str


class ObservationOut(ORMModel):
    id: int
    theme: str
    evidence: str
    source: str
    created_at: datetime


# -------------------------------------------------------- recommendations


class RecommendationOut(BaseModel):
    """A live suggestion has no stored row, so the career it points at is its identity."""

    career: CareerSummaryOut
    why: str
    supporting_statements: list[str]
    open_questions: list[str]
    skills_to_try: list[str]
    qualifications_to_check: list[str]
    alternatives: list[str]
    evidence_level: Literal["early", "some", "good"]
    next_activity: str | None


class RecommendationSetOut(BaseModel):
    recommendations: list[RecommendationOut]
    note: str
    themes: list[str]
    named_ambitions: list[str]
    statement_count: int


# -------------------------------------------------------------- journey


class JourneyEventOut(ORMModel):
    id: int
    kind: str
    title: str
    detail: str | None
    created_at: datetime


class JourneyOut(BaseModel):
    events: list[JourneyEventOut]
    sessions_completed: int
    careers_saved: int
    themes_explored: int
    plans_active: int
    activities_completed: int
    activities_total: int


# ------------------------------------------------------------ study plans


class PlanItemOut(ORMModel):
    id: int
    title: str
    detail: str | None
    estimated_effort: str | None
    resource_url: str | None
    status: str
    order: int


class PlanOut(ORMModel):
    id: int
    title: str
    goal: str
    career_id: int | None
    status: str
    created_at: datetime
    items: list[PlanItemOut]


class PlanCreateIn(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    goal: str = Field(min_length=2, max_length=300)
    career_id: int | None = None


class PlanItemCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    detail: str | None = Field(default=None, max_length=1000)
    estimated_effort: str | None = Field(default=None, max_length=48)
    resource_url: str | None = Field(default=None, max_length=400)


class PlanItemStatusIn(BaseModel):
    status: Literal["pending", "in_progress", "completed", "skipped"]


# -------------------------------------------------------------- catalogue


class ResourceOut(ORMModel):
    id: int
    title: str
    kind: str
    category: str
    level: str
    language: str
    description: str
    url: str
    verified: bool
    duration_minutes: int | None


class ScholarshipOut(ORMModel):
    id: int
    name: str
    provider: str
    scope: str
    education_levels: list[str]
    states: list[str]
    categories: list[str]
    benefit_summary: str
    eligibility_summary: str
    application_steps: list[str]
    official_url: str
    verified: bool
    last_verified_at: datetime | None
    disclaimer: str


class InstitutionOut(ORMModel):
    id: int
    name: str
    city: str
    state: str
    institution_type: str
    mode: str
    education_level: str
    career_areas: list[str]
    courses: list[str]
    fee_range: str | None
    admission_info: str | None
    scholarships_note: str | None
    website: str
    verified: bool
    last_verified_at: datetime | None
    sponsored: bool
    sponsorship_disclosure: str | None


# ------------------------------------------------------------------ reports


class ReportOut(BaseModel):
    id: int
    generated_at: datetime
    content: dict


class ParentSummaryOut(BaseModel):
    student: UserOut
    profile: ProfileOut | None
    themes: list[ObservationOut]
    recommendations: list[RecommendationOut]
    saved_careers: list[SavedCareerOut]
    journey: JourneyOut
    latest_report: ReportOut | None
    share_transcripts: bool
    recent_sessions: list[SessionOutInfo]
    guidance_note: str


# -------------------------------------------------------------------- voice


class TTSIn(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    language: Language = "en"
    voice: str | None = Field(default=None, max_length=48)


class VoiceInfoOut(BaseModel):
    voices: list[dict]
    provider: str
    note: str
    default_voice: str


class HealthOut(BaseModel):
    status: str
    ai_provider: str
    ai_configured: bool
    tts_provider: str
    demo_mode: bool


SessionOut.model_rebuild()
ParentSummaryOut.model_rebuild()
