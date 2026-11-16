"""Remove the come-back code: the columns and the lookup index behind it.

Revision ID: 0020_drop_comeback_code
Revises: 0019_profile_photos
Create Date: 2026-11-13

Sign-in is by device, email and password, Google or Clerk. The come-back code was a
fifth door, and this revision removes its storage rather than leaving two unread
columns on `users` that a future reader would have to reason about.

Dropping the columns drops the codes with them; there is nothing else to migrate.
Downgrade restores the columns as nullable, which is exactly how they arrived, so an
account that never had a code stays valid.

Guarded like 0013–0019: a database built with `Base.metadata.create_all` before this
chain ran never had these columns at all, and offline mode has no database to inspect,
so the DROP is emitted there rather than skipped.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0020_drop_comeback_code"
down_revision: str | None = "0019_profile_photos"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INDEX = "ix_users_comeback_index"
COLUMNS: list[tuple[str, sa.types.TypeEngine]] = [
    ("comeback_index", sa.String(length=64)),
    ("comeback_hash", sa.String(length=128)),
]


def _has_users() -> bool:
    if context.is_offline_mode():
        return True
    return sa.inspect(op.get_bind()).has_table("users")


def _present(column: str) -> bool:
    if context.is_offline_mode():
        return True
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("users"):
        return False
    return any(item["name"] == column for item in inspector.get_columns("users"))


def _has_index() -> bool:
    if context.is_offline_mode():
        return True
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("users"):
        return False
    return any(item["name"] == INDEX for item in inspector.get_indexes("users"))


def upgrade() -> None:
    if not _has_users():
        return
    if _has_index():
        op.drop_index(INDEX, table_name="users")
    for column, _ in COLUMNS:
        if _present(column):
            op.drop_column("users", column)


def downgrade() -> None:
    if not _has_users():
        return
    # Downgrading restores 0019's schema, where these columns existed whether or not
    # this particular database ever had them before the upgrade.
    for column, column_type in COLUMNS:
        if not _present(column):
            op.add_column("users", sa.Column(column, column_type, nullable=True))
    if not _has_index():
        op.create_index(INDEX, "users", ["comeback_index"])
