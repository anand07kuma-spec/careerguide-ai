"""Assessment tables: sittings, bank items, answers, results.

Revision ID: 0001_assessment_tables
Revises: 0000_baseline_schema
Create Date: 2026-10-17

Three instruments (interest, personality, aptitude) share these four tables, which
is why `assessment_type` appears on each row rather than three parallel sets of
tables. Answers are stored by item `code`, not only by `question_id`, so a finished
result stays readable even after the question bank is edited.

Written to match `app/models.py` exactly, including the JSONB variant that hosted
PostgreSQL gets and the plain `DATETIME` columns the app's `UTCDateTime` type
renders (it stores naive UTC and adds the offset back on read). Read it before
applying it: `alembic upgrade head --sql` prints the same statements without
connecting.

Two ways to arrive at this revision, depending on how the database was made:

* Fresh database → `alembic upgrade head`, which runs `0000_baseline_schema` first and
  then this one. Nothing outside the chain has to happen before it.
* Database already prepared by the app's first boot, which has these tables →
  `alembic stamp head` first. Stamping records the revision without running it;
  without that step `upgrade` would try to create tables that exist and fail.

`users` is created by `0000_baseline_schema`, not here — these rows belong to a person.
Before that revision existed this one genuinely did require an empty `users` table from
`create_all`, which is exactly the ordering PostgreSQL refuses: SQLite lets a
`CREATE TABLE` point at a table that is not there yet, Postgres rejects the DDL.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_assessment_tables"
down_revision: str | None = "0000_baseline_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Generic JSON on SQLite (stored as TEXT), JSONB on PostgreSQL so the columns stay
# indexable there — the same object the models build.
JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "assessments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("assessment_type", sa.String(length=16), nullable=False),
        sa.Column("language", sa.String(length=8), nullable=False),
        sa.Column("bank_version", sa.String(length=8), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_assessments_user_id"), "assessments", ["user_id"])

    op.create_table(
        "assessment_questions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_type", sa.String(length=16), nullable=False),
        sa.Column("code", sa.String(length=12), nullable=False),
        sa.Column("dimension", sa.String(length=24), nullable=False),
        # `order` is a reserved word in both dialects; SQLAlchemy quotes it, and so
        # does every statement the app writes against this column.
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("response_type", sa.String(length=8), nullable=False),
        sa.Column("keyed", sa.String(length=2), nullable=False),
        sa.Column("text_en", sa.Text(), nullable=False),
        sa.Column("text_hi", sa.Text(), nullable=False),
        sa.Column("options_json", JSON, nullable=False),
        sa.Column("correct_value", sa.String(length=8), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assessment_type", "code", name="uq_assessment_code"),
    )
    op.create_index(
        op.f("ix_assessment_questions_assessment_type"),
        "assessment_questions",
        ["assessment_type"],
    )

    op.create_table(
        "assessment_responses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=12), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=True),
        sa.Column("value", sa.String(length=8), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["question_id"], ["assessment_questions.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assessment_id", "code", name="uq_assessment_answer"),
    )
    op.create_index(
        op.f("ix_assessment_responses_assessment_id"),
        "assessment_responses",
        ["assessment_id"],
    )

    op.create_table(
        "assessment_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("assessment_type", sa.String(length=16), nullable=False),
        sa.Column("score_json", JSON, nullable=False),
        sa.Column("traits_json", JSON, nullable=False),
        sa.Column("detail_json", JSON, nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        # One result per sitting: a second submit returns the first instead of
        # writing a second opinion about the same answers.
        sa.UniqueConstraint("assessment_id"),
    )
    op.create_index(op.f("ix_assessment_results_user_id"), "assessment_results", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_assessment_results_user_id"), table_name="assessment_results")
    op.drop_table("assessment_results")
    op.drop_index(op.f("ix_assessment_responses_assessment_id"), table_name="assessment_responses")
    op.drop_table("assessment_responses")
    op.drop_index(op.f("ix_assessment_questions_assessment_type"), table_name="assessment_questions")
    op.drop_table("assessment_questions")
    op.drop_index(op.f("ix_assessments_user_id"), table_name="assessments")
    op.drop_table("assessments")
