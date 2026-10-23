"""Where each catalogue row came from, and the day somebody read it.

Revision ID: 0016_career_source
Revises: 0015_result_roadmap
Create Date: 2026-10-23

Three nullable columns on two tables that already carry a verification flag but no
evidence:

* `careers.source_url`, `careers.verified_at` — the `careers` row has `official_links`,
  which is a *signpost* ("go and check here"), and `needs_verification`, which says
  nobody has. Neither answers the question a parent asks, which is whether anybody did.
  These two do, and only they can light the green badge.
* `scholarships.source_url` — `scholarships.official_url` is where you apply, which for
  a central scheme is a portal, not the notification that states the amount. The row
  needs both: the door, and the page the numbers were read out of.

`universities` already has all three (`source_url`, `verified`, `verified_at`), which is
why this revision adds columns rather than a scheme: the vocabulary existed, two tables
had not caught up with it.

Nullable with no default is the whole design. A row cannot be given a date it did not
earn, so every existing row arrives as NULL and the screens say "not checked against a
source yet" until a person opens one and the code stamps the day. Anything else — a
migration that back-filled yesterday's date, a seed that copied a home page into
`source_url` — would print a confidence the database has no record of, on pages a
fifteen-year-old chooses a career from.

Guarded like 0013 and 0015, because `schema_sync.add_missing_columns` may have added
these already on a laptop where the new code booted first; and in offline mode
(`alembic upgrade head --sql`) nothing can be inspected, so the statements print
unchanged for PostgreSQL.

Downgrade drops the three columns. The flags they qualify stay, so no row loses the
warning it already carried.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0016_career_source"
down_revision: str | None = "0015_result_roadmap"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, column, type). The timestamp is a plain DATETIME, as every other timestamp in
# this schema is: `app/models.py`'s UTCDateTime stores naive UTC on both engines, so a
# tz-aware column here would be a second, disagreeing answer to the same question.
COLUMNS: list[tuple[str, str, sa.types.TypeEngine]] = [
    ("careers", "source_url", sa.String(length=500)),
    ("careers", "verified_at", sa.DateTime()),
    ("scholarships", "source_url", sa.String(length=500)),
]


def _skip_add(table: str, column: str) -> bool:
    """True when this database needs no ALTER for this column.

    Either the column is already there — which `schema_sync.add_missing_columns` can do to a
    laptop database before Alembic is pointed at it — or there is no table here to widen, which
    is a database built from the models rather than from this chain. An unguarded ALTER against
    either one fails the whole upgrade for a reason that is only ever that newer code ran first.

    Offline mode has no database to ask, so it says no and the statement prints unchanged for
    the engine that will run it.
    """
    if context.is_offline_mode():
        return False
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table):
        return True
    return any(item["name"] == column for item in inspector.get_columns(table))


def _skip_drop(table: str, column: str) -> bool:
    """True when this database has no such column to drop, for the same two reasons."""
    if context.is_offline_mode():
        return False
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table):
        return True
    return not any(item["name"] == column for item in inspector.get_columns(table))


def upgrade() -> None:
    for table, column, column_type in COLUMNS:
        if not _skip_add(table, column):
            op.add_column(table, sa.Column(column, column_type, nullable=True))


def downgrade() -> None:
    for table, column, _ in reversed(COLUMNS):
        if not _skip_drop(table, column):
            op.drop_column(table, column)
