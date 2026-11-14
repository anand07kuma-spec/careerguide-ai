"""A Google identity an account can be opened with.

Revision ID: 0017_google_sign_in
Revises: 0016_career_source
Create Date: 2026-11-11

Two nullable columns and one unique index on `users`:

* `google_sub` — Google's stable subject id for the person. It is the only value
  stored from the sign-in; no email address, name or picture is copied into this
  database. The column is set only after the identity token's signature, issuer,
  audience, expiry and nonce have been checked.
* `google_linked_at` — when that happened, so Settings can say how long the account
  has been openable from another device.

The unique index is what makes "one Google identity, one account" a rule the
database enforces rather than a rule one router remembers. Both SQLite and
Postgres allow any number of NULLs in a unique index, so existing rows — which all
arrive NULL — are unaffected.

Guarded like 0013, 0015 and 0016, because `schema_sync.add_missing_columns` may have
added the columns already on a laptop where the new code booted first, and offline
mode (`alembic upgrade head --sql`) has no database to inspect.

Downgrade drops the index and both columns. Accounts keep every other way in they
had; only the Google pointer goes.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0017_google_sign_in"
down_revision: str | None = "0016_career_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNS: list[tuple[str, sa.types.TypeEngine]] = [
    ("google_sub", sa.String(length=255)),
    ("google_linked_at", sa.DateTime()),
]

INDEX_NAME = "ix_users_google_sub"


def _users_table() -> bool:
    """Whether this database has the table this revision changes.

    A database can reach this revision without `users` at all — `migration_test.py` §8
    builds one by hand, the way an app boot once did, and revision 0010 already tolerates
    it. There is nothing to widen and nothing to index there, so this revision does
    nothing rather than failing on a table it was never given.
    """
    if context.is_offline_mode():
        return True
    return sa.inspect(op.get_bind()).has_table("users")


def _skip_add(column: str) -> bool:
    """True when this database needs no ALTER for this column.

    Either the column is already there — which `schema_sync.add_missing_columns` can
    do before Alembic is pointed at the database — or there is no `users` table here,
    which is a database built from the models rather than from this chain.
    """
    if context.is_offline_mode():
        return False
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("users"):
        return True
    return any(item["name"] == column for item in inspector.get_columns("users"))


def _skip_drop(column: str) -> bool:
    if context.is_offline_mode():
        return False
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("users"):
        return True
    return not any(item["name"] == column for item in inspector.get_columns("users"))


def _has_index() -> bool:
    if context.is_offline_mode():
        return False
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("users"):
        return False
    return any(item["name"] == INDEX_NAME for item in inspector.get_indexes("users"))


def upgrade() -> None:
    if not _users_table():
        return
    for column, column_type in COLUMNS:
        if not _skip_add(column):
            op.add_column("users", sa.Column(column, column_type, nullable=True))
    if not _has_index():
        op.create_index(INDEX_NAME, "users", ["google_sub"], unique=True)


def downgrade() -> None:
    if not _users_table():
        return
    if _has_index():
        op.drop_index(INDEX_NAME, table_name="users")
    for column, _ in reversed(COLUMNS):
        if not _skip_drop(column):
            op.drop_column("users", column)
