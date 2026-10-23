"""The resume table: one document per student account.

Revision ID: 0014_resume
Revises: 0013_student_age
Create Date: 2026-10-22

`user_id` is the primary key rather than a surrogate id with a unique constraint
beside it — the same shape `user_settings` uses. One resume per account then stops
being a rule every route has to remember and becomes something the database refuses
to store twice, and the save route looks its row up by the id the session proved
rather than by anything a request body claims.

The three lists are JSON columns, not child tables, because the document is read and
written whole by one person and never queried row by row: no report counts skills
across students, and the erasure route deletes by `user_id` either way. Splitting them
out would add a join to every page load and buy nothing.

There is no name, phone, address, email or photo column here on purpose. The name at
the top of the printed page is the one already on the account, which the erasure route
already clears; a second copy in this table would be a copy that gets left behind.

The `_skip()` guard matters for a running deployment: the app's own startup runs
`Base.metadata.create_all` (then `schema_sync.add_missing_columns`) when `DB_AUTO_SETUP`
is on, and a brand-new table the models declare is created by that first step — so a
laptop database and a hosted one can both have `resumes` before Alembic is pointed at
them. An unguarded `create_table` reaching such a database fails the whole upgrade on an
existing table, and the only reason the table would exist is that the new code has
already been running.

Offline mode (`alembic upgrade head --sql`) cannot ask anything, so there the statements
print unchanged: that is the correct DDL for PostgreSQL, which is what a hand-run script
gets pointed at.

Downgrade drops the table. It cannot un-write a student's CV, so it is destructive in a
way the other revisions in this chain are not — run it only on a database where the
screen was never used, or after taking a backup.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op
from sqlalchemy.dialects import postgresql

revision: str = "0014_resume"
down_revision: str | None = "0013_student_age"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "resumes"

# Generic JSON on SQLite (stored as TEXT), JSONB on PostgreSQL — the same object
# `app/models.py` builds, so the column this creates is the column the app reads.
JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _exists() -> bool:
    if context.is_offline_mode():
        return False
    return sa.inspect(op.get_bind()).has_table(TABLE)


def upgrade() -> None:
    if _exists():
        return
    op.create_table(
        TABLE,
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("target_role", sa.String(length=120), nullable=True),
        sa.Column("education", JSON, nullable=False),
        sa.Column("skills", JSON, nullable=False),
        sa.Column("projects", JSON, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    if context.is_offline_mode():
        op.drop_table(TABLE)
        return
    if not sa.inspect(op.get_bind()).has_table(TABLE):
        return
    op.drop_table(TABLE)
