"""Pydantic request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Role = Literal["student", "parent"]
Language = Literal["en", "hi", "hinglish"]
MessageRole = Literal["user", "assistant", "system"]

# The browser makes this itself (a UUID), so it is digits, letters and dashes and
# nothing that could break a log line or a quote.
DEVICE_ID_PATTERN = r"^[A-Za-z0-9_-]{16,64}$"

# A member of a list a student sends (interest areas, mostly) is bounded too: twelve
# items of any length is still twelve chances to store a megabyte of paste.
ShortText = Annotated[str, StringConstraints(min_length=1, max_length=48)]

# The classes this app has content for. One pattern, so onboarding, the profile patch
# and the frontend's picker cannot drift apart — and so a class-4 answer is refused by
# the server instead of being stored quietly by a screen that forgot to hide it.
CLASS_LEVEL_PATTERN = r"^class-(?:[6-9]|1[0-2])$"
ClassLevel = Annotated[str | None, Field(pattern=CLASS_LEVEL_PATTERN)]


class StrictIn(BaseModel):
    """A request body carries only the fields this API documents.

    An unexpected field is refused, not ignored. Silently dropping `role`, `user_id`
    or `share_code` from a body is the habit that turns into a privilege bug the day
    a route reads that name off the object it was handed.
    """

    model_config = ConfigDict(extra="forbid")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------------------ auth


class OnboardingIn(StrictIn):
    role: Role
    display_name: str = Field(min_length=1, max_length=80)
    preferred_language: Language = "en"
    # student
    class_level: ClassLevel = None
    age_range: str | None = Field(default=None, max_length=16)
    interest_areas: list[ShortText] = Field(default_factory=list, max_length=12)
    # parent
    relationship: str | None = Field(default=None, max_length=32)
    student_name: str | None = Field(default=None, min_length=1, max_length=80)
    student_class_level: ClassLevel = None
    education_context: str | None = Field(default=None, max_length=2000)
    financial_context: str | None = Field(default=None, max_length=2000)
    # consent
    consent_profile: bool = False
    consent_voice: bool = False
    consent_age: Literal["3-5", "6-8", "9-10", "11-12", "adult"] = "6-8"
    # The device that is asking, so this account can be found again without a
    # password. Optional: an account made before this existed simply has none.
    device_id: str | None = Field(default=None, pattern=DEVICE_ID_PATTERN)


class SessionOut(BaseModel):
    # Still in the body beside the cookie. The cookie is what a browser keeps, and this is
    # what a browser that will not accept a cross-site cookie keeps for the length of the
    # page — Safari refuses exactly the pair this site is deployed as (one `.vercel.app`
    # serving the page, another serving the API), and without this fallback nobody would
    # stay signed in there. The frontend holds it in memory and never writes it to storage.
    token: str
    user: "UserOut"
    profile: "ProfileOut | None"
    settings: "SettingsOut"
    # Present only in the one response that mints a fresh code. The server keeps
    # just a salted digest, so a code can never be read back out afterwards.
    comeback_code: str | None = None


class RefreshOut(BaseModel):
    """The answer to extending a session: when it now ends, and whether that moved.

    `extended` is the part a screen has to be able to read. Once a session reaches the
    ceiling for the sign-in that started it, every later refresh answers `false` and the
    app says so in words, rather than rolling a credential that was supposed to stop.
    """

    expires_at: datetime
    extended: bool
    session_started_at: datetime | None = None


class GuestIn(StrictIn):
    device_id: str = Field(pattern=DEVICE_ID_PATTERN)


class GuestOut(BaseModel):
    """Whether this device has been here before, and the session if it has.

    An unknown device is not a failure: it is a new student, who then answers the
    one question onboarding asks.
    """

    known: bool
    session: SessionOut | None = None


class LoginIn(StrictIn):
    code: str = Field(min_length=5, max_length=40)
    # This browser's own id, so signing in with a code once means the device is the
    # account afterwards rather than a code to type again. Optional: a client with no
    # usable storage signs in exactly as it did before and keeps the session it is given.
    device_id: str | None = Field(default=None, pattern=DEVICE_ID_PATTERN)


class ComebackCodeOut(BaseModel):
    code: str
    note: str


class ComebackStatusOut(BaseModel):
    has_code: bool
    note: str


class UserOut(ORMModel):
    id: int
    role: Role
    display_name: str
    preferred_language: str


class ProfileOut(ORMModel):
    class_level: str | None
    age: int | None
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


class SettingsIn(StrictIn):
    language: Language | None = None
    voice: str | None = Field(default=None, max_length=48)
    speak_responses: bool | None = None
    continuous_conversation: bool | None = None
    save_history: bool | None = None
    reduced_motion: bool | None = None
    high_contrast: bool | None = None


class ProfileIn(StrictIn):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    class_level: ClassLevel = None
    # The age in years, typed. `age_range` stays for a row that predates it or that
    # only ever had a band; writing an age re-derives the band server-side, so a
    # client cannot claim to be 14 and sit in the 3-to-5 band at the same time.
    # Same bounds as `AGE_MIN`/`AGE_MAX` in `services/profile_facts.py`, which is
    # where a spoken age is read out of a sentence.
    age: int | None = Field(default=None, ge=3, le=99)
    age_range: str | None = Field(default=None, max_length=16)
    interest_areas: list[ShortText] | None = Field(default=None, max_length=12)
    # Families may revise these after onboarding; the guide uses them only to
    # prefer affordable routes, and they stay on this profile.
    education_context: str | None = Field(default=None, max_length=2000)
    financial_context: str | None = Field(default=None, max_length=2000)


class ConsentIn(StrictIn):
    # The two email scopes sit in the same list on purpose: "mail me a result" and
    # "mail me every week" are separate decisions, and reaching them through the
    # consent endpoint the app already has is what stops a settings screen from
    # quietly bundling them into one switch.
    scope: Literal[
        "profile", "voice", "history_sharing", "email_result", "email_digest"
    ]
    granted: bool


class EmailAddressIn(StrictIn):
    # The ceiling is the RFC's own. `ShortText` is not used here, because a legal
    # address is longer than the 80 characters that type allows elsewhere.
    address: str = Field(min_length=3, max_length=254)


class EmailTokenIn(StrictIn):
    token: str = Field(min_length=20, max_length=64)


class EmailStateOut(BaseModel):
    """Everything the settings screen has to say honestly about mail.

    `enabled` is the deployment's answer rather than the account's: a screen that
    shows two switches without mentioning a missing key lets a person believe they
    have switched something on.
    """

    address: str | None
    confirmed: bool
    pending_confirmation: bool
    purposes: dict[str, bool]
    enabled: bool
    note: str


class EmailConfirmOut(BaseModel):
    confirmed: bool
    note: str


class ParentInviteIn(StrictIn):
    # One field, and it is the whole request: an address to put a link in. There is
    # no "relationship" here because there is nothing that would use it — the message
    # names the student, and a label typed for "how is this person related to you"
    # would be a detail about a child that no template ever shows.
    address: str = Field(min_length=3, max_length=254)


class MailOut(BaseModel):
    """One request to send something, described as it actually ended.

    Three answers, not one boolean, because there are three different endings a
    family deserves different sentences for: it went, it is queued and may still
    fail, and it was refused. `reason` is a word from the service — `disabled`,
    `no-address`, `not-agreed`, `sent`, `queued`, `duplicate` — so the screen can
    pick a translation instead of showing a log line.
    """

    delivered: bool
    queued: bool
    reason: str
    note: str


class ConsentOut(ORMModel):
    scope: str
    granted: bool
    version: str
    created_at: datetime


class ShareCodeOut(BaseModel):
    code: str | None
    note: str


class LinkChildIn(StrictIn):
    code: str = Field(min_length=4, max_length=12)
    relationship: str | None = Field(default=None, max_length=32)


class GuardianOut(BaseModel):
    guardianship_id: int
    name: str
    relationship: str | None
    can_see_summary: bool
    can_see_transcripts: bool
    linked_at: datetime


class TranscriptSharingIn(StrictIn):
    share_transcripts: bool


# ------------------------------------------------------- Clerk (the optional account)


class ClerkSessionIn(StrictIn):
    """The Clerk session token of the account being attached, or being used to enter.

    It is a credential, never a claim of identity: the server hands it to Clerk and
    takes the user id from Clerk's answer. A request that named a user id directly
    would let anyone attach any Clerk account to any student record they could
    reach, which is the one thing this app must not do for a child's answers.
    """

    session: str = Field(min_length=20, max_length=8192)


class ClerkStatusOut(BaseModel):
    """Whether *this* account has an email sign-in, and whether this deployment offers one."""

    linked: bool
    linked_at: datetime | None = None
    available: bool
    note: str


class SittingOut(BaseModel):
    """One finished questionnaire, as the profile page lists them."""

    result_id: int
    assessment_id: int
    assessment_type: str
    name: str
    language: str
    completed_at: datetime
    answered: int
    total: int


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
    source_url: str | None
    verified_at: datetime | None


class CategoryOut(BaseModel):
    name: str
    count: int


class SavedCareerOut(BaseModel):
    career: CareerSummaryOut
    saved_at: datetime


# ------------------------------------------------------------------- chat


class SessionStartIn(StrictIn):
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


class ChatIn(StrictIn):
    message: str = Field(min_length=1, max_length=2000)
    speak: bool = False
    # Set only when the student opened this chat from the "discuss this plan" button on a
    # result: the id of that result, which the route checks belongs to this student before
    # the guide is told anything about it. Left out for every other message, so a plan is
    # never quietly carried into an unrelated conversation.
    plan_of: int | None = Field(default=None, ge=1)


class ChatOut(BaseModel):
    reply: MessageOut
    stage: int
    audio_url: str | None = None
    audio_error: str | None = None
    detected_themes: list[str] = Field(default_factory=list)
    provider: str
    # The guide already decided whether this message sounds like a child asking for
    # help, so the reply carries that verdict: a second request that fails would
    # otherwise decide whether the helpline card appears.
    needs_support: bool = False
    # The language the reply was written in, so playback and dictation can follow it.
    language: str = "en"
    # What this turn taught the app about the student, already saved to their
    # profile. Onboarding asks one question, so the conversation is where the
    # rest of the picture comes from — and it is shown, not stored silently.
    profile_updates: dict[str, Any] = Field(default_factory=dict)


# ------------------------------------------------------------ interests


class InterestAnswerIn(StrictIn):
    prompt_id: str = Field(max_length=48)
    answer: str = Field(min_length=1, max_length=2000)
    session_id: int | None = Field(default=None, ge=1)


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


class PlanCreateIn(StrictIn):
    title: str | None = Field(default=None, max_length=120)
    goal: str = Field(min_length=2, max_length=300)
    career_id: int | None = Field(default=None, ge=1)


class PlanItemCreateIn(StrictIn):
    title: str = Field(min_length=1, max_length=160)
    detail: str | None = Field(default=None, max_length=1000)
    estimated_effort: str | None = Field(default=None, max_length=48)
    # A link a student pastes becomes a clickable `<a href>` on their own plan, so
    # only a web address may be stored here: `javascript:` or `data:` text in an href
    # would run whatever was pasted, inside this site's page.
    resource_url: str | None = Field(default=None, max_length=400, pattern=r"(?i)^https?://")


class PlanItemStatusIn(StrictIn):
    status: Literal["pending", "in_progress", "completed", "skipped"]


# ---------------------------------------------------------------- the resume
#
# Every list on a resume is bounded twice over — by length and by count — because
# the whole document arrives as one body and lands in one JSON column. Twelve
# projects of two hundred characters is a normal student; twelve projects of sixty
# thousand is a way to make this table the largest one in the database.
#
# The two text caps are set from the widest thing this app is asked to store in them,
# measured rather than guessed: the career catalogue's verified skills run to 56
# characters and its explore-activities to 142, and those sentences are what the
# suggester offers a student to adopt. Cutting "Ask a doctor you know…" off mid-word to
# fit a shorter field would damage the one text here that somebody already checked by
# hand, so the fields clear the measured maximum with room for a student's own longer
# phrasing. The counts are what bound the document as a whole.


class ResumeEducationIn(StrictIn):
    # The class the line is about, from the same vocabulary the rest of the app
    # uses, so a resume printed from a profile cannot disagree with it.
    class_level: ClassLevel
    # Optional and freely worded: a school name, a board, "Open schooling". The
    # app asks for no address and no enrolment number, and the screen says so.
    school: str | None = Field(default=None, max_length=120)
    year: str | None = Field(default=None, max_length=16)
    # Marks, percentage, grade, "appearing" — whatever the student's board uses.
    # Free text rather than a number because a 60% and a B+ and an 8.1 CGPA are the
    # same line on a CV, and forcing one of them would be forcing a lie.
    result: str | None = Field(default=None, max_length=48)


class ResumeSkillIn(StrictIn):
    name: str = Field(min_length=1, max_length=80)
    # Three words a student can actually answer with, and no percentage. A number
    # beside a skill invites an invented one.
    level: Literal["", "learning", "comfortable", "confident"] = ""


class ResumeProjectIn(StrictIn):
    # Long enough to hold one verified sentence, because a suggestion a student has to
    # rewrite before they can use is a suggestion they will not use.
    title: str = Field(min_length=1, max_length=200)
    detail: str | None = Field(default=None, max_length=600)
    year: str | None = Field(default=None, max_length=16)


class ResumeIn(StrictIn):
    target_role: str | None = Field(default=None, max_length=120)
    education: list[ResumeEducationIn] = Field(default_factory=list, max_length=8)
    skills: list[ResumeSkillIn] = Field(default_factory=list, max_length=20)
    projects: list[ResumeProjectIn] = Field(default_factory=list, max_length=10)


class ResumeOut(ORMModel):
    """The document, or an empty one.

    A student who has never opened this screen gets the same shape as one who has,
    with `saved_at` null — so the screen draws its form rather than branching on a
    404, and nothing is written to the database just because somebody looked.
    """

    target_role: str | None
    education: list[ResumeEducationIn]
    skills: list[ResumeSkillIn]
    projects: list[ResumeProjectIn]
    saved_at: datetime | None = None


# ------------------------------------------------------------------ the suggest


class ResumeSuggestIn(StrictIn):
    # The job being aimed at. Free text, because it is the student's own words
    # ("cricket commentator", "hotel manager") and not a key into a catalogue.
    target_role: str = Field(min_length=2, max_length=120)
    language: Language | None = None


class ResumeSuggestionOut(BaseModel):
    skills: list[ResumeSkillIn] = Field(default_factory=list)
    projects: list[ResumeProjectIn] = Field(default_factory=list)
    # The career profile the built-in suggestions came from, when they did, so the
    # screen can name where the list came from instead of saying only "AI".
    matched_career: str | None = None
    provider: str
    # The project's honesty flag. True means no model was consulted and nobody
    # reading this API may be told otherwise.
    demo_generated: bool
    error: str | None = None


# --------------------------------------------------------- the mock interview


class InterviewTurn(StrictIn):
    """One line of the transcript the student's own browser is holding.

    `role` is who spoke, not a persona: `interviewer` is a question this app asked,
    `candidate` is the student's answer to it. The route counts the candidate lines to
    work out which question it is on, so a caller cannot claim a sixth question by
    describing the conversation differently — and cannot make the interviewer answer
    for the student by labelling their own words as questions.
    """

    role: Literal["interviewer", "candidate"]
    text: str = Field(min_length=1, max_length=1200)


class MockInterviewIn(StrictIn):
    # The job being practised for, in the student's own words. Free text rather than a
    # catalogue key, for the same reason the resume's target role is: "cricket
    # commentator" is a real answer and is not in any table here.
    role: str = Field(min_length=2, max_length=120)
    # Empty for the opening question. Capped well past a five-question sitting so a
    # student who is asked to rephrase is not refused, and capped at all because this
    # text goes to the configured provider and a body of any size would be a bill.
    history: list[InterviewTurn] = Field(default_factory=list, max_length=14)
    language: Language | None = None


class MockInterviewOut(BaseModel):
    """The next turn, or the end.

    Exactly one of `question` / `finished` is the useful pair: while the interview runs
    `question` holds what the interviewer asks next and `feedback` what they said about
    the last answer; once it ends `question` is null and `score` / `tips` carry the
    closing. `score` is null whenever nobody read the answers — a number invented by a
    script would be the one thing here a student could not argue with.
    """

    question: str | None = None
    feedback: str | None = None
    # 1..5 while asking, 5 on the closing turn.
    question_number: int
    finished: bool
    score: int | None = None
    tips: list[str] = Field(default_factory=list)
    provider: str
    demo_generated: bool
    # Set when the student's own last answer sounded like a child who is not safe. The
    # screen has to put a helpline card in front of them instead of another question.
    needs_support: bool = False
    error: str | None = None
    language: str = "en"



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
    source_url: str | None
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


# --------------------------------------------------------------------- exams


class ExamOut(ORMModel):
    """One exam card, as the public page reads it.

    `exam_date` and `fee_note` are the only two fields here that the API can withhold.
    A row whose figures nobody has read off a source answers them as `null` even though
    the column holds text, so the screen falls back to naming the official notification
    the way it always has. The rule lives in the router, not in this class, because it
    is a rule about what may be *published*, not about what may be stored.
    """

    id: int
    group_id: int
    name: str
    authority: str
    description: str
    careers: str
    timeline: str
    preparation: str
    exam_date: str | None
    fee_note: str | None
    source_url: str | None
    verified: bool
    verified_at: datetime | None


class ExamGroupOut(ORMModel):
    id: int
    title: str
    description: str
    exams: list[ExamOut]


class ExamAdminOut(ExamOut):
    """Everything the public card shows, plus what an operator needs to edit it."""

    is_active: bool
    sort_order: int
    created_at: datetime


class ExamGroupAdminOut(ExamGroupOut):
    is_active: bool
    sort_order: int
    exams: list[ExamAdminOut]


class ExamCreateIn(StrictIn):
    """Add an exam. No date, no fee, and no way to arrive already "verified".

    A new row is a name, a conducting body and four sentences — the same fields the card
    renders. `exam_date` and `fee_note` are absent from this body on purpose: they can
    only enter through the update route, which makes the row name the page they came
    from first. That is the same shape `UniversityCreateIn` has.
    """

    group_id: int
    name: str = Field(min_length=2, max_length=120)
    authority: str = Field(min_length=4, max_length=160)
    description: str = Field(min_length=20, max_length=4000)
    careers: str = Field(min_length=10, max_length=4000)
    timeline: str = Field(min_length=10, max_length=4000)
    preparation: str = Field(min_length=10, max_length=4000)
    sort_order: int | None = Field(default=None, ge=0, le=10_000)


class ExamUpdateIn(StrictIn):
    """Edit one exam. Absent means unchanged, empty means cleared.

    `verified` cannot be given by saying so — it needs a `source_url` on the row, and the
    route stamps the day itself. A date or a fee needs the same source whether the row is
    being marked verified or not, which is the difference between a recorded notification
    and a guess in a database.
    """

    name: str | None = Field(default=None, min_length=2, max_length=120)
    authority: str | None = Field(default=None, min_length=4, max_length=160)
    description: str | None = Field(default=None, min_length=20, max_length=4000)
    careers: str | None = Field(default=None, min_length=10, max_length=4000)
    timeline: str | None = Field(default=None, min_length=10, max_length=4000)
    preparation: str | None = Field(default=None, min_length=10, max_length=4000)
    exam_date: str | None = Field(default=None, max_length=120)
    fee_note: str | None = Field(default=None, max_length=4000)
    source_url: str | None = Field(default=None, max_length=500)
    verified: bool | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=10_000)


class ExamGroupCreateIn(StrictIn):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=4000)
    sort_order: int | None = Field(default=None, ge=0, le=10_000)


class ExamGroupUpdateIn(StrictIn):
    title: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, min_length=10, max_length=4000)
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=10_000)


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


class TTSIn(StrictIn):
    # Generous on purpose: `tts.plain_text` decides what is actually spoken, so a
    # full guide reply is accepted and shortened instead of rejected with a 422.
    text: str = Field(min_length=1, max_length=8000)
    language: Language = "en"
    voice: str | None = Field(default=None, max_length=48)


class VoiceInfoOut(BaseModel):
    voices: list[dict]
    provider: str
    note: str
    default_voice: str


class TTSAttemptOut(BaseModel):
    """The result of the most recent real synthesis on this server."""

    checked_at: str | None
    ok: bool | None
    provider: str | None
    reason: str | None


class HealthOut(BaseModel):
    status: str
    storage: str
    ai_provider: str
    ai_configured: bool
    tts_provider: str
    tts_ready: bool
    tts_last_attempt: TTSAttemptOut
    # Whether a key and a sending address both exist, which is the thing a person
    # checks after pasting them: see the RESEND row of the settings table in docs/ARCHITECTURE_AND_TESTS.md §1.
    email_enabled: bool
    demo_mode: bool


# ------------------------------------------------------------- assessments
#
# Only four of these shapes are worth naming: what starts a sitting, what one
# autosaved answer is, what a submit carries, and what a finished result looks
# like. The instrument catalogue itself is data, so `/api/assessments` returns it
# as a plain object the frontend validates with zod.


class AssessmentStartIn(StrictIn):
    # The language of the item text. `hinglish` is accepted for conversation and
    # reads the English items inside Hindi interface text.
    language: Literal["en", "hi", "hinglish"] = "en"


class QuestionResponseIn(StrictIn):
    code: str = Field(min_length=1, max_length=12)
    # "1" to "5" on the agree/disagree scale, "a" to "d" for a puzzle option.
    # Validated against the item itself on the server, never here.
    value: str = Field(min_length=1, max_length=8)


class AssessmentSubmitIn(StrictIn):
    # The labels come back in this language, so a student who answered in English
    # can read their result in Hindi. Absent means the language of the sitting.
    language: Literal["en", "hi", "hinglish"] | None = None


class AssessmentQuestionOut(BaseModel):
    code: str
    text: str
    response_type: Literal["likert", "choice"]
    # Puzzle options as {"value", "label"}. The answer key is never in this list —
    # it lives on `Question.correct_value` and stops on the server.
    options: list[dict] = Field(default_factory=list)


class AssessmentResultOut(BaseModel):
    result_id: int
    assessment_id: int
    assessment_type: str
    name: str
    item_language: str
    completed_at: datetime
    # dimension -> {score, band, answered, total, correct}
    scores: dict
    traits: list[dict]
    top_traits: list[dict]
    totals: dict
    themes: list[str]
    careers: list[dict]
    career_note: str
    caveats: list[str]
    # The skill gap and the four weeks, already rendered into sentences for the
    # language asked for. None when no plan has been written for this sitting — which
    # is every result taken before the plan existed, and a result where nothing was
    # answered strongly enough to aim a plan at. The screen says which, rather than
    # showing an empty card.
    roadmap: dict | None = None
    # Whether the ✨ button on that card would reach a model at all. The frontend
    # hides it when false, because a button that quietly returns the same rules plan
    # is the kind of thing this app has promised not to ship.
    roadmap_ai_available: bool = False
    # When a plan was rebuilt and the provider refused to, the sentence about that.
    # Transient by design: it describes one click, not the stored document.
    roadmap_note: str | None = None


class PdfGenerateIn(StrictIn):
    # The sitting whose result anchors the document. The PDF itself carries every
    # questionnaire this student has finished, with this one first.
    assessment_id: int = Field(ge=1)
    # The language of the printed page, which is the interface language rather than
    # the language the items were asked in. `hinglish` prints Hindi, as it does on
    # screen.
    language: Literal["en", "hi", "hinglish"] | None = None


class PdfReportOut(BaseModel):
    id: int
    # The result the document was anchored on. The request names a sitting; the
    # stored file records the scored result of that sitting.
    result_id: int
    filename: str
    language: str
    size_bytes: int
    generated_at: datetime
    # Every result this document summarises, so a reader can tell what is in it.
    result_ids: list[int]
    # Not a public link: the file is behind the same bearer token as everything
    # else here, so the browser fetches it and hands itself a temporary URL.
    download_path: str
    # False when the document was rendered just now, True when the stored one was
    # still current and went back unchanged.
    generated: bool


# ------------------------------------------------------------------- payments
# The codes a body may name. `free` and `school` are here for the plans response,
# never for an order: a request cannot buy its way to a granted licence, and it
# certainly cannot set itself back to free by pretending to pay for that.
PlanCode = Literal["free", "pro_monthly", "pro_yearly", "school"]
PurchasablePlanCode = Literal["pro_monthly", "pro_yearly"]

# Razorpay's own id shapes, pinned as patterns rather than checked by hand later.
ORDER_ID = Field(pattern=r"^order_[A-Za-z0-9_]{6,60}$", max_length=64)
PAYMENT_ID = Field(pattern=r"^pay_[A-Za-z0-9_]{6,60}$", max_length=64)
# A hex sha256. Anything else is not a signature and is not worth computing over.
SIGNATURE = Field(pattern=r"^[0-9a-f]{64}$")


class CreateOrderIn(StrictIn):
    plan_code: PurchasablePlanCode
    # Refused unless true, with the sentence in the router. A minor cannot be the
    # payer, and this app's accounts are mostly minors by design — so the one thing
    # standing between a ten-year-old and a card form is this box, ticked by whoever
    # is actually holding the phone.
    adult_attested: bool


class DowngradeIn(StrictIn):
    # Moving to Free mid-period throws away paid days, so the route requires the
    # caller to say they understood that, and the screen tells them how many days go.
    confirm_gives_up_remaining: bool


class VerifyIn(StrictIn):
    """What Razorpay's checkout handler hands the browser, sent straight back.

    No amount, no plan, no user id. Every one of those is looked up from the order
    this server created, because a body that could restate them could restate them
    in its favour.
    """

    order_id: str = ORDER_ID
    payment_id: str = PAYMENT_ID
    razorpay_signature: str = SIGNATURE


class PricingPlanOut(BaseModel):
    code: str
    name: str
    tagline: str
    # Paise, always: the browser formats the rupees. A price that arrives already a
    # string cannot be checked against what the order actually charged.
    price_paise: int | None
    compare_at_paise: int | None
    savings_paise: int
    savings_percent: int
    interval: str
    period_days: int | None
    cta: str
    purchasable: bool
    currency: str = "INR"
    # The limits themselves, next to the price, so the page that advertises "3 chats a
    # day" is rendered from the number the server enforces rather than from a copy.
    daily_chats: int | None
    total_assessments: int | None
    pdf_reports: bool
    parent_dashboard: bool
    features: dict[str, str | bool]


class FeatureRowOut(BaseModel):
    key: str
    label: str
    help: str


class PricingOut(BaseModel):
    plans: list[PricingPlanOut]
    features: list[FeatureRowOut]
    currency: str = "INR"
    # Whether a checkout can happen at all on this server, and which kind of key it
    # would use. The pricing page reads these to decide what its buttons say, so a
    # deployment without keys is honest without needing a second source of truth.
    payments_enabled: bool
    test_mode: bool
    limits_enforced: bool


class CreateOrderOut(BaseModel):
    order_id: str
    amount_paise: int
    currency: str
    plan_code: str
    plan_name: str
    receipt: str
    # The publishable key plus everything Checkout needs. It is publishable precisely
    # so that it can be sent here; the secret never leaves the server.
    checkout: dict[str, Any]


class PaymentOut(ORMModel):
    id: int
    order_id: str
    payment_id: str | None
    plan_code: str
    interval: str
    amount_paise: int
    currency: str
    status: str
    failure_reason: str | None
    receipt: str
    captured_at: datetime | None
    created_at: datetime
    test_mode: bool


class UsageOut(BaseModel):
    plan_code: str
    chats_today: int | None
    chats_allowed: int | None
    chats_left: int | None
    assessments_done: int
    assessments_allowed: int | None
    enforced: bool


class PlanDetailOut(BaseModel):
    plan_code: str
    plan_name: str
    source: str
    interval: str | None
    started_at: datetime | None
    expires_at: datetime | None
    active: bool
    lapsed_plan: str | None
    shared_from_family: bool
    daily_chats: int | None
    total_assessments: int | None
    pdf_reports: bool
    parent_dashboard: bool


class BillingOut(BaseModel):
    plan: PlanDetailOut
    usage: UsageOut
    payments: list[PaymentOut]
    payments_enabled: bool
    test_mode: bool
    # What a browser needs to open a checkout without asking for the plan list: the
    # publishable key, or None when payments are switched off.
    key_id: str | None


SessionOut.model_rebuild()
ParentSummaryOut.model_rebuild()


# ------------------------------------------------------------- study abroad

# Where a family is at, chosen from six words. It is a stage, not a school: nothing a
# student would be embarrassed by in front of a teacher is stored here, and no
# institution name is asked for, because a marketing form has no use for one.
LeadStage = Literal["class-9", "class-10", "class-11", "class-12", "in-college", "other"]
LeadStatus = Literal["new", "contacted", "closed"]


class StudyCountryOut(ORMModel):
    """One destination, exactly as much of it as this site can stand behind.

    `checked_at` travels with the copy it describes. NULL is not a missing detail to be
    hidden: it is the fact that nobody has re-read these sentences against the official
    portal, and the page prints that rather than letting old prose look current.
    """

    slug: str
    name: str
    code: str
    overview: str
    language_note: str | None
    intake_note: str | None
    cost_note: str | None
    work_after_note: str | None
    to_check: list[str]
    visa_portal_url: str | None
    visa_portal_label: str | None
    qualifications_portal_url: str | None
    qualifications_portal_label: str | None
    checked_at: datetime | None
    sort_order: int


class StudyCountryCardOut(StudyCountryOut):
    universities: int


class UniversityOut(ORMModel):
    """A university, and the honest split between what is known and what is not.

    There is no default fee, no invented deadline and no ranking number on this
    response. The five columns a family most wants — `tuition_note`, `intakes`,
    `application_urls`, `english_test_note`, `deadline_note` — ship empty, and each
    renders as a link to the institution's own page until somebody reads the figure and
    records where and when in `source_url` and `verified_at`.
    """

    id: int
    slug: str
    name: str
    city: str
    kind: str
    official_url: str
    founded_year: int | None
    summary: str | None
    areas: list[ShortText]
    tuition_note: str | None
    intakes: list[ShortText]
    application_urls: dict[str, str]
    english_test_note: str | None
    deadline_note: str | None
    source_url: str | None
    verified: bool
    verified_at: datetime | None
    sponsored: bool
    sponsorship_disclosure: str | None
    sort_order: int


class UniversitySummaryOut(ORMModel):
    """The list row: enough to choose a profile page, too little to quote."""

    slug: str
    name: str
    city: str
    kind: str
    official_url: str
    verified: bool
    # The list carries the same two facts the profile page does, because the question
    # "has anybody read this?" is asked at the list, not after opening a row.
    source_url: str | None
    verified_at: datetime | None
    sponsored: bool


class StudyServiceOut(ORMModel):
    """A service, with what it never covers stated as loudly as what it does.

    `available` is what turns a call to action into a sentence. A service that is not
    being offered yet is described and labelled as not being offered yet; there is no
    button on that page that pretends otherwise.
    """

    slug: str
    title: str
    summary: str
    detail: str | None
    steps: list[str]
    includes: list[str]
    not_included: list[str]
    who_for: str | None
    fees_note: str | None
    available: bool
    sort_order: int


class StudyStoryOut(ORMModel):
    id: int
    headline: str
    body: str
    attribution: str
    year: int | None
    published_at: datetime | None


class LeadIn(StrictIn):
    """An enquiry, and nothing the operator did not ask for.

    No school name, no city, no marks, no documents. Those would be a minor's record
    sitting in a sales table that no delete path was designed around, and a first
    conversation can happen without them.

    `consent_contact` has to be true or the request is refused before a row is written:
    a form that stores an address somebody did not agree to be written to is the one
    thing this table must never become.
    """

    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=3, max_length=254)
    phone: str | None = Field(default=None, max_length=24)
    stage: LeadStage | None = None
    country_slug: str | None = Field(default=None, max_length=40)
    service_slug: str | None = Field(default=None, max_length=60)
    message: str | None = Field(default=None, max_length=2000)
    # The page that held the form, as a path. It is checked as one rather than trusted,
    # because this string is shown to the operator and a body that could carry any text
    # here is a body that could carry somebody else's URL.
    source_page: str | None = Field(
        default=None, max_length=120, pattern=r"^/[A-Za-z0-9/_-]{0,119}$"
    )
    consent_contact: bool = False
    # The honeypot, and the only field here a person is never shown. A bot that fills
    # every input it finds fills this one; the route then answers as if it had stored
    # the enquiry and stores nothing. It is declared rather than refused by
    # `extra="forbid"` so that a bot is not told which field gave it away — and so the
    # empty value a real form sends is a valid body.
    company: str | None = Field(default=None, max_length=120)


class LeadOut(BaseModel):
    """What happened to an enquiry, in the same three-part shape as every mail answer.

    `stored` is the only promise this route can make on its own. `reason` says whether an
    acknowledgement went out too, and its note says plainly when it did not, so a family
    who typed a wrong address hears that here rather than waiting for a reply that was
    never going to arrive.
    """

    stored: bool
    reason: str
    note: str
    notified_operator: bool


class LeadAdminOut(ORMModel):
    id: int
    name: str
    email: str
    phone: str | None
    stage: str | None
    country_id: int | None
    service_id: int | None
    message: str | None
    source_page: str | None
    consent_contact: bool
    consent_contact_at: datetime | None
    status: str
    admin_note: str | None
    handled_at: datetime | None
    created_at: datetime


class LeadHandleIn(StrictIn):
    """The operator's side of an enquiry, and the only two things worth recording.

    The enquiry itself — name, address, message — cannot be rewritten from here. A lead
    is what a person typed to us, and that record is answerable but not editable.
    """

    status: LeadStatus
    admin_note: str | None = Field(default=None, max_length=2000)


class UniversityCreateIn(StrictIn):
    name: str = Field(min_length=2, max_length=160)
    country_slug: str = Field(min_length=2, max_length=40)
    city: str = Field(min_length=1, max_length=80)
    kind: Literal["public", "private"] = "public"
    official_url: str = Field(min_length=8, max_length=400)
    summary: str | None = Field(default=None, max_length=4000)
    areas: list[ShortText] = Field(default_factory=list, max_length=24)


class UniversityUpdateIn(StrictIn):
    """Edit one university. Absent means unchanged, empty means cleared.

    `verified` is the exception, and the only rule here that is about honesty rather
    than shape: a row cannot be marked verified by saying so. It takes a `source_url`,
    and the route stamps the date itself, so "verified" always means "somebody opened
    something on this day" and never "somebody ticked a box".
    """

    city: str | None = Field(default=None, min_length=1, max_length=80)
    kind: Literal["public", "private"] | None = None
    official_url: str | None = Field(default=None, min_length=8, max_length=400)
    founded_year: int | None = Field(default=None, ge=1000, le=2200)
    summary: str | None = Field(default=None, max_length=4000)
    areas: list[ShortText] | None = Field(default=None, max_length=24)
    tuition_note: str | None = Field(default=None, max_length=4000)
    intakes: list[ShortText] | None = Field(default=None, max_length=12)
    application_urls: dict[str, str] | None = None
    english_test_note: str | None = Field(default=None, max_length=4000)
    deadline_note: str | None = Field(default=None, max_length=4000)
    source_url: str | None = Field(default=None, max_length=500)
    verified: bool | None = None
    sponsored: bool | None = None
    sponsorship_disclosure: str | None = Field(default=None, max_length=4000)
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=10_000)


class UniversityAdminOut(UniversityOut):
    country_id: int
    country_slug: str
    is_active: bool
    created_at: datetime


class StoryCreateIn(StrictIn):
    headline: str = Field(min_length=4, max_length=160)
    body: str = Field(min_length=20, max_length=8000)
    # However the person asked to be named. Nothing that locates them.
    attribution: str = Field(min_length=1, max_length=80)
    country_slug: str | None = Field(default=None, max_length=40)
    university_slug: str | None = Field(default=None, max_length=120)
    year: int | None = Field(default=None, ge=1990, le=2100)
    consent_confirmed_at: datetime | None = None
    published: bool = False


class StoryAdminOut(StudyStoryOut):
    country_id: int | None
    university_id: int | None
    # The two slugs, not only the two ids. The admin PATCH replaces the whole story and
    # reads its links by slug, so a reader that cannot see the current slug cannot send
    # it back — and an operator editing a headline would drop the destination with it.
    country_slug: str | None
    university_slug: str | None
    consent_confirmed_at: datetime | None
    published: bool


# ------------------------------------------------------------- organisations

OrgKind = Literal["school", "counsellor"]

# `student` and `parent` here mean the same people they mean on `users.role`: a young
# member of this school, and a guardian of one. `counsellor` and `school_admin` are the
# two roles that exist *inside one organisation* and nowhere else. No request body, no
# token and no accept call can put either of them anywhere it was not already written by
# a member who holds the right to add it.
MemberRole = Literal["student", "parent", "counsellor", "school_admin"]
# What a member may create. Nobody can invite themselves into anything: an invite goes to
# an address the sender already holds, and only that address's mail can bring it back.
# `school_admin` is in the list because a school has to be able to hand its portal to a
# second teacher; the join route then refuses a staff role for an account that says it
# belongs to a child, which is the only age signal this app has.
InvitableRole = Literal["student", "parent", "counsellor", "school_admin"]
MemberStatus = Literal["invited", "active", "revoked"]

# The same rule `app/middleware/tenant.py` checks, so a slug that reaches the database is
# always one a hostname could produce. The reserved labels (`api`, `admin`, `join`, `www`,
# …) are refused by the route, which reads them from the resolver rather than keeping a
# second list here.
OrgSlug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9](?:-?[a-z0-9]){2,39}$")]

# A closed set rather than any hex a browser can type. A free-form accent colour can make
# a warning look like a button, and on a child's result screen that is not a branding
# choice but a design failure. These are the platform's own tokens: a portal can look
# like itself and still cannot redefine what a colour means.
AccentColor = Literal[
    "#2563eb",  # the platform's own blue
    "#0e7490",
    "#047857",
    "#4338ca",
    "#7e22ce",
    "#b45309",
    "#0f172a",
]

# A cohort this small is not a cohort. Five students in one school who finished a
# questionnaire is a group a head teacher could walk down and name, so the analytics
# screen reports the number and hides the breakdown instead of pretending the sample is
# anonymous. It is a floor, not a guarantee, and the portal says so on screen.
MIN_REPORTABLE_COHORT = 5


class OrganizationCreateIn(StrictIn):
    """Starting a portal. `slug` is optional because most schools should not have to
    choose a hostname; the route derives one from the name and tells the caller what it
    picked.
    """

    name: str = Field(min_length=2, max_length=120)
    slug: OrgSlug | None = None


class AdminOrganizationCreateIn(OrganizationCreateIn):
    """The platform operator's version, which gets to say what kind of body this is."""

    kind: OrgKind
    tier_code: str | None = Field(default=None, max_length=24)


class OrganizationUpdateIn(StrictIn):
    """What an organisation may change about itself: its name, and nothing else.

    There is no `tier_code`, no `verified` and no `is_active` here on purpose. A school
    cannot grant itself seats, declare itself verified, or come back after the platform
    closed it; those three live on the admin-only schema below.
    """

    name: str | None = Field(default=None, min_length=2, max_length=120)


class AdminOrganizationUpdateIn(StrictIn):
    tier_code: str | None = Field(default=None, max_length=24)
    verified: bool | None = None
    is_active: bool | None = None


class BrandingIn(StrictIn):
    """A portal's look, with each field capped at the length the screen can render.

    `logo_url` is a link to a file somebody else hosts. There is no upload route in this
    API: a platform that stores a school's logo stores a school's identity, and it then
    has to back that identity up, delete it on request, and look at what it depicts.
    """

    portal_title: str | None = Field(default=None, max_length=80)
    # The one field a child reads before deciding to join, so it is capped short and
    # rendered under the platform's own label rather than in place of it.
    welcome_note: str | None = Field(default=None, max_length=600)
    logo_url: str | None = Field(default=None, max_length=500)
    accent_color: AccentColor | None = None

    @field_validator("logo_url")
    @classmethod
    def logo_is_a_plain_https_link(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        # No credentials in a URL that will be painted into an `<img>` tag on a page a
        # child opens, and no `javascript:` or plain `http:` quietly loading a school's
        # logo over an unencrypted line.
        if not cleaned.startswith("https://") or "@" in cleaned or any(c.isspace() for c in cleaned):
            raise ValueError("a logo must be a plain https link to an image")
        return cleaned


class OrganizationOut(ORMModel):
    slug: str
    kind: str
    name: str
    tier_code: str
    verified: bool
    is_active: bool


class PortalBrandingOut(BaseModel):
    """What a portal may paint before anybody proves who they are.

    Every field here is a school's own choice about its appearance, and no field is a
    number about a child. `verified` travels with them because it is the difference
    between "Green School" and "verified school" on screen, and that difference must be
    visible to somebody who has not joined yet.
    """

    slug: str
    kind: str
    name: str
    verified: bool
    portal_title: str | None = None
    logo_url: str | None = None
    accent_color: str | None = None


class BrandingOut(ORMModel):
    portal_title: str | None
    welcome_note: str | None
    logo_url: str | None
    accent_color: str | None
    changed_at: datetime


class MemberOut(ORMModel):
    """One row of a roster, as the organisation's own staff read it.

    Deliberately missing: the account id, the contact address, and anything the member
    wrote. A roster tells a school that a place is taken; it is not a way to look at a
    child's work, and after a student joins this row still shows the label *the school*
    typed rather than the name the student chose.
    """

    id: int
    org_role: MemberRole
    status: MemberStatus
    display_label: str | None
    joined_at: datetime | None
    # Whose switch this is, shown so a counsellor understands why a client's result is
    # not on their screen — and it is the student's own answer, never the school's.
    share_results: bool
    assigned_counsellor_label: str | None = None


class MemberAdminOut(MemberOut):
    """The same row for the person who sent the invite: they need the address they typed
    and whether it is still waiting.
    """

    invited_email: str | None
    invite_expires_at: datetime | None


class InviteIn(StrictIn):
    """One invitation. The address is the only contact detail stored on the row, and no
    name, school, class or city is asked for — a school already knows those and this API
    has no use for a copy.
    """

    email: str = Field(min_length=3, max_length=254)
    org_role: InvitableRole
    display_label: str | None = Field(default=None, max_length=80)


class BulkInviteIn(StrictIn):
    """A class list in one request.

    Fifty is the ceiling because a bulk invite sends mail, and a ceiling is what keeps a
    paste from a spreadsheet from turning into a hundred calls to a paid service in one
    click. A school with a bigger list gets two requests, which is also the point at
    which somebody should be checking that the list is the right one.
    """

    members: list[InviteIn] = Field(min_length=1, max_length=50)


class InviteResultOut(BaseModel):
    """What the school did, what the platform actually sent, and what was already there.

    `mailed` is the honest half: with no email transport configured every address still
    becomes a waiting row — a school can hand out a link from its own noticeboard — and
    the response says the mail did not go rather than showing a green tick nobody
    received.
    """

    invited: list[str] = []
    already_there: list[str] = []
    refused: list[str] = []
    seats_left: int = 0
    mailed: bool = False
    mail_detail: str | None = None


class AcceptIn(StrictIn):
    """Presenting the token an invite letter carried.

    The only way to become a member of a school. It arrives from the browser that opened
    the link, which is the whole proof this app has: no name, no password, and no claim
    about who the child is.

    `share_results` is asked here rather than assumed later, because this is the one
    moment the joining account is looking at the question directly. It defaults to false,
    so a school that wants its students' reports has to be given them student by student,
    by somebody who chose to.
    """

    token: str = Field(min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    share_results: bool = False


class AcceptOut(BaseModel):
    slug: str
    kind: str
    name: str
    org_role: MemberRole
    portal_title: str | None = None
    # Echoed back so the screen that shows the result can show the switch it just set,
    # and the choice the child made out loud.
    share_results: bool = False


class MyMembershipOut(BaseModel):
    """One of the caller's own places, for the app shell and for `/api/auth/me`.

    A person can be in several organisations; this is the list that lets them choose
    which portal to open, and it is the only tenant information an account can get about
    itself without naming an organisation first. `share_results` travels with it because
    it is the caller's own switch about their own work, and the screen that shows it has
    no other way to know where the lever currently stands — the roster is a staff view,
    and a student should not have to read it to see their own answer.
    """

    slug: str
    kind: str
    name: str
    org_role: MemberRole
    status: MemberStatus
    portal_title: str | None = None
    share_results: bool = False


class ShareIn(StrictIn):
    """The member's own decision about what their organisation may read."""

    share_results: bool


class CounsellorAssignIn(StrictIn):
    """Which of this organisation's counsellors a student should talk to.

    `None` clears it. A `user_id` is not accepted here, and not because it would be
    inconvenient: the assignment is between two places in one organisation, and taking an
    account id from a request would be a way to point at somebody's child from outside
    it.
    """

    counsellor_membership_id: int | None = None


class NoteIn(StrictIn):
    """A counsellor's record of one session.

    Two thousand characters is a page of notes, and it is a ceiling rather than an
    invitation: the longer a free-text field about a child gets, the more likely it is
    that somebody has pasted a conversation into it. Transcripts belong to the student's
    own account; what belongs here is what happened and what happens next.
    """

    client_membership_id: int
    body: str = Field(min_length=3, max_length=2000)


class NoteShareIn(StrictIn):
    shared_with_family: bool


class NoteOut(BaseModel):
    id: int
    client_membership_id: int
    body: str
    shared_with_family: bool
    shared_at: datetime | None
    created_at: datetime
    edited_at: datetime | None
    # The practice's own label for whoever wrote it, so a family reading a shared note
    # knows which of the practice's counsellors wrote it. Never an account id.
    author_label: str | None = None


class TierOut(BaseModel):
    """A tier, with its price stated as the thing it is: not a number you can pay."""

    code: str
    name: str
    kind: str
    tagline: str
    seats: int
    price_rupees: int | None
    includes: list[str]
    not_included: list[str]
    # False for every tier in this build, and sent so the screen can say "arranged with
    # a person" instead of drawing a button that would only fail.
    purchasable: bool


class PortalSummaryOut(BaseModel):
    """The numbers a portal's own header shows: how many places it has, and how many it
    has used.
    """

    organization: OrganizationOut
    seats: int
    seats_used: int
    seats_left: int
    joined: int
    invited: int
    staff: int


class AnalyticsBucketOut(BaseModel):
    label: str
    count: int


class AnalyticsOut(BaseModel):
    """Cohort counts for one organisation, already filtered.

    `hidden` names the breakdowns that were withheld rather than left out silently, so an
    administrator can see that the guard fired and why. This is the only view of student
    activity an organisation gets by default: no names, no per-child rows, and
    `shared_results` counting only the children who chose to share.
    """

    cohort_size: int
    sittings_started: int
    sittings_completed: int
    shared_results: int
    by_stage: list[AnalyticsBucketOut] = []
    by_language: list[AnalyticsBucketOut] = []
    hidden: list[str] = []
    # Stated once per response instead of being inferred from a missing bucket.
    min_reportable: int = MIN_REPORTABLE_COHORT


# ------------------------------------------------------------------------ admin
# Every shape below is what an operator's screen is allowed to see, which is a smaller
# set than what is in the database. Three rules run through the whole section, and the
# routes enforce them rather than relying on a screen to hide a field:
#
# * No credential material, and no column that behaves like one. A guest account is
#   reached with a device id and a come-back code, so `device_id`, `comeback_hash`,
#   `comeback_index` and any token or invite hash are absent from these models by
#   construction — not filtered at render time.
# * No conversation content. `Message.content` never appears, and neither does a
#   transcript excerpt. Chats are counted here, not read; reading one takes the
#   guardian's own route and the guardian's own token.
# * Money in paise. The same reason as `Payment.amount_paise`: a float rupee turns
#   a rupee amount into 298.9999999 on an invoice that has to match the money taken.


class AdminBucketOut(BaseModel):
    label: str
    count: int


class AdminUserMetricsOut(BaseModel):
    total: int
    students: int
    parents: int
    closed: int
    operators: int
    new_7d: int
    new_30d: int


class AdminChatMetricsOut(BaseModel):
    sessions: int
    chat_sessions: int
    voice_sessions: int
    messages: int
    sessions_7d: int
    messages_7d: int
    # Replies written by the canned demo model rather than a configured provider. A
    # dashboard that shows only a total cannot tell a real conversation from a scripted
    # one, and the product's standing rule is never to present demo output as AI work.
    demo_replies: int
    real_replies: int


class AdminAssessmentMetricsOut(BaseModel):
    started: int
    completed: int
    in_progress: int
    results: int
    completed_7d: int
    pdf_reports: int
    by_type: list[AdminBucketOut] = []


class AdminRevenueMetricsOut(BaseModel):
    """Captured money, and the things that are not money, kept apart.

    `test_paise` is separated from `captured_paise` rather than added to it. A payment
    made with a test key is not revenue, and a KPI card that quietly included it would
    show the operator a number the bank has never heard of.
    """

    captured_paise: int
    captured_paise_30d: int
    captured_orders: int
    failed_orders: int
    refunded_paise: int
    test_paise: int
    test_orders: int
    paying_accounts: int
    granted_accounts: int
    by_plan: list[AdminBucketOut] = []


class AdminPortalMetricsOut(BaseModel):
    organizations: int
    schools: int
    practices: int
    members_active: int
    members_invited: int
    notes_shared: int


class AdminContentMetricsOut(BaseModel):
    careers: int
    careers_to_verify: int
    questions: int
    leads_open: int
    leads_total: int
    email_queued: int
    email_failed: int


class AdminSummaryOut(BaseModel):
    """One response for the whole dashboard, counted at this instant.

    Every figure is a count or a sum over rows the app already has. Nothing here is
    estimated, extrapolated or projected, and there is no growth percentage: two of
    these numbers divided by each other over a seven-day window on a deployment with
    forty students would be a number with no meaning attached to it.
    """

    generated_at: datetime
    users: AdminUserMetricsOut
    chats: AdminChatMetricsOut
    assessments: AdminAssessmentMetricsOut
    revenue: AdminRevenueMetricsOut
    portals: AdminPortalMetricsOut
    content: AdminContentMetricsOut


class AdminUserRowOut(BaseModel):
    """One account, with its own usage counts and none of its secrets.

    This is the row a search returns, so it is worth naming what is missing: no device
    id, no come-back code or hash, no token, no transcript, no answer values. A person
    at this screen can find an account, see how much it has used the app, and change
    whether it is open. Anything inside the conversations needs that account's own
    session.
    """

    id: int
    role: Role
    display_name: str
    preferred_language: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    # Only present when this person attached an address themselves. It is the address the
    # receipts go to; there is no way to search for an account by it from here, because a
    # list you can enumerate by email is a way to test which addresses have accounts.
    contact_email: str | None
    email_confirmed_at: datetime | None
    plan_code: str
    plan_expires_at: datetime | None
    conversations: int
    assessments: int
    assessments_completed: int
    portal_memberships: int


class AdminUserPageOut(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AdminUserRowOut]


class AdminOperatorIn(StrictIn):
    """Grant or remove the operator flag. One field, because that is the whole action."""

    is_admin: bool


class AdminAccountStatusIn(StrictIn):
    is_active: bool


class AdminCareerRowOut(ORMModel):
    slug: str
    title: str
    category: str
    summary: str
    min_class: int
    needs_verification: bool
    created_at: datetime


class AdminCareerPageOut(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AdminCareerRowOut]


class AdminCareerIn(StrictIn):
    """Correct a career entry. Every field is optional; a null means leave it alone.

    `slug` is not among them. It is the address in a child's saved list, in a
    recommendation and in a printed report, so renaming it would break links people have
    already kept — a wrong slug is corrected by editing the row, not by moving it.
    """

    title: Annotated[str | None, StringConstraints(min_length=3, max_length=120)] = None
    category: Annotated[str | None, StringConstraints(min_length=2, max_length=64)] = None
    summary: Annotated[str | None, StringConstraints(min_length=10, max_length=2000)] = None
    typical_activities: list[ShortText] | None = None
    useful_skills: list[ShortText] | None = None
    school_subjects: list[ShortText] | None = None
    education_pathways: list[ShortText] | None = None
    entry_requirements: list[ShortText] | None = None
    preparation_stages: list[ShortText] | None = None
    typical_day: Annotated[str | None, StringConstraints(max_length=4000)] = None
    costs_and_alternatives: Annotated[str | None, StringConstraints(max_length=4000)] = None
    benefits: list[ShortText] | None = None
    challenges: list[ShortText] | None = None
    explore_activities: list[ShortText] | None = None
    official_links: list[dict] | None = None
    related_slugs: list[ShortText] | None = None
    interest_themes: list[ShortText] | None = None
    min_class: Annotated[int | None, Field(ge=6, le=12)] = None
    needs_verification: bool | None = None


class AdminQuestionRowOut(BaseModel):
    id: int
    assessment_type: str
    code: str
    dimension: str
    order: int
    response_type: str
    keyed: str
    text_en: str
    text_hi: str
    # Puzzle options as {"value", "label"}, the same shape `data/assessment_questions.json`
    # authors and `QuestionOut` above hands to a student — as a list of strings it would
    # fail to read any real row, and an admin screen that cannot show the bank is worse than
    # one that shows it exactly as stored.
    options: list[dict] = Field(default_factory=list)
    correct_value: str | None
    # The immutability guard's evidence, shown rather than asserted: how many answers
    # have already been stored against this code.
    answers: int
    editable: bool


class AdminQuestionPageOut(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AdminQuestionRowOut]


class AdminQuestionIn(StrictIn):
    """Reword an item that nobody has answered yet.

    The route refuses a question with answers on it, and says what to do instead: a new
    code and a new bank version. Editing text under a stored answer would silently change
    what a completed sitting means, and a score is a claim about a child.
    """

    text_en: Annotated[str | None, StringConstraints(min_length=5, max_length=400)] = None
    text_hi: Annotated[str | None, StringConstraints(min_length=5, max_length=400)] = None
    dimension: Annotated[str | None, StringConstraints(min_length=2, max_length=24)] = None
    keyed: Literal["+", "-"] | None = None
    response_type: Annotated[str | None, StringConstraints(min_length=3, max_length=8)] = None
    options: list[dict] | None = None
    correct_value: Annotated[str | None, StringConstraints(max_length=8)] = None
    order: Annotated[int | None, Field(ge=0, le=200)] = None


class AuditEventOut(ORMModel):
    id: int
    created_at: datetime
    action: str
    actor_user_id: int | None
    # The name as it read when the action happened. A row that only held the id would say
    # nothing once the account was closed.
    actor_name: str | None
    subject_type: str | None
    subject_id: str | None
    detail: str | None
    origin: str


class AuditPageOut(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AuditEventOut]
    # Every action name present in the table, so the filter on the screen is built from
    # what has actually happened rather than from a list that goes stale.
    actions: list[str]


class AdminDeploymentOut(BaseModel):
    """What this deployment is running on, and what it therefore cannot promise.

    A hand-picked whitelist, field by field, for one reason: `Settings` also holds the
    AI, Razorpay, Clerk, Gemini and Resend keys, and an endpoint that walked its
    attributes would put five live credentials in a JSON response a browser keeps in its
    history. Presence is reported as a boolean and the key itself is never sent, not even
    truncated — the last four characters of a secret are still a fingerprint of it.

    Nothing here is editable by design. These values come from the environment of the
    process answering this request; a route that changed them would either write to a
    file the platform owns or be a lie about what it did. The screen says which of the
    two, and names the command that does the change instead of offering a dead control.
    """

    app_name: str
    # Which AI provider answers a chat, and whether it is the canned demo script.
    ai_provider: str
    ai_model: str
    ai_configured: bool
    tts_provider: str
    gemini_tts_model: str
    azure_speech_region: str
    # Presence only, for every integration. Each one is a feature the screens have to
    # describe accurately when its half is missing.
    has_gemini_key: bool
    has_azure_key: bool
    has_clerk_key: bool
    has_clerk_webhook_secret: bool
    has_resend_key: bool
    email_enabled: bool
    from_email: str | None
    # Where an enquiry is announced. Not a secret, and the operator needs it to know
    # where a family's enquiry actually went.
    lead_notify_email: str | None
    # Three payment facts and no key: whether money can be taken at all, whether a
    # callback can be verified, and whether what is configured is a sandbox. A revenue
    # card next to a test key has to be able to say that what it is counting moved no
    # money, and it says it from these three booleans.
    razorpay_configured: bool
    webhook_verifiable: bool
    razorpay_test_mode: bool
    cors_origins: list[str]
    public_site_url: str
    public_repo_url: str
    tenant_base_domain: str
    # The two "only behind a proxy that overwrites this header" switches. Both are shown
    # because leaving one on by mistake is a way for a caller to pick which tenant, or
    # which rate bucket, they are judged by.
    tenant_trust_forwarded_host: bool
    rate_limit_trust_forwarded_for: bool
    rate_limit_enabled: bool
    # The bucket every read shares, and the two tightest write buckets. `read` is here
    # because it is the rule a family is most likely to hit by accident, and the one an
    # operator needs to see before they conclude the app is "hanging" on a school network.
    rate_limit_read: str
    rate_limit_admin: str
    rate_limit_lead: str
    rate_limit_org: str
    # Whether the counters live in this process or in a Redis every worker shares. A
    # boolean rather than the URL, because a Redis URL can carry a password, and the
    # thing an operator needs to see is which of the two guards they are running — a
    # deployment that was set up for one worker and quietly scaled to four is a
    # deployment whose published limits are four times what the page says.
    rate_limit_shared_storage: bool
    # Which engine this process writes to, and whether it creates tables on boot. Both
    # belong on this screen for the same reason: which database the dashboard is counting
    # is a fact about the deployment an operator should not have to read a file to find.
    database_engine: str
    db_auto_setup: bool
    plan_limits_enforced: bool
    free_daily_chats: int
    free_assessment_total: int
    quota_utc_offset_minutes: int
    # Stated, so a screen does not have to explain the absence of an Edit button.
    editable: bool = False


# ---------------------------------------------------------------- erasure


class ErasureOut(BaseModel):
    """What an erasure did, stated as numbers rather than as a promise.

    `removed` is per table, because "we deleted your data" is not checkable and "14
    messages, 1 report, 1 assessment" is. The counts are the ones the route actually
    deleted, not a schema of what could exist.

    `kept` is the harder half of the answer and is deliberately in the response: two kinds
    of row survive on purpose — the money ledger, because a record that a payment was
    taken and refunded has to outlive the person it was about, and the operator log,
    because a history an account can delete is not a history. A confirmation dialog that
    said only "everything goes" would be the app lying about what it did.
    """

    erased_at: datetime
    removed: dict[str, int]
    kept: list[str]
    message: str
