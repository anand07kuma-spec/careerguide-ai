"""SQLAlchemy models. Only fields the product actually needs are stored."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    SmallInteger,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
    text,
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
    # A unique *index* rather than a unique constraint, so that `migrations/` can
    # reproduce this schema exactly with `op.create_index(unique=True)` — SQLite
    # cannot add a named constraint to a table that already exists, and the whole
    # point of the migration is that both paths build the same database.
    __table_args__ = (
        Index("ix_users_clerk_user_id", "clerk_user_id", unique=True),
        Index("ix_users_contact_email", "contact_email", unique=True),
        # The confirmation route has to find the row from the token alone.
        Index("ix_users_email_confirm_hash", "email_confirm_hash"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(16))  # student | parent
    display_name: Mapped[str] = mapped_column(String(80))
    preferred_language: Mapped[str] = mapped_column(String(8), default="en")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # --- An address a person chose to type in, for the messages they chose to ask
    # for. -------------------------------------------------------------
    # The app still asks for no email to work: every column below is nullable, and
    # an account with nothing in them behaves exactly as it always has. What makes
    # storing one defensible is the confirmation pair, not this column — a typed
    # address proves nothing about who owns it, and a child's report sent to an
    # address somebody mistyped is the failure this whole feature has to avoid. So
    # the address sits unusable until the random token below is presented back at
    # the browser that mail was sent to (`email_confirmed_at`), and every send reads
    # that timestamp before it renders anything.
    #
    # Unique, and that is a real tradeoff rather than a reflex: one address can
    # belong to one account, because "this confirmed address may receive that
    # child's data" has to have exactly one answer. A household sharing one Gmail
    # therefore gets one account that holds the address, and the other person's
    # settings screen says so instead of quietly taking the address from the first.
    #
    # Deleting the address deletes the confirmation, both hashes, and the three
    # message-purpose consents with it (see app/services/email_consent.py).
    contact_email: Mapped[str | None] = mapped_column(String(254))
    # SHA-256 of a single-use random token. Stored as a digest because a plaintext
    # confirmation token in a row is a way to switch an address on with one UPDATE
    # that never goes through the route holding the checks.
    email_confirm_hash: Mapped[str | None] = mapped_column(String(64))
    email_confirm_expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    email_confirmed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # This prototype asks for no password, so a returning browser is recognised by
    # a random id it made for itself. It is stored so the same device finds its own
    # account again; it is not something a person reads, remembers or shares.
    #
    # What is stored is the sha256 of that id, not the id (`security.device_hash_of`). The
    # id is the whole credential for `/api/auth/guest`, so keeping it in plaintext meant
    # that reading this database handed over a way into every device account on the site. A
    # digest of a random 122-bit value is neither reversible nor guessable and still makes
    # an indexed lookup key. Nothing on the wire changed — migration `0010` renames the
    # column and hashes the rows already in it, so no device has to start over.
    device_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    # A come-back code lets the same account be reached again from another
    # browser, which a device token alone cannot do. Only derived values are
    # stored: an unsalted index to find the row, and a salted PBKDF2 digest to
    # check it. The code itself is never recoverable from the database.
    comeback_index: Mapped[str | None] = mapped_column(String(64), index=True)
    comeback_hash: Mapped[str | None] = mapped_column(String(128))
    # Optional, and deliberately tiny: the id of a Clerk account a student or
    # guardian chose to attach to this account, so their work can be opened again
    # on a phone this browser has never met. Clerk keeps the password, the email
    # and every proof of who that person is; this row keeps only the pointer, so
    # deleting a Clerk account over there can switch the pointer off here. No
    # email address is copied into this database — the profile screen reads it
    # from Clerk on the device that is signed in, which is the only place that
    # ever needs to show it.
    clerk_user_id: Mapped[str | None] = mapped_column(String(40))
    clerk_linked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # The site owner's own account, and nothing else. There is no admin sign-up, no
    # admin role in a token and no way to ask for it through an endpoint: the flag is
    # set in the database by `scripts/admin_grant.py`, which is run by somebody who
    # already owns the database. What it unlocks is exactly one group of routes
    # (`/api/study-abroad/admin/...`), each of which re-checks it server-side.
    #
    # Nullable, unlike every other column on this table that is not optional data. It
    # is the one thing here that has to be attached to a table already holding real
    # accounts, and `schema_sync.add_missing_columns` only ever adds nullable columns —
    # a NOT NULL column cannot go onto a table with rows in it. NULL is the answer
    # "not an admin", so widening an existing database gives nobody rights, and the
    # only rows that read as True are ones somebody granted on purpose.
    is_admin: Mapped[bool | None] = mapped_column(Boolean, default=False)
    # Set by `DELETE /api/users/me`. The row survives because two tables have to keep
    # their records whatever a person asks — `payments` is a money ledger and
    # `audit_events` is the log of who did what — and deleting the row would cascade
    # both away. Everything that made this row a person is removed at the same moment
    # this stamp is set: name, address, device digest, come-back code, Clerk pointer,
    # every conversation and every result. What is left is a shell with a date on it.
    erased_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    profile: Mapped[StudentProfile | None] = relationship(uselist=False)
    settings: Mapped[UserSettings | None] = relationship(uselist=False)
    resume: Mapped["Resume | None"] = relationship(uselist=False, back_populates="user")


class AuthToken(Base, TimestampMixin):
    __tablename__ = "auth_tokens"

    # The sha256 of the bearer string, never the string itself, for the same reason as
    # `users.device_hash` above: this table is the list of everyone currently signed in,
    # and holding it in plaintext made reading the database the same as being every one of
    # them. Still the primary key, so a lookup is one index probe and a logout is one
    # DELETE — the digest only replaced the value, not the shape of the table.
    # `created_at`, from the mixin, is the start of the session and therefore the anchor
    # for the absolute cap; `expires_at` is what rolling renewal moves.
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)


class StudentProfile(Base, TimestampMixin):
    __tablename__ = "student_profiles"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    class_level: Mapped[str | None] = mapped_column(String(16))  # e.g. "class-9"
    # The age in years, typed by the person it is about. `age_range` below is
    # derived from this rather than chosen beside it: a student states one number
    # and nobody has to guess which of five labelled bands they meant, while the
    # guide's framework and a portal's summary keep working in bands.
    age: Mapped[int | None] = mapped_column(SmallInteger)
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
    # 32, not the 16 this column shipped with. `interests.py` writes the literal
    # "interest_activity", which is 17 characters: SQLite stores a too-long value
    # without comment, so every laptop database in the world quietly held it, and the
    # first Postgres to be asked for it answered `value too long for type
    # character varying(16)`. Widening costs nothing; leaving it would have meant the
    # interest screen returning a 500 the moment this app moved onto a real database.
    # Migration 0009 carries the same change to a database that already exists.
    source: Mapped[str] = mapped_column(String(32), default="conversation")


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
    min_class: Mapped[int] = mapped_column(Integer, default=6)
    needs_verification: Mapped[bool] = mapped_column(Boolean, default=True)
    # `official_links` above is where a family is sent to check. These two are the
    # other side: the one page a person actually opened, and the day they opened it.
    # `verified_at` is stamped by whoever writes it, never supplied with the claim, so
    # a green badge can only ever mean "somebody read this on this date" — the same
    # rule the university and exam rows run on. NULL means nobody has, and the page
    # says so plainly rather than in a colour that reads as an error.
    source_url: Mapped[str | None] = mapped_column(String(500))
    verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


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


# ---------------------------------------------------------------------- exams
#
# The Indian entrance and school exams a class 9-12 student meets, and what each
# one opens. The shape comes from the screen: exams are read as "what do you become
# through it", so they sit under a group rather than in one flat list.
#
# What this table is *not* for is the running of an exam. There is no deadline, fee
# amount, eligibility percentage, age limit, cutoff, seat count or result date that
# anybody is asked to type in without a source, because those numbers change every
# year and a stale one on our page is a wrong thing a child plans around. The two
# columns that could hold such a value (`exam_date`, `fee_note`) are nullable, start
# empty in the seed, and the write route refuses to store a value in either of them
# unless the row also carries the address it was read from. See `app/routers/exams.py`.


class ExamGroup(Base, TimestampMixin):
    """One door — "become an engineer", "become a doctor" — with its exams under it."""

    __tablename__ = "exam_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    exams: Mapped[list[Exam]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="Exam.sort_order",
    )


class Exam(Base, TimestampMixin):
    __tablename__ = "exams"
    __table_args__ = (Index("ix_exams_group_active", "group_id", "is_active"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("exam_groups.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    # Whose exam it is, in the words the page prints ("Conducted by NTA"). Naming the
    # conducting body is how this page tells a student whose official site is the
    # authority, and it is the reason a fake alert can be checked against something.
    authority: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    careers: Mapped[str] = mapped_column(Text)
    timeline: Mapped[str] = mapped_column(Text)
    preparation: Mapped[str] = mapped_column(Text)
    # --- Nothing below is filled in from memory. -------------------------------
    # Both are free text rather than a `Date` or a number on purpose: the honest record
    # of what an official notification says is the sentence the notification uses, and
    # a column typed as a date would invite a value that was never stated anywhere.
    exam_date: Mapped[str | None] = mapped_column(String(120))
    fee_note: Mapped[str | None] = mapped_column(Text)
    # The page the value above was read off. Required before either can be stored, and
    # printed beside it, so a student sees who says the fee is what the row says.
    source_url: Mapped[str | None] = mapped_column(String(500))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    group: Mapped[ExamGroup] = relationship(back_populates="exams")


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
    # The page the row was compared against, which for a scheme is often not the apply
    # page above: a benefit amount usually lives in a notification or a brochure on the
    # ministry's own domain, while `official_url` is the portal a student signs into.
    source_url: Mapped[str | None] = mapped_column(String(500))
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


# ------------------------------------------------------------------- the resume

# A student's own CV, built for a career they have chosen rather than generated
# from a profile of them. The three lists are JSON because they are read and
# written as one document by one person, never queried row by row — splitting them
# into tables would buy nothing and cost a join on every page load.
#
# `user_id` is the primary key rather than a column beside a surrogate id, exactly
# as `UserSettings` does it: one resume per account is then something the database
# enforces, not something every route has to remember to check. It also means the
# route that saves can look the row up by the id the session proved, and cannot be
# talked into writing somebody else's.
#
# No name, phone, address, email or photo is stored here. The name at the top of
# the printed page is the one already on the account, and the erasure route
# already clears that — a second copy in this table would be a copy left behind.


class Resume(Base):
    __tablename__ = "resumes"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # The job this CV is aimed at, e.g. "Software Engineer". It is the only thing
    # the AI suggestions are asked about, so it is stored rather than retyped: a
    # student who came back next month should not have to explain the target again.
    target_role: Mapped[str | None] = mapped_column(String(120))
    education: Mapped[list] = mapped_column(JSON, default=list)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    projects: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="resume")


# ----------------------------------------------------------------- assessments

# Three self-questionnaires: RIASEC interests, a Big Five-style habits inventory,
# and an untimed puzzle set. They are deliberately separate from
# `InterestObservation`, which stays unstructured evidence from conversation.
# Scoring happens only on the server, and `Question.correct_value` is never sent
# to a browser — otherwise the answer key of the puzzle set is one DevTools click
# away from every child using it.


class Assessment(Base, TimestampMixin):
    """One student's sitting of one instrument, from Start to Submit."""

    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    assessment_type: Mapped[str] = mapped_column(String(16))  # interest | personality | aptitude
    language: Mapped[str] = mapped_column(String(8), default="en")
    # Which version of the question bank this sitting used, so an answer set can
    # still be scored correctly after the bank changes.
    bank_version: Mapped[str] = mapped_column(String(8), default="1")
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    status: Mapped[str] = mapped_column(String(16), default="in_progress")

    responses: Mapped[list[Response]] = relationship(
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="Response.id",
    )
    result: Mapped[Result | None] = relationship(
        back_populates="assessment", uselist=False, cascade="all, delete-orphan"
    )


class Question(Base, TimestampMixin):
    """One item of the bank, loaded from `data/assessment_questions.json`."""

    __tablename__ = "assessment_questions"
    __table_args__ = (
        UniqueConstraint("assessment_type", "code", name="uq_assessment_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_type: Mapped[str] = mapped_column(String(16), index=True)
    code: Mapped[str] = mapped_column(String(12))
    dimension: Mapped[str] = mapped_column(String(24))
    order: Mapped[int] = mapped_column(Integer, default=0)
    response_type: Mapped[str] = mapped_column(String(8), default="likert")
    # "+" agrees with its dimension, "-" is reverse-worded and flips the scale.
    keyed: Mapped[str] = mapped_column(String(2), default="+")
    text_en: Mapped[str] = mapped_column(Text)
    text_hi: Mapped[str] = mapped_column(Text)
    options_json: Mapped[list] = mapped_column(JSON, default=list)
    correct_value: Mapped[str | None] = mapped_column(String(8))


class Response(Base, TimestampMixin):
    """One saved answer. Autosaved as the student goes, so a closed tab loses nothing."""

    __tablename__ = "assessment_responses"
    __table_args__ = (
        UniqueConstraint("assessment_id", "code", name="uq_assessment_answer"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    # The item code is kept alongside the id: a result stays readable even if the
    # bank is edited or these rows are ever pruned.
    code: Mapped[str] = mapped_column(String(12))
    question_id: Mapped[int | None] = mapped_column(
        ForeignKey("assessment_questions.id", ondelete="SET NULL")
    )
    value: Mapped[str] = mapped_column(String(8))

    assessment: Mapped[Assessment] = relationship(back_populates="responses")


class Result(Base, TimestampMixin):
    """The scored outcome of one sitting, stored in the language it was taken in."""

    __tablename__ = "assessment_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), unique=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    assessment_type: Mapped[str] = mapped_column(String(16))
    # Normalised 0-100 per dimension, plus how many items carried that number.
    score_json: Mapped[dict] = mapped_column(JSON, default=dict)
    traits_json: Mapped[list] = mapped_column(JSON, default=list)
    detail_json: Mapped[dict] = mapped_column(JSON, default=dict)
    # The skill gap and the four weeks that close a little of it, written by
    # `services/roadmap.py`. Stored as data rather than sentences so the page can be
    # read in either language, and kept on this row rather than in its own table
    # because a plan belongs to exactly one sitting: delete the result and the plan
    # goes with it, which is the only erase path this app has.
    roadmap_json: Mapped[dict | None] = mapped_column(JSON, default=dict)
    completed_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    assessment: Mapped[Assessment] = relationship(back_populates="result")


class PdfReport(Base, TimestampMixin):
    """A generated report, kept so the same download is not rendered twice.

    The bytes live in this row rather than in a file: the deployed backend has no
    writable persistent disk, and a PDF sitting next to the database would be a
    second copy of a child's answers that no delete path knows about. Deleting the
    student deletes the document with it, which is the only promise here that a
    directory of files could quietly break.

    `result_ids` records which sittings the document holds. A student who finishes
    another questionnaire after this was generated has a different set, and the
    cached file is then stale rather than cheap — the route compares them.

    The unique key is the student and the language, not the questionnaire the button
    was pressed on. The document always holds every finished questionnaire, so
    keying it on the anchor would store three identical copies of a child's answers
    for a student who opened three result pages — more data, and no way to say which
    file is theirs. `anchor_result_id` records the sitting the request named, and
    deleting it still cascades this row away with the rest.
    """

    __tablename__ = "report_pdfs"
    __table_args__ = (UniqueConstraint("student_id", "language", name="uq_report_pdf"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    anchor_result_id: Mapped[int] = mapped_column(
        ForeignKey("assessment_results.id", ondelete="CASCADE"), index=True
    )
    language: Mapped[str] = mapped_column(String(8), default="en")
    filename: Mapped[str] = mapped_column(String(96))
    result_ids: Mapped[list] = mapped_column(JSON, default=list)
    pdf_bytes: Mapped[bytes] = mapped_column(LargeBinary)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    generated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)


# ---------------------------------------------------------------- money


class Subscription(Base, TimestampMixin):
    """Which plan an account is on, and until when. One row per account.

    The user id is the primary key, so an account cannot hold two live plans and
    a billing screen never has to guess which row wins.

    There is no `status` column. Whether a plan is active is a comparison between
    `expires_at` and the current time, and storing that answer as well would give
    two places to keep in step — one of which (this one) could say "active" for a
    period that ended last week and keep a paid feature unlocked after it lapsed.

    `source` is what makes a school licence possible without pretending a payment
    happened: `granted` means a person set this plan by hand, so nothing here
    claims a rupee moved.
    """

    __tablename__ = "subscriptions"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # A code from app/services/plans.py, never a free-text name: an unknown code
    # has to be refused, not treated as "some kind of paid plan".
    plan_code: Mapped[str] = mapped_column(String(24), default="free")
    source: Mapped[str] = mapped_column(String(12), default="free")  # free|payment|granted
    interval: Mapped[str | None] = mapped_column(String(12))  # monthly | yearly
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # None means this plan does not end on its own — a granted school licence, or
    # the free plan. A paid period always has one.
    expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    changed_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user: Mapped[User] = relationship()


class Payment(Base, TimestampMixin):
    """One Razorpay order, and whatever the provider later said about it.

    What is deliberately *not* here: a card number, an expiry, a CVV, a bank
    account, or the payment entity's own JSON. Razorpay's iframe collects the card
    and this server never sees it, so storing the provider's raw webhook payload
    would import a copy of `card.last4`, the issuer and the cardholder name into a
    database that also holds children's answers — for no feature anyone asked for.
    These columns hold only what this app needs to show an invoice and to know
    whether it already unlocked a plan.

    Amounts are in paise (₹1 = 100). Rupees as a float is how 299.00 becomes
    298.9999999 and an invoice stops matching the money that was actually taken.

    `status` only ever advances on proof: a signature this server checked itself,
    either on the browser's checkout callback or on a webhook delivery. A browser
    claiming "it worked" is not proof, and the route that accepts it is the one
    that verifies the HMAC before writing a single column.
    """

    __tablename__ = "payments"
    __table_args__ = (
        # Unique *indexes*, matching how `users.clerk_user_id` is done, so the
        # migration can reproduce them on both engines. Both are nullable: an
        # order that was never paid has no payment id yet, and SQLite and Postgres
        # both allow many NULLs in a unique index.
        Index("ix_payments_order_id", "order_id", unique=True),
        Index("ix_payments_payment_id", "payment_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(16), default="razorpay")
    # The order we created server-side. A checkout that names an order id this
    # server never issued is refused, which is what stops someone from paying
    # ₹1 for a yearly plan by editing a request.
    order_id: Mapped[str] = mapped_column(String(64))
    payment_id: Mapped[str | None] = mapped_column(String(64))
    plan_code: Mapped[str] = mapped_column(String(24))
    interval: Mapped[str] = mapped_column(String(12))
    amount_paise: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    status: Mapped[str] = mapped_column(String(12), default="created")
    # created | captured | failed | refunded
    failure_reason: Mapped[str | None] = mapped_column(String(200))
    # Our own short reference, printed on the checkout sheet and on the invoice.
    # It names no person, so it is safe to send to the provider as `receipt`.
    receipt: Mapped[str] = mapped_column(String(48))
    captured_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # A student account on a school-issued laptop must not be able to reach a payment
    # provider on its own. The checkout therefore refuses to open until the person at
    # the keyboard states they are an adult entitled to pay for this student. It is a
    # self-declaration, not a proof of age, and it is recorded per order so the reason
    # a payment was allowed can be read back later. What actually identifies the payer
    # is the payment method itself — a card or UPI handle in that adult's name, held by
    # Razorpay, never by this database.
    adult_attested: Mapped[bool] = mapped_column(Boolean, default=False)
    # Recorded from the key that made the payment (rzp_test_ vs rzp_live_). Kept
    # per row because one deployment can hold both, and nobody should have to
    # work out later which test payments were money.
    test_mode: Mapped[bool] = mapped_column(Boolean, default=True)


# ------------------------------------------------------------------- the outbox


class EmailJob(Base, TimestampMixin):
    """A message the account asked for, waiting for a process that can send it.

    Serverless hosting has no worker, no queue and no clock: between two requests
    nothing runs at all. So a non-critical message is a row here, drained by the
    next request that touches it and by `scripts/email_worker.py` for a host that
    has a cron. The documented limit is the flip side of that and is stated in the
    README rather than hidden: on a quiet deployment, a queued message waits until
    somebody arrives.

    Two things this row does *not* hold, both deliberate:

    * **No address.** `user_id` is the whole recipient, and the drain reads the
      confirmed address from that row at the moment of sending. A copy of an email
      address in a job table is a second place it can be leaked and a second place
      "delete my data" has to remember; and it means an address removed mid-week
      stops receiving immediately, including for a job queued before the removal.
    * **No message body.** `ref_id` points at the result or the payment the note is
      about, and the numbers are read again at drain time. A stored context would
      be a stale snapshot of a child's questionnaire, kept after the child deleted
      the sitting it came from.

    A job that has failed `EMAIL_JOBS_MAX_ATTEMPTS` times stays failed. A mailbox
    that has refused an address four times is not going to start accepting it, and
    every further retry is a paid call to a third party about a person who cannot
    get their message.
    """

    __tablename__ = "email_jobs"
    __table_args__ = (
        # What the drain asks, every time: rows that are waiting and may be tried
        # now, oldest first.
        Index("ix_email_jobs_due", "status", "next_attempt_at"),
        # One message per account per purpose per thing. Without these, a student who
        # refreshes the submit page twice gets their result mailed twice, the browser's
        # callback and the provider's webhook for one payment each write a receipt, and
        # two requests that arrive in the same minute both notice that the week ended.
        #
        # Two indexes rather than one, and the reason is the one thing about NULL that
        # surprises people: a unique index over a column that is NULL treats every row
        # as distinct, on SQLite and PostgreSQL alike. A result copy and a receipt name
        # a row (`ref_id`, no `ref_key`); a digest names a week (`ref_key`, no
        # `ref_id`). One four-column index would have refused neither. Each of these is
        # partial over the column it needs, so both are enforced where they apply.
        Index(
            "ux_email_jobs_ref",
            "user_id",
            "purpose",
            "ref_id",
            unique=True,
            sqlite_where=text("ref_id is not null"),
            postgresql_where=text("ref_id is not null"),
        ),
        Index(
            "ux_email_jobs_week",
            "user_id",
            "purpose",
            "ref_key",
            unique=True,
            sqlite_where=text("ref_key is not null"),
            postgresql_where=text("ref_key is not null"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # A purpose from app/services/email_jobs.py's QUEUED: email_result | email_digest
    # | receipt. The first two are named for the consent they record, so the row that
    # authorises the send and the row that says it was agreed to are the same concept
    # rather than two lists to keep in step.
    purpose: Mapped[str] = mapped_column(String(32))
    # The assessment result or payment this message is about. NULL only where no
    # single row is the reason.
    ref_id: Mapped[int | None] = mapped_column(Integer)
    # For a digest: the Monday (India) it summarises, so a re-run of the same week
    # dedupes instead of mailing twice.
    ref_key: Mapped[str | None] = mapped_column(String(24))
    status: Mapped[str] = mapped_column(String(12), default="pending")
    # pending | sent | failed | stale | skipped
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    sent_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # The transport's own status word ("rejected", "not-configured"), never a
    # provider message: Resend's error text quotes the address it was given.
    detail: Mapped[str | None] = mapped_column(String(60), nullable=True)


# --------------------------------------------------------------- study abroad

# A directory of foreign universities, the services sold around it, and the enquiries
# that come in. The whole design of these five tables is one rule taken from
# `app/seed/__init__.py`: **a fact is stored with the place it came from and the day
# somebody read it, or it is not shown as a fact.**
#
# Tuition, intake months, application deadlines and visa routes move every year, and
# this repository cannot verify a hundred institutions. So every one of those columns
# is nullable, `verified` defaults to False, and the pages print "Not verified yet —
# check the university's own site" instead of a plausible number. A guessed fee on a
# child's study-abroad page is worse than an empty one: it is the kind of figure a
# family budgets against.
#
# The second rule is that this section is separate from the career guidance. Nothing
# here is read by `services/recommendations.py`, no lead feeds a recommendation, and a
# sponsored university is labelled on screen rather than ranked higher.


class StudyCountry(Base, TimestampMixin):
    """One destination: what it is like to study there, and where the rules live."""

    __tablename__ = "study_countries"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    code: Mapped[str] = mapped_column(String(3), default="")
    # Our own prose, not a restatement of immigration law. Where a legal fact has to
    # be mentioned the row points at the official portal instead of summarising it,
    # because a summary of visa rules is a thing that silently goes wrong.
    overview: Mapped[str] = mapped_column(Text)
    language_note: Mapped[str | None] = mapped_column(Text)
    intake_note: Mapped[str | None] = mapped_column(Text)
    cost_note: Mapped[str | None] = mapped_column(Text)
    work_after_note: Mapped[str | None] = mapped_column(Text)
    # What a family still has to check themselves, listed as questions rather than
    # answers. This is the honest version of a "visa process" section.
    to_check: Mapped[list] = mapped_column(JSON, default=list)
    visa_portal_url: Mapped[str | None] = mapped_column(String(500))
    visa_portal_label: Mapped[str | None] = mapped_column(String(120))
    qualifications_portal_url: Mapped[str | None] = mapped_column(String(500))
    qualifications_portal_label: Mapped[str | None] = mapped_column(String(120))
    # Set only when a human actually opened the portal above and re-read this row.
    # NULL means the copy below has not been checked against a source in this app's
    # knowledge, and the page says so.
    checked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class University(Base, TimestampMixin):
    """A foreign institution, with the parts nobody has verified kept empty.

    The sibling of `Institution` above, which is a directory of Indian colleges. Two
    tables rather than one because the columns a family needs here are different
    (country, intakes, an English-proficiency requirement, a national application
    portal), and because folding a hundred foreign rows into `institutions` would make
    every existing Indian-college query depend on remembering a new filter.
    """

    __tablename__ = "study_universities"
    __table_args__ = (Index("ix_study_universities_country", "country_id", "is_active"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    country_id: Mapped[int] = mapped_column(
        ForeignKey("study_countries.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    city: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(16), default="public")  # public|private
    # The university's own domain. This is the one claim besides the name that a
    # seeded row makes confidently, and it is the link every unverified field below
    # tells the reader to go and check.
    official_url: Mapped[str] = mapped_column(String(400))
    founded_year: Mapped[int | None] = mapped_column(Integer)
    summary: Mapped[str | None] = mapped_column(Text)
    areas: Mapped[list] = mapped_column(JSON, default=list)
    # --- Everything below stays NULL until somebody reads it off the source. -------
    tuition_note: Mapped[str | None] = mapped_column(Text)
    intakes: Mapped[list] = mapped_column(JSON, default=list)
    application_urls: Mapped[dict] = mapped_column(JSON, default=dict)
    english_test_note: Mapped[str | None] = mapped_column(Text)
    deadline_note: Mapped[str | None] = mapped_column(Text)
    # Where the number above came from, and when it was true. A fee with no date on it
    # is a fee that will quietly become wrong.
    source_url: Mapped[str | None] = mapped_column(String(500))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # Paid placement of an institution in this directory, disclosed rather than
    # hidden, and never used to order the list. See the module note above.
    sponsored: Mapped[bool] = mapped_column(Boolean, default=False)
    sponsorship_disclosure: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    country: Mapped[StudyCountry] = relationship()


class StudyService(Base, TimestampMixin):
    """What the platform does for a family, described without a promise.

    `outcomes` is deliberately absent. A service page here can say what the work
    involves and what it does not include; it cannot say what a university will decide.
    """

    __tablename__ = "study_services"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(120))
    summary: Mapped[str] = mapped_column(Text)
    detail: Mapped[str | None] = mapped_column(Text)
    # What actually happens, step by step, in the order it happens.
    steps: Mapped[list] = mapped_column(JSON, default=list)
    includes: Mapped[list] = mapped_column(JSON, default=list)
    # As important as `includes`: the thing a family assumes is covered and is not.
    not_included: Mapped[list] = mapped_column(JSON, default=list)
    who_for: Mapped[str | None] = mapped_column(Text)
    fees_note: Mapped[str | None] = mapped_column(Text)
    # A service may be listed on the page without being offered yet. `available` is
    # what a CTA checks: an unavailable service is shown as coming soon and has no
    # button that pretends otherwise.
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class StudyLead(Base, TimestampMixin):
    """One consultation request, kept detached from every account.

    There is no `user_id` column here on purpose. A marketing enquiry about studying
    abroad is not part of a child's career record, and linking the two would let a
    commercial follow-up reach an account whose consent for it was never asked. The
    row holds what the person typed, nothing derived, and it is deleted on request.

    `consent_contact` is stored rather than inferred: the form's checkbox has to be
    ticked for a row to exist at all, and the timestamp of the tick is the only proof
    there is of who agreed to what.
    """

    __tablename__ = "study_leads"
    __table_args__ = (Index("ix_study_leads_status", "status", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    # The address is stored in plaintext because it is the thing the operator has to
    # write back to. It is not confirmed by a link, so it is also the reason the
    # acknowledgement mail is the only mail this row can ever cause.
    email: Mapped[str] = mapped_column(String(254), index=True)
    phone: Mapped[str | None] = mapped_column(String(24))
    # Where they are at, chosen from a short list. Never an exact school, never a city.
    stage: Mapped[str | None] = mapped_column(String(32))
    country_id: Mapped[int | None] = mapped_column(
        ForeignKey("study_countries.id", ondelete="SET NULL")
    )
    service_id: Mapped[int | None] = mapped_column(
        ForeignKey("study_services.id", ondelete="SET NULL")
    )
    message: Mapped[str | None] = mapped_column(Text)
    # Which page sent the form. Useful for the operator, and one short string of
    # tracking data rather than a behavioural record.
    source_page: Mapped[str | None] = mapped_column(String(120))
    consent_contact: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_contact_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # new | contacted | closed
    # No `index=True` here: the composite `ix_study_leads_status` in `__table_args__`
    # already leads with this column, and a second index of the same name on the same
    # table is what `index=True` would have tried to create.
    status: Mapped[str] = mapped_column(String(16), default="new")
    admin_note: Mapped[str | None] = mapped_column(Text)
    handled_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    country: Mapped[StudyCountry | None] = relationship()
    service: Mapped[StudyService | None] = relationship()


class StudyStory(Base, TimestampMixin):
    """A published account from a real family, entered by the site owner.

    Seeded with zero rows. A testimonial about admissions is a claim that something
    happened to somebody, and this repository cannot make that up: an invented success
    story is the most persuasive and least verifiable content a site aimed at
    seventeen-year-olds can carry. So the table, the admin form and the page section
    all exist, and the page says nothing has been published until the owner publishes
    something with `consent_confirmed_at` set.
    """

    __tablename__ = "study_stories"

    id: Mapped[int] = mapped_column(primary_key=True)
    headline: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    # However the person asked to be named: a first name, initials, or a role. An
    # address, a school and a city are not needed for a quote to be real.
    attribution: Mapped[str] = mapped_column(String(80))
    country_id: Mapped[int | None] = mapped_column(
        ForeignKey("study_countries.id", ondelete="SET NULL")
    )
    university_id: Mapped[int | None] = mapped_column(
        ForeignKey("study_universities.id", ondelete="SET NULL")
    )
    year: Mapped[int | None] = mapped_column(Integer)
    # The day the named person agreed to this being published. Publishing without it
    # is refused by the admin route, not just discouraged.
    consent_confirmed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    country: Mapped[StudyCountry | None] = relationship()
    university: Mapped[University | None] = relationship()


# ------------------------------------------------------------- organisations

# A school and a counsellor's practice are both *organisations*: a row that owns a set
# of memberships and a look, and nothing else. Everything these four tables allow is
# governed by one rule, repeated where it is enforced:
#
#     **no work of a child is readable through a membership until the child (or their
#     guardian) accepts the invite, and even then only what that account switched on.**
#
# A school that bulk-invites fifty addresses gets fifty `invited` rows and zero
# answers. That is not a delay in the feature; it is the feature.
#
# `users.role` is deliberately unchanged by this section. It stays `student | parent` —
# what the account is to its own family. `counsellor` and `school_admin` are roles
# *inside one organisation*, read from the membership row on every request, so a person
# can be a parent at home and a counsellor at work without either half overwriting the
# other. A token still carries no role at all (see `app/security.py`), and nothing here
# touches `users.is_admin`, which is the platform owner's flag and is still set only by
# `scripts/admin_grant.py`.


class Organization(Base, TimestampMixin):
    """One school, or one independent counsellor's practice.

    `slug` does two jobs and is careful about both. It is the stable name in
    `/api/organizations/{slug}/...`, and the left-hand label of a branded subdomain
    (`green-school.careerguide.ai`). It is never an authorisation input: the middleware
    that reads the Host header only decides which portal to *show*, and every route
    re-checks the caller's membership row against the slug it was handed. A request
    that arrives on somebody else's subdomain is therefore refused for lacking a
    membership, not granted one by the address bar.

    `tier_code` is a catalogue code from `app/services/reseller.py` — the platform's
    published wholesale tier for a reselling practice. It is not a price anybody is
    charged today: no tier is purchasable, and the payment routes keep refusing a
    subscription whose plan is not sellable. A counsellor's own retail prices are not
    stored here at all; they are that practice's business, and nothing in this
    repository lets them influence the guidance a client is given.
    """

    __tablename__ = "organizations"
    __table_args__ = (Index("ix_organizations_kind_active", "kind", "is_active"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # Lowercase letters, digits and single hyphens, 3-40 characters. Validated in
    # `app/schemas.py` and re-validated by the resolver in
    # `app/middleware/tenant.py` rather than trusted from it: the two places have to
    # agree, or a name the browser can reach would be one the API cannot address.
    slug: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    # school | counsellor. Not free text: the two portals differ in what their members
    # may do, and a third kind would need those rules written first.
    kind: Mapped[str] = mapped_column(String(16), index=True)
    name: Mapped[str] = mapped_column(String(120))
    tier_code: Mapped[str] = mapped_column(String(24), default="free")
    # Whether the platform has confirmed this is the institution it says it is. A
    # portal's public label reads from this rather than from the name somebody typed,
    # so "verified school" cannot be self-declared from a form.
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class OrganizationBranding(Base, TimestampMixin):
    """The look an organisation may put on its own portal, and nothing beyond it.

    One row per organisation, keyed by `organization_id`, so there is no "which
    branding is current" query to get wrong. These fields change a heading, a logo and
    an accent colour on pages reached through that organisation's members. Three things
    they cannot do are the reason the table is allowed to exist:

    * `logo_url` is a URL, not an upload. There is no tenant file storage here, and a
      logo the platform hosts would outlive the school that uploaded it.
    * `accent_color` is matched against a small fixed palette at the route, because a
      free-form colour can make a warning look like a button — and on a child's result
      screen that is a design failure, not a branding choice.
    * Nothing in this row is read by `services/recommendations.py`. A school's branding
      cannot change what its students are told, the same firewall this app holds
      against sponsored universities.

    `welcome_note` is the one free-text field, and it is the one a child reads before
    deciding whether to join, so the route caps its length and the portal renders it
    under the platform's own label rather than in place of it.
    """

    __tablename__ = "organization_branding"

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True
    )
    portal_title: Mapped[str | None] = mapped_column(String(80))
    welcome_note: Mapped[str | None] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    # A "#rrggbb" value from the palette, or NULL for the platform's own.
    accent_color: Mapped[str | None] = mapped_column(String(7))
    changed_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Membership(Base, TimestampMixin):
    """One person's place inside one organisation.

    Both halves of the access rule live in these columns:

    * **`status = "invited"` reads nothing.** An invite writes a row holding an address
      and a digest of a token, and no `user_id`. No query in this repository joins a
      child's conversations, sittings or results to an `invited` membership, and only
      the accept route sets `active` — which it can do solely for the account that
      presents the token, i.e. the child's own browser or their guardian's. A school
      has no route that activates a membership on a student's behalf.
    * **`org_role` is scoped to this row.** One of `student | parent | counsellor |
      school_admin`, read from the database on every request, never from the bearer
      string. Two memberships in two organisations can hold two different roles, and
      neither changes `users.role` or makes anybody a platform admin.

    `user_id` and `invited_email` are both nullable rather than one required column
    because a school's roster exists before its students' accounts do. The two partial
    unique indexes in `__table_args__` are what keeps that honest; the comment there
    explains why they are partial.

    `share_results` is the member's own switch, not the organisation's. It is set by
    the accept call and changeable from the account's own settings, and no
    organisation route may write it — a school cannot decide that its students' reports
    are visible to the school.
    """

    __tablename__ = "memberships"
    __table_args__ = (
        # One person, one place per organisation; one address per organisation. Both
        # are partial, and the reason is the one thing about NULL that surprises
        # people: a unique index over a NULL column treats every row as distinct on
        # SQLite and PostgreSQL alike. An `invited` row has no `user_id` and a joined
        # row has no need for an address, so a plain composite unique would have
        # refused neither.
        Index(
            "ux_memberships_org_user",
            "organization_id",
            "user_id",
            unique=True,
            sqlite_where=text("user_id is not null"),
            postgresql_where=text("user_id is not null"),
        ),
        Index(
            "ux_memberships_org_email",
            "organization_id",
            "invited_email",
            unique=True,
            sqlite_where=text("invited_email is not null"),
            postgresql_where=text("invited_email is not null"),
        ),
        # The accept route has the token and nothing else.
        Index("ix_memberships_invite_hash", "invite_hash"),
        # What both dashboards ask: this organisation's members, by status.
        Index("ix_memberships_org_status", "organization_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    # NULL until the person joins. The join is what gives it a value, and it is the
    # only path that can.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # student | parent | counsellor | school_admin
    org_role: Mapped[str] = mapped_column(String(16))
    # invited | active | revoked
    status: Mapped[str] = mapped_column(String(12), default="invited")
    # The address the invite was sent to, normalised to lowercase. It is the school's or
    # the practice's own data about a person they already employ or enrol; it is not
    # used to address anybody in a message, and it goes when the membership or the
    # organisation goes.
    invited_email: Mapped[str | None] = mapped_column(String(254))
    # SHA-256 of the single-use invite token, never the token: a plaintext token in a
    # row is a way to join an organisation with one UPDATE that never went through the
    # route holding the checks. Same reasoning as `users.email_confirm_hash`.
    invite_hash: Mapped[str | None] = mapped_column(String(64))
    invite_expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # Checked only while the row is still `invited`. A live membership does not expire
    # on a clock; it ends when a person leaves or the platform removes them.
    joined_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # What the inviter typed as this person's name, so a roster screen is readable
    # before anyone joins. Never used to greet the child, never sent in a message, and
    # never joined to anything the child has written.
    display_label: Mapped[str | None] = mapped_column(String(80))
    share_results: Mapped[bool] = mapped_column(Boolean, default=False)
    # A school assigning a counsellor to a student is an assignment of *contact*, not
    # of data: it names one of the organisation's own counsellor memberships and grants
    # nothing beyond what that counsellor's accepted membership already allows.
    assigned_counsellor_id: Mapped[int | None] = mapped_column(
        ForeignKey("memberships.id", ondelete="SET NULL")
    )

    organization: Mapped[Organization] = relationship()


class SessionNote(Base, TimestampMixin):
    """What a counsellor records about a meeting, kept out of the client's timeline.

    A note is the most sensitive row in this section because it is written *about* a
    person rather than by them, so the columns encode three refusals:

    * `author_user_id` is required, and reads are scoped to the author's own
      organisation. A counsellor who leaves a practice stops being able to reach their
      notes, because access runs through the membership, not through the account.
    * `client_membership_id` has to be an **active** membership. A note cannot be
      attached to an invite that has not been accepted — writing about a child who has
      not agreed to the arrangement is something this table cannot represent.
    * `shared_with_family` starts False. A note is private working text until the
      counsellor deliberately switches it, and the family view renders only the rows
      with it on, together with the day they were shared.

    Two things this table is not. It is not a clinical record: the standing rule that
    the app never infers a diagnosis, an intelligence level or a sensitive
    characteristic still holds when a human types, which is why the portal's own copy
    asks for sessions and next steps rather than judgements about a child. And it is
    not a place for a child's own words — transcripts are reachable only through
    `share_results` and the existing guardian rules, never by pasting them into a note.
    """

    __tablename__ = "session_notes"
    __table_args__ = (
        Index("ix_session_notes_client", "client_membership_id", "created_at"),
        Index("ix_session_notes_author", "author_user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Denormalised alongside the client on purpose: every query here is scoped by
    # organisation first, and keeping the column means isolation cannot depend on
    # remembering to join one table further.
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    client_membership_id: Mapped[int] = mapped_column(
        ForeignKey("memberships.id", ondelete="CASCADE")
    )
    author_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    shared_with_family: Mapped[bool] = mapped_column(Boolean, default=False)
    shared_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    edited_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class AuditEvent(Base, TimestampMixin):
    """A record of an operator having done something, and nothing more.

    The admin screens change live data: they flip who runs the site, disable an
    account, edit a career entry, answer a family's enquiry. Each of those writes a
    row here so that a later question — "when did this stop being available, and who
    made it stop?" — has an answer that does not depend on anyone remembering to
    mention it.

    What a row deliberately does **not** hold, and why:

    * No request body. A mutation's old value and new value are summarised in `detail`
      as a short string written by the route, never as a dump of the record. The
      records an admin touches include a student's name and a family's enquiry, and a
      log is read by whoever has the run of this deployment — which is not the same
      person as the one who was entitled to that row.
    * No conversation content. The one subject type that could have smuggled it in is
      a transcript, and there is no route here that writes about a transcript.
      Messages stay behind the guardian rules in `routers/conversations.py`.
    * No IP address or user agent. The privacy page tells people we do not store
      location or device fingerprints; an operator log that quietly kept a geolocation
      and a browser string per action would make that sentence false. `origin` says
      which surface the call came from (`api`, `webhook`, `script`), which is the part
      that actually helps read the log.
    * No new identity table. `actor_user_id` is nullable and `actor_name` is a
      snapshot: an admin account that is later deleted must leave behind a legible
      history, and a settled `SET NULL` with the name still printed does that without
      keeping the account alive to satisfy a foreign key.

    Append-only by construction: there is no delete route, no update route, and the
    table is not exposed to anything but `GET /api/admin/audit`. A log you can edit is
    a log nobody can trust, and the operator who wants their own action gone is the
    same person who has the keys to remove it.
    """

    __tablename__ = "audit_events"
    __table_args__ = (
        Index("ix_audit_events_actor_time", "actor_user_id", "created_at"),
        Index("ix_audit_events_action", "action", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Nullable for the reason above: the account may be gone by the time somebody
    # reads this row, and the row has to keep meaning something when it is.
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    actor_name: Mapped[str | None] = mapped_column(String(80))
    # A stable, dotted verb the route controls — `user.admin_grant`, `user.status`,
    # `career.update`, `lead.reply`. Never free text, so the list stays filterable and
    # two screens cannot invent two names for one action.
    action: Mapped[str] = mapped_column(String(48))
    subject_type: Mapped[str | None] = mapped_column(String(24))
    subject_id: Mapped[str | None] = mapped_column(String(48))
    # Short, human, and written by the route that knows what changed. Capped by the
    # column so a bug that tries to log a whole record fails at insert instead of
    # filling the table with somebody's data.
    detail: Mapped[str | None] = mapped_column(String(400))
    origin: Mapped[str] = mapped_column(String(16), default="api")
