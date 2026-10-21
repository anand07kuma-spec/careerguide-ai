"""A student's age, kept as the number they typed instead of a band they picked.

Revision ID: 0013_student_age
Revises: 0012_user_erasure
Create Date: 2026-10-21

One nullable integer, and the reason it exists is that the alternative was a guess.

The profile screen used to offer five labelled bands — "Age 3 to 5", "Age 6 to 8" and
so on — and a child had to find themselves inside one of them. A thirteen-year-old in
class 8 is a real fact about that child; "11 to 12" was somebody else's rounding. The
number now goes in as a number, and `age_range` beside it becomes *derived*: the route
computes the band from the age wherever one is stated, so the two can never disagree
about the same child, and every consumer that works in bands — the guide's exploration
framework in `services/prompts.py`, a portal's age summary, the consent vocabulary —
keeps working without being rewritten around a new field.

Nullable like every other addition to a table holding real accounts. A row that has
never been shown this screen keeps a NULL age and whatever band it already had, and
reads exactly as it did before; nothing is back-filled from `class_level`, because a
class is not a birthday.

The guard is the part that matters for a deployment. `schema_sync.add_missing_columns`
adds any nullable column the models declare, the next time the app boots — so a laptop
database and a hosted one both grow `age` before Alembic is ever pointed at them. An
unguarded `add_column` reaching that database afterwards fails the whole upgrade on a
duplicate column, and the only reason the column would already exist is that the new
code has been running. So this revision asks the database first.

Offline mode (`alembic upgrade head --sql`) cannot ask anything, so there the statement
prints: that is the right answer for PostgreSQL, which is the only thing a hand-run SQL
script gets pointed at, and a SQLite file has no use for the script either way.

Downgrade drops the column. It cannot return to five bands what a person typed as a
number; the derived `age_range` stays, because it was written alongside.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0013_student_age"
down_revision: str | None = "0012_user_erasure"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "student_profiles"
COLUMN = "age"


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
    op.add_column(TABLE, sa.Column(COLUMN, sa.SmallInteger(), nullable=True))


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
