"""An address and a password an account can be opened with.

Revision ID: 0018_email_password_auth
Revises: 0017_google_sign_in
Create Date: 2026-11-11

Eight nullable columns and two indexes on `users`. Nothing here is NOT NULL, no
existing column changes, and no row is rewritten, so every account that signs in
by device, come-back code, Clerk or Google keeps working exactly as it did — it
simply carries NULL in all of these and the email sign-in routes never find it.

* `login_email` — the address that names a password account. Unique: one address,
  one account. A separate unique index rather than a constraint for the same
  SQLite reason as `clerk_user_id` and `google_sub`; many NULLs are allowed.
* `password_hash` — Argon2id digest. The password is never stored.
* `password_updated_at` — when the digest last changed.
* `password_reset_hash`, `password_reset_expires_at`, `password_reset_used_at` —
  a single-use reset token, its deadline and its redemption. Only the SHA-256
  digest of the mailed string is stored; redeeming clears it.
* `failed_login_count`, `locked_until` — the per-account brute-force guard. NULL
  reads as "no failures, not locked", which is every existing row.

Guarded like 0013, 0015, 0016 and 0017: `schema_sync.add_missing_columns` can add
the columns and indexes on a laptop where the new code booted before Alembic was
pointed at the database, and offline mode (`alembic upgrade head --sql`) has no
database to inspect, so each ALTER/CREATE is emitted there rather than skipped.

Downgrade drops both indexes and all eight columns. Accounts keep every other way
in they had; only the password door — and the address that names it — goes.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0018_email_password_auth"
down_revision: str | None = "0017_google_sign_in"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNS: list[tuple[str, sa.types.TypeEngine]] = [
    ("login_email", sa.String(length=254)),
    ("password_hash", sa.String(length=255)),
    ("password_updated_at", sa.DateTime()),
    ("password_reset_hash", sa.String(length=64)),
    ("password_reset_expires_at", sa.DateTime()),
    ("password_reset_used_at", sa.DateTime()),
    ("failed_login_count", sa.Integer()),
    ("locked_until", sa.DateTime()),
]

INDEXES: list[tuple[str, str, bool]] = [
    ("ix_users_login_email", "login_email", True),
    ("ix_users_password_reset_hash", "password_reset_hash", False),
]


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


def _has_index(name: str) -> bool:
    if context.is_offline_mode():
        return False
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("users"):
        return False
    return any(item["name"] == name for item in inspector.get_indexes("users"))


def upgrade() -> None:
    if not _users_table():
        return
    for column, column_type in COLUMNS:
        if not _skip_add(column):
            op.add_column("users", sa.Column(column, column_type, nullable=True))
    for name, column, unique in INDEXES:
        if not _has_index(name):
            op.create_index(name, "users", [column], unique=unique)


def downgrade() -> None:
    if not _users_table():
        return
    for name, _, _ in INDEXES:
        if context.is_offline_mode() or _has_index(name):
            op.drop_index(name, table_name="users")
    for column, _ in reversed(COLUMNS):
        if not _skip_drop(column):
            op.drop_column("users", column)
