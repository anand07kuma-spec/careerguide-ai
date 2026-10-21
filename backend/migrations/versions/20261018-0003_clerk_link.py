"""An optional email sign-in, stored as a pointer and nothing else.

Revision ID: 0003_clerk_link
Revises: 0002_report_pdfs
Create Date: 2026-10-18

Two nullable columns on `users`, both NULL for every account that exists today and
for every account that never chooses an email sign-in. No email address, no name, no
picture: Clerk holds those, and this app has no business keeping a second copy of a
child's contact details. `clerk_user_id` is the only thing that makes "open my work
on a new phone" possible, and `clerk_linked_at` exists so the account screen can
say when the choice was made.

The uniqueness lives in a unique index rather than a named constraint, matching
`models.py` exactly — SQLite cannot add a constraint to a table that already has
rows, and an index can be created and dropped on both engines.

Apply with `alembic upgrade head`. On a database the app already prepared, stamp the
previous revision first — see the note at the top of 0001.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0003_clerk_link"
down_revision: str | None = "0002_report_pdfs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _users_is_there() -> bool:
    """Whether this database has a `users` table to widen.

    `users` predates the revision chain — the app's own `create_all` made it before
    Alembic was introduced, which is why 0001 starts at the questionnaire tables. So
    a database built purely from these revisions has no `users` at all, and an ALTER
    against it would fail for a reason that has nothing to do with this revision. On
    that path the columns arrive from the models instead, which describe them.

    Offline mode (`alembic upgrade --sql`) cannot ask the database anything, so there
    the ALTER is printed unconditionally — which is the right answer for the only
    databases a hand-run SQL script is ever pointed at.
    """
    if context.is_offline_mode():
        return True
    return sa.inspect(op.get_bind()).has_table("users")


def upgrade() -> None:
    if not _users_is_there():
        return
    op.add_column("users", sa.Column("clerk_user_id", sa.String(length=40), nullable=True))
    op.add_column("users", sa.Column("clerk_linked_at", sa.DateTime(), nullable=True))
    op.create_index(
        "ix_users_clerk_user_id", "users", ["clerk_user_id"], unique=True
    )


def downgrade() -> None:
    if not _users_is_there():
        return
    op.drop_index("ix_users_clerk_user_id", table_name="users")
    op.drop_column("users", "clerk_linked_at")
    op.drop_column("users", "clerk_user_id")
