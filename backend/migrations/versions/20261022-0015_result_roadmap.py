"""A skill gap and a 30-day plan, kept beside the result they were read out of.

Revision ID: 0015_result_roadmap
Revises: 0014_resume
Create Date: 2026-10-22

One nullable JSON column on `assessment_results`, and the shape is the point: the plan
is a property of one sitting, the same as the scores it is written from. It is not a
row of its own, because nothing ever lists plans, counts plans, or opens a plan
without opening the result first — and because the erasure route already deletes
results by `user_id`, so a plan cannot survive the answers it was derived from. A
separate table would have needed its own delete path, which is exactly how a copy of a
child's data gets left behind.

Nullable rather than NOT NULL with a default, for two reasons that are the same reason.
Rows written before this feature exist and cannot be given a plan honestly: the plan
reads the career catalogue as it is today, so back-filling one would date a document the
student reads as "what your guide wrote for you" from data that arrived after their
result. So an old row keeps NULL, the screen says no plan was written for this sitting,
and one button offers to write it now. And `schema_sync.add_missing_columns` only adds
nullable columns, which is what lets a laptop database and a hosted one grow this field
before Alembic is pointed at either.

The guard matters for the same reason it does in 0013: that auto-sync may have added the
column already, and an unguarded `add_column` reaching a database that has it fails the
whole upgrade for a reason that is only ever that the new code has been running.

Offline mode (`alembic upgrade head --sql`) cannot ask anything, so there the statement
prints unchanged — correct DDL for PostgreSQL, which is what a hand-run script gets
pointed at.

Downgrade drops the column. It cannot un-show a student a plan they have read, but the
scores it was built from stay, so nothing unrecoverable goes with it.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op
from sqlalchemy.dialects import postgresql

revision: str = "0015_result_roadmap"
down_revision: str | None = "0014_resume"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "assessment_results"
COLUMN = "roadmap_json"

# Generic JSON on SQLite (stored as TEXT), JSONB on PostgreSQL — the same object
# `app/models.py` declares, so the column built here is the column the app reads.
JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _skip() -> bool:
    """True when there is nothing for this revision to do to this database."""
    if context.is_offline_mode():
        return False
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        # Built by `create_all` from the models, which already declare the column,
        # or not built at all. Either way there is no ALTER to run here.
        return True
    return any(column["name"] == COLUMN for column in inspector.get_columns(TABLE))


def upgrade() -> None:
    if _skip():
        return
    op.add_column(TABLE, sa.Column(COLUMN, JSON, nullable=True))


def downgrade() -> None:
    if context.is_offline_mode():
        op.drop_column(TABLE, COLUMN)
        return
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        return
    if not any(column["name"] == COLUMN for column in inspector.get_columns(TABLE)):
        return
    op.drop_column(TABLE, COLUMN)
