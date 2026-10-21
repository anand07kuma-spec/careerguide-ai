"""Widen `interest_observations.source` from 16 characters to 32.

Revision ID: 0009_observation_source_width
Revises: 0008_admin_audit
Create Date: 2026-10-19

Found by moving a laptop's SQLite database onto PostgreSQL — which is the one thing
that finds this class of bug. SQLite ignores `varchar(n)`: it stores whatever it is
given and never says so. PostgreSQL refuses the row. So `interests.py` has been writing
the literal `"interest_activity"` — 17 characters — into a 16-character column since the
day that screen existed, every local database holding it happily, and the value would
have been rejected on the first Postgres boot: not as a schema error at migration time,
but as a failed insert behind a student's interests screen.

One row in the development database already holds it, so this is a widening, not a
cleanup: no value is shortened, no row is rewritten, nothing a child said is edited to
make a column fit. The models carry the same 32, so a database built from scratch by
`Base.metadata.create_all` arrives here directly.

The guard is what makes those two build paths compatible. A database created from the
models is already 32 characters wide, and re-running the ALTER there would be a no-op
Postgres still has to take a lock for; a database created by 0001–0008 genuinely needs
it. Offline mode (`alembic upgrade head --sql`) cannot ask the database anything, so
there the statement prints unconditionally — which is the right answer for the only kind
of database a hand-run SQL script is pointed at.

Downgrade narrows the column back to 16. It is written, but it is not safe on a database
that has kept an interest activity: `"interest_activity"` does not fit, and PostgreSQL
fails the whole statement rather than truncating a value into silence. That is the
correct outcome for a downgrade and the reason no screen offers one.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0009_observation_source_width"
down_revision: str | None = "0008_admin_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD = sa.String(length=16)
NEW = sa.String(length=32)


def _width() -> int | None:
    """The column's current limit, or None if the table is not in this database."""
    if context.is_offline_mode():
        return None
    insp = sa.inspect(op.get_bind())
    if not insp.has_table("interest_observations"):
        return 0
    for column in insp.get_columns("interest_observations"):
        if column["name"] == "source":
            return int(getattr(column["type"], "length", 0) or 0)
    return 0


def upgrade() -> None:
    width = _width()
    if width is not None and (width == 0 or width >= 32):
        return
    if op.get_context().dialect.name == "sqlite":
        # A laptop database keeps working either way — SQLite stores what it is given and
        # never measures it — but it is rebuilt here anyway, so that the database an
        # inspection reports for a laptop is the database the models describe. Batch mode
        # is the only way to change a column's type on SQLite, and it is refused in
        # offline mode, where there is no table to reflect. `--sql` against a SQLite file
        # therefore prints nothing about this revision, which is the right answer: there
        # is nothing for a SQLite script to do.
        if context.is_offline_mode():
            return
        with op.batch_alter_table("interest_observations") as batch:
            batch.alter_column(
                "source", existing_type=OLD, type_=NEW, existing_nullable=False
            )
        return
    op.alter_column("interest_observations", "source", existing_type=OLD, type_=NEW,
                    existing_nullable=False)


def downgrade() -> None:
    width = _width()
    if width is not None and width == 0:
        return
    if op.get_context().dialect.name == "sqlite":
        if context.is_offline_mode():
            return
        with op.batch_alter_table("interest_observations") as batch:
            batch.alter_column(
                "source", existing_type=NEW, type_=OLD, existing_nullable=False
            )
        return
    op.alter_column("interest_observations", "source", existing_type=NEW, type_=OLD,
                    existing_nullable=False)
