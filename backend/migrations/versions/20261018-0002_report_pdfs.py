"""The stored PDF report: one row per student, anchor sitting and print language.

Revision ID: 0002_report_pdfs
Revises: 0001_assessment_tables
Create Date: 2026-10-18

`pdf_bytes` holds the document itself. That is a deliberate choice over a file path
or a storage bucket: the deployed backend has no disk that outlives a request, and
a path would put a second copy of a child's answers somewhere the delete paths in
`app/routers` do not walk. With the bytes in this table, removing the student, the
sitting or the report removes the file with it, by the same cascade every other
table here already relies on.

`result_ids` is what makes the cache honest. A stored report is reused only while
the ids it lists are still exactly the results this student has, so finishing a
second questionnaire invalidates the document instead of quietly serving a stale one.

Written to match `app/models.py` column for column, as the first revision was; the
`UTCDateTime` type renders as plain `DATETIME`, because it stores naive UTC and adds
the offset back on read.

Apply with `alembic upgrade head`, or `alembic stamp` the previous revision first on
a database the app already prepared — see the note at the top of 0001.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_report_pdfs"
down_revision: str | None = "0001_assessment_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Generic JSON on SQLite (stored as TEXT), JSONB on PostgreSQL so the columns stay
# indexable there — the same object the models build.
JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "report_pdfs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("anchor_result_id", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(length=8), nullable=False),
        sa.Column("filename", sa.String(length=96), nullable=False),
        sa.Column("result_ids", JSON, nullable=False),
        sa.Column("pdf_bytes", sa.LargeBinary(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["anchor_result_id"], ["assessment_results.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        # One document per student per language, whatever questionnaire the download
        # was asked for: the file always holds every finished questionnaire, so a key
        # that included the anchor would store a separate copy of a child's answers
        # for each result page they happened to open.
        sa.UniqueConstraint("student_id", "language", name="uq_report_pdf"),
    )
    op.create_index(op.f("ix_report_pdfs_student_id"), "report_pdfs", ["student_id"])
    op.create_index(
        op.f("ix_report_pdfs_anchor_result_id"), "report_pdfs", ["anchor_result_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_report_pdfs_anchor_result_id"), table_name="report_pdfs")
    op.drop_index(op.f("ix_report_pdfs_student_id"), table_name="report_pdfs")
    op.drop_table("report_pdfs")
