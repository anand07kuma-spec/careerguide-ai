"""The Indian entrance exams a student meets, moved out of the frontend bundle.

Revision ID: 0011_exams
Revises: 0010_hashed_device_and_token
Create Date: 2026-10-20

One table for an exam, one for the door it belongs to. The `/exams` screen was written
with its eleven exams typed into the page, which meant that correcting a sentence about
NEET needed a code change and a redeploy. Two tables rather than one because the page
groups by "what you become through it", and a flat list would push that grouping back
into the frontend, which is the thing this revision is removing.

**The `exam_date` and `fee_note` columns are the reason this migration has a docstring
worth reading.** A request for an exam table asks for a date and a fee. Both are stored
as nullable free text, and both start empty, because:

* Every one of these exams has more than one session a year, a fee that depends on the
  category and the country, and a notification that rewrites both. There is no single
  date or amount to put in a column, and a `Date` column would present a value no
  notification ever stated as a fact.
* The screen has always refused to print them for exactly that reason, and it names the
  official notification as the only authority instead. Moving the content behind an API
  must not be the thing that changes that.

So the write route refuses to store a value in either column unless the row also carries
`source_url` — the page it was read off — and the public route only passes a value on
once the row is marked `verified`, with `verified_at` stamped server-side. A row that
somebody typed a fee into without a source gets an error, not a stored guess. That is the
same rule `0006_study_abroad` sets for a tuition figure, and it is the reason this seed
ships eleven exams with both columns NULL.

The two composite-free indexes follow the two reads that actually happen: the whole
catalogue in display order, and one group's live exams.

Downgrade drops both tables. The content is not lost — it still sits in
`app/seed/exam_data.py`, which is where the rows came from — and dropping a table never
deletes a Python file.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_exams"
down_revision: str | None = "0010_hashed_device_and_token"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "exam_groups",
        sa.Column("id", sa.Integer(), nullable=False),
        # "Become an engineer" — the question the page is organised around.
        sa.Column("title", sa.String(length=120), nullable=False),
        # One or two sentences on how admission through this door works, printed above
        # the cards rather than inside one.
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "exams",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        # Whose exam it is, in the words the card prints ("Conducted by NTA"). Naming
        # the conducting body is how a student checks a viral "exam alert" against
        # somebody real, so this column is required even though it is not a fact that
        # changes every year.
        sa.Column("authority", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("careers", sa.Text(), nullable=False),
        sa.Column("timeline", sa.Text(), nullable=False),
        sa.Column("preparation", sa.Text(), nullable=False),
        # --- Nothing below is filled in from memory. -------------------------------
        # Free text rather than a `Date`: the honest record of what a notification says
        # is the sentence the notification uses.
        sa.Column("exam_date", sa.String(length=120), nullable=True),
        sa.Column("fee_note", sa.Text(), nullable=True),
        # The page the two values above were read off. Required before either can be
        # stored, and printed beside them, so the reader knows whose number this is.
        sa.Column("source_url", sa.String(length=500), nullable=True),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        # CASCADE: an exam with no door cannot be rendered by the page, and a group is
        # only deleted when an operator means to remove everything under it.
        sa.ForeignKeyConstraint(["group_id"], ["exam_groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exams_group_id"), "exams", ["group_id"])
    # What the public page asks for: the live exams, grouped, in the set order.
    op.create_index("ix_exams_group_active", "exams", ["group_id", "is_active"])


def downgrade() -> None:
    op.drop_index("ix_exams_group_active", table_name="exams")
    op.drop_index(op.f("ix_exams_group_id"), table_name="exams")
    op.drop_table("exams")
    op.drop_table("exam_groups")
