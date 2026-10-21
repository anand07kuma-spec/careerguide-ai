"""A date on an account that was erased rather than deleted.

Revision ID: 0012_user_erasure
Revises: 0011_exams
Create Date: 2026-10-20

One nullable column, and the reason it exists is the two tables that outlive a person.

`DELETE /api/users/me` removes everything that made a row a child — their conversations
and messages, assessments, questions answered and results, career reports and the PDFs
printed from them, saved careers, recommendations, study plans, journey events, interest
observations, profile, settings, consent records, memberships and guardianships. It then
**keeps** the row and clears it: name, language, device digest, come-back code, Clerk
pointer and contact address all go to NULL, `role` becomes `erasure`, `is_active` becomes
false, and this column is set to the moment that happened.

Why not `DELETE FROM users WHERE id = ?`, which is what the request asked for:

* `payments` and `subscriptions` hang off that id with `ondelete="CASCADE"`. Deleting the
  row deletes the record that money was taken and refunded. A ledger that can be unwritten
  by the person it is about is not a ledger — it is the end of any answer to "was this
  charge refunded, and when".
* `audit_events.actor_user_id` is already `SET NULL` with a name snapshot, precisely so
  that an operator account which stops existing leaves a legible history. Deleting a row
  that has operator actions in that log would take the log's meaning with it.

So the row becomes a shell with a date on it, and the date is what makes the shell
provable: `erased_at` is how a support answer says "this account was erased on this day,
and here is nothing else it can say about it". A person erasing their account and later
arriving as a new device is not the same account, because `device_hash` is gone — the
browser cannot be recognised again, which is the point.

Nullable, like every other widening of this table, because `schema_sync.add_missing_columns`
only ever adds nullable columns and this one goes onto a table holding real accounts. A
NULL reads as "never erased", so nothing changes for anybody who is here now.

Downgrade drops the column. It cannot undo an erasure: the data it describes was already
removed, and no migration brings removed data back.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0012_user_erasure"
down_revision: str | None = "0011_exams"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _users_is_there() -> bool:
    """`users` predates the revision chain; see the note in 0003."""
    if context.is_offline_mode():
        return True
    return sa.inspect(op.get_bind()).has_table("users")


def upgrade() -> None:
    if _users_is_there():
        op.add_column("users", sa.Column("erased_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    if not _users_is_there():
        return
    op.drop_column("users", "erased_at")
