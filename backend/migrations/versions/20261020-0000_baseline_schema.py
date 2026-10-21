"""Baseline schema: every table that existed before the revision chain started.

Revision ID: 0000_baseline_schema
Revises:
Create Date: 2026-10-20

This revision exists because of one sentence in `docker-compose` land: `alembic upgrade
head` against an empty PostgreSQL used to fail with `relation "users" does not exist`.
`0001_assessment_tables` points a foreign key at `users` and does not create it, because
when it was written the app created tables itself on first boot (`Base.metadata
.create_all`) and an operator was told to `alembic stamp` over the top. SQLite tolerates
a `CREATE TABLE` whose foreign key names a table that is not there yet; PostgreSQL
refuses the DDL outright. So the order that works on a laptop — migrations first, core
tables later — was not buildable from nothing on the database a deployment actually uses.

A baseline is the standard answer: revision 0 creates the whole schema, so `upgrade
head` alone can build a database from empty, and `db_init.py`/`create_all` become a
local convenience rather than a precondition.

Two things make this file different from the revisions after it, and both matter when it
is edited:

* **It is a photograph, not a mirror.** It describes the schema as it stood on
  2026-10-17, the day `0001` landed — not the schema `app/models.py` describes today.
  The seven columns `0003`/`0005`/`0008` add to `users` are deliberately absent here,
  along with the two indexes that arrive with them, and `interest_observations.source`
  is 16 characters because `0009` widens it. Generate this from the live models and a
  fresh database breaks two revisions later: `add_column` on a column that is already
  there. Nothing here may be "fixed" to match the current models — later changes get a
  later revision. `scripts/migration_test.py` is what keeps that honest; it builds the
  schema from the chain, builds it from the models, and compares all 37 tables column by
  column.
* **It is pure DDL.** No `SELECT`, no `inspect()`, no data. `alembic upgrade head --sql`
  has to render this for CI without connecting, which is how a deployment reads the diff
  before applying it.

Arrival paths, now that the chain owns the whole schema:

* Empty database → `alembic upgrade head`. That is the case this revision fixes, and the
  container entrypoint relies on it.
* Database the app already built with `create_all`, holding rows → `alembic stamp
  0000_baseline_schema` first (or let `docker-entrypoint.sh` do it: no
  `alembic_version` table plus tables present means it stamps head and upgrades from
  there). Stamping records the revision without running it; without that step this
  revision would try to create tables that exist and fail.

Written to match `app/models.py` exactly, including the JSONB variant hosted PostgreSQL
gets and the plain `DATETIME` columns the app's `UTCDateTime` type renders — that type
stores naive UTC and adds the offset back on read, so nothing tz-aware reaches the DDL.
Creation order is dependency order: `users` first, then everything that points at it.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0000_baseline_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Generic JSON on SQLite (stored as TEXT), JSONB on PostgreSQL so the columns stay
# indexable there — the same object the models build.
JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    # --- identity ---------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("preferred_language", sa.String(length=8), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        # The device is the account in this app: there is no password to verify, so
        # nothing here is a secret that has to be salted. `comeback_index` is the
        # unsalted digest a come-back code is looked up by, and `comeback_hash` is the
        # PBKDF2 over the code itself.
        sa.Column("device_id", sa.String(length=64), nullable=True),
        sa.Column("comeback_index", sa.String(length=64), nullable=True),
        sa.Column("comeback_hash", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_device_id", "users", ["device_id"])
    op.create_index("ix_users_comeback_index", "users", ["comeback_index"])

    op.create_table(
        "auth_tokens",
        # The bearer token is the primary key, so a stolen token cannot be used to
        # enumerate accounts and a logout is a delete.
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token"),
    )

    op.create_table(
        "student_profiles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("class_level", sa.String(length=16), nullable=True),
        sa.Column("age_range", sa.String(length=16), nullable=True),
        sa.Column("board", sa.String(length=32), nullable=True),
        sa.Column("share_code", sa.String(length=12), nullable=True),
        sa.Column("interest_areas", JSON, nullable=False),
        sa.Column("education_context", sa.Text(), nullable=True),
        # A rough band, never an income figure — the question the product asks is
        # "does cost need to be part of this plan", not "how much does this family have".
        sa.Column("financial_context", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("share_code"),
    )

    op.create_table(
        "guardianships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("relationship", sa.String(length=32), nullable=True),
        # Explicit and per-family: a parent sees a child's plan because that child's
        # consent says so, and transcripts are a second, separate yes.
        sa.Column("share_conversation_transcripts", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("parent_id", "student_id", name="uq_guard"),
    )

    op.create_table(
        "consent_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("scope", sa.String(length=48), nullable=False),
        sa.Column("granted", sa.Boolean(), nullable=False),
        # The version of the policy text the person agreed to, so a later rewrite of the
        # privacy page does not silently speak for an earlier yes.
        sa.Column("version", sa.String(length=16), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(length=8), nullable=False),
        sa.Column("voice", sa.String(length=48), nullable=True),
        sa.Column("speak_responses", sa.Boolean(), nullable=False),
        sa.Column("continuous_conversation", sa.Boolean(), nullable=False),
        sa.Column("save_history", sa.Boolean(), nullable=False),
        sa.Column("reduced_motion", sa.Boolean(), nullable=False),
        sa.Column("high_contrast", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    # --- conversation -----------------------------------------------------------------
    op.create_table(
        "conversation_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=8), nullable=False),
        sa.Column("language", sa.String(length=8), nullable=False),
        sa.Column("stage", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        # Every reply says whether it came from a model or from the demo script, and it
        # says so in the row, not only on screen.
        sa.Column("demo_generated", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["conversation_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "interest_observations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        # Nullable and SET NULL: a conversation can be deleted without taking the
        # evidence with it, because the observation is what a recommendation cites.
        sa.Column("session_id", sa.Integer(), nullable=True),
        sa.Column("theme", sa.String(length=48), nullable=False),
        sa.Column("evidence", sa.Text(), nullable=False),
        # 16 characters here. `0009_observation_source_width` widens it to 32; do not
        # "correct" this line to match the model, or that revision fails on a fresh
        # database with a column that is already the right width.
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["conversation_sessions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- catalogue --------------------------------------------------------------------
    op.create_table(
        "careers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=96), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("typical_activities", JSON, nullable=False),
        sa.Column("useful_skills", JSON, nullable=False),
        sa.Column("school_subjects", JSON, nullable=False),
        sa.Column("education_pathways", JSON, nullable=False),
        sa.Column("entry_requirements", JSON, nullable=False),
        sa.Column("preparation_stages", JSON, nullable=False),
        sa.Column("typical_day", sa.Text(), nullable=True),
        sa.Column("costs_and_alternatives", sa.Text(), nullable=True),
        sa.Column("benefits", JSON, nullable=False),
        sa.Column("challenges", JSON, nullable=False),
        sa.Column("explore_activities", JSON, nullable=False),
        sa.Column("official_links", JSON, nullable=False),
        sa.Column("related_slugs", JSON, nullable=False),
        sa.Column("interest_themes", JSON, nullable=False),
        sa.Column("min_class", sa.Integer(), nullable=False),
        # The catalogue admits what it has not checked. A career row that has not been
        # verified against a primary source says so, and the page shows that.
        sa.Column("needs_verification", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_careers_slug", "careers", ["slug"], unique=True)
    op.create_index("ix_careers_category", "careers", ["category"])

    op.create_table(
        "saved_careers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("career_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["career_id"], ["careers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "career_id", name="uq_saved_career"),
    )

    op.create_table(
        "recommendations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("career_id", sa.Integer(), nullable=False),
        sa.Column("why", sa.Text(), nullable=False),
        sa.Column("supporting_statements", JSON, nullable=False),
        # What is still unknown is part of the answer, stored beside it.
        sa.Column("open_questions", JSON, nullable=False),
        sa.Column("skills_to_try", JSON, nullable=False),
        sa.Column("qualifications_to_check", JSON, nullable=False),
        sa.Column("alternatives", JSON, nullable=False),
        sa.Column("evidence_level", sa.String(length=16), nullable=False),
        sa.Column("next_activity", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["career_id"], ["careers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "study_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("goal", sa.Text(), nullable=False),
        sa.Column("career_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["career_id"], ["careers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "study_plan_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("estimated_effort", sa.String(length=48), nullable=True),
        sa.Column("resource_url", sa.String(length=400), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        # `order` is a reserved word in both dialects; SQLAlchemy quotes it, and so does
        # every statement the app writes against this column.
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["study_plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "journey_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "career_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("content", JSON, nullable=False),
        # A delete is a flag, not a truncate: the PDF bytes this row summarised live in
        # `report_pdfs`, and the student can still ask for the file back.
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- reference data ----------------------------------------------------------------
    op.create_table(
        "resources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("level", sa.String(length=24), nullable=False),
        sa.Column("language", sa.String(length=8), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resources_category", "resources", ["category"])

    op.create_table(
        "scholarships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("provider", sa.String(length=120), nullable=False),
        sa.Column("scope", sa.String(length=16), nullable=False),
        sa.Column("education_levels", JSON, nullable=False),
        sa.Column("states", JSON, nullable=False),
        sa.Column("categories", JSON, nullable=False),
        sa.Column("benefit_summary", sa.Text(), nullable=False),
        sa.Column("eligibility_summary", sa.Text(), nullable=False),
        sa.Column("application_steps", JSON, nullable=False),
        sa.Column("official_url", sa.String(length=500), nullable=False),
        # `verified` plus `last_verified_at`: a scheme the app has not re-read is shown as
        # unverified rather than presented as live, checked data.
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("last_verified_at", sa.DateTime(), nullable=True),
        sa.Column("disclaimer", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "institutions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("city", sa.String(length=80), nullable=False),
        sa.Column("state", sa.String(length=60), nullable=False),
        sa.Column("institution_type", sa.String(length=24), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("education_level", sa.String(length=32), nullable=False),
        sa.Column("career_areas", JSON, nullable=False),
        sa.Column("courses", JSON, nullable=False),
        # A band, never a claimed fee schedule.
        sa.Column("fee_range", sa.Text(), nullable=True),
        sa.Column("admission_info", sa.Text(), nullable=True),
        sa.Column("scholarships_note", sa.Text(), nullable=True),
        sa.Column("website", sa.String(length=400), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("last_verified_at", sa.DateTime(), nullable=True),
        # A paid listing is a column in the row, and the page labels it. Payment can
        # change where a card sits, never what the recommendation engine concludes.
        sa.Column("sponsored", sa.Boolean(), nullable=False),
        sa.Column("sponsorship_disclosure", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("institutions")
    op.drop_table("scholarships")
    op.drop_index("ix_resources_category", table_name="resources")
    op.drop_table("resources")
    op.drop_table("career_reports")
    op.drop_table("journey_events")
    op.drop_table("study_plan_items")
    op.drop_table("study_plans")
    op.drop_table("recommendations")
    op.drop_table("saved_careers")
    op.drop_index("ix_careers_category", table_name="careers")
    op.drop_index("ix_careers_slug", table_name="careers")
    op.drop_table("careers")
    op.drop_table("interest_observations")
    op.drop_table("messages")
    op.drop_table("conversation_sessions")
    op.drop_table("user_settings")
    op.drop_table("consent_records")
    op.drop_table("guardianships")
    op.drop_table("student_profiles")
    op.drop_table("auth_tokens")
    op.drop_index("ix_users_comeback_index", table_name="users")
    op.drop_index("ix_users_device_id", table_name="users")
    op.drop_table("users")
