"""An address a person offered, and the queue that waits for a process to send it.

Revision ID: 0005_email_outbox
Revises: 0004_payments_tables
Create Date: 2026-10-18

Four nullable columns on `users`, every one of them NULL for every account that
exists today: this does not turn a mail-happy app out of a silent one. Nothing here
switches itself on. An account gets messages only after a person types an address,
opens the link that comes back to it, and then agrees to each kind of message
separately — and only on a deployment where `RESEND_API_KEY` and `FROM_EMAIL` are
both set.

The address is stored, and its confirmation token is not: `email_confirm_hash` holds
SHA-256 of a single-use random string, so a dump of this table cannot switch an
address on with an UPDATE that skips every check in
`app/services/email_consent.py`. `email_confirmed_at` is the only fact any send
reads, and the unique index on `contact_email` is what stops two accounts pointing at
one mailbox — the tradeoff being that a household sharing one Gmail gets one account
that holds it, which the settings screen now has to say out loud.

`email_jobs` holds no address and no body. `user_id` is the recipient and the drain
reads the confirmed address at the moment of sending, which is what makes "remove my
address" work for a message that is already queued; `ref_id` and `ref_key` name the
thing the message is about, so the numbers inside it are read again at send time
rather than kept as a second copy of a child's questionnaire that no delete path knows
about.

Downgrade drops both indexes, the four columns and the queue. No message that has
already been delivered can be un-sent, and nothing here pretends otherwise — the
mailbox keeps whatever went into it, which is precisely why nothing goes in until a
person opens a link proving it is theirs.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0005_email_outbox"
down_revision: str | None = "0004_payments_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _users_is_there() -> bool:
    """`users` predates the revision chain; see the note in 0003."""
    if context.is_offline_mode():
        return True
    return sa.inspect(op.get_bind()).has_table("users")


def upgrade() -> None:
    if _users_is_there():
        op.add_column("users", sa.Column("contact_email", sa.String(length=254), nullable=True))
        op.add_column("users", sa.Column("email_confirm_hash", sa.String(length=64), nullable=True))
        op.add_column(
            "users", sa.Column("email_confirm_expires_at", sa.DateTime(), nullable=True)
        )
        op.add_column("users", sa.Column("email_confirmed_at", sa.DateTime(), nullable=True))
        # Unique indexes, not constraints, exactly as `models.py` declares them.
        op.create_index("ix_users_contact_email", "users", ["contact_email"], unique=True)
        # Not unique: a fresh request replaces the old token, and only one row holds
        # any given hash at a time anyway. This is here so the confirmation route can
        # find the account from the token without a scan.
        op.create_index("ix_users_email_confirm_hash", "users", ["email_confirm_hash"])

    op.create_table(
        "email_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        # email_result | email_digest | receipt — the first two are the words the
        # consent records use, so the row that authorises a send and the row that says
        # it was agreed to name one thing.
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("ref_id", sa.Integer(), nullable=True),
        sa.Column("ref_key", sa.String(length=24), nullable=True),
        # pending | sent | failed | stale | skipped
        sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(), nullable=False),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        # The transport's status word only. A provider's error text quotes the
        # address it was handed, and that does not belong in a log table.
        sa.Column("detail", sa.String(length=60), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_email_jobs_user_id"), "email_jobs", ["user_id"])
    op.create_index("ix_email_jobs_due", "email_jobs", ["status", "next_attempt_at"])
    op.create_index(
        "ux_email_jobs_ref",
        "email_jobs",
        ["user_id", "purpose", "ref_id"],
        unique=True,
        sqlite_where=sa.text("ref_id is not null"),
        postgresql_where=sa.text("ref_id is not null"),
    )
    op.create_index(
        "ux_email_jobs_week",
        "email_jobs",
        ["user_id", "purpose", "ref_key"],
        unique=True,
        sqlite_where=sa.text("ref_key is not null"),
        postgresql_where=sa.text("ref_key is not null"),
    )


def downgrade() -> None:
    op.drop_index("ux_email_jobs_week", table_name="email_jobs")
    op.drop_index("ux_email_jobs_ref", table_name="email_jobs")
    op.drop_index("ix_email_jobs_due", table_name="email_jobs")
    op.drop_index(op.f("ix_email_jobs_user_id"), table_name="email_jobs")
    op.drop_table("email_jobs")
    if not _users_is_there():
        return
    op.drop_index("ix_users_email_confirm_hash", table_name="users")
    op.drop_index("ix_users_contact_email", table_name="users")
    op.drop_column("users", "email_confirmed_at")
    op.drop_column("users", "email_confirm_expires_at")
    op.drop_column("users", "email_confirm_hash")
    op.drop_column("users", "contact_email")
