"""Money: one plan row per account, and one row per order ever created.

Revision ID: 0004_payments_tables
Revises: 0003_clerk_link
Create Date: 2026-10-18

Two new tables, no column added to a table that already has rows in it, so this
revision cannot strand an existing account and its downgrade loses only payments —
which is the honest direction for a schema about money: a family's answers are never
on the line when a billing feature is rolled back.

`subscriptions` keys on `user_id` as its primary key. One account cannot be on two
plans at once, and a billing screen should never have to decide which of several
rows wins. There is no `status` column here either, deliberately: whether a plan is
active is a comparison with the current time, and storing that answer as well would
let a stale "active" keep a paid feature unlocked after the period it was bought for
had ended.

`payments` holds no card data and no provider payload. Razorpay's own iframe sees the
card; this server only ever sees an order id, a payment id and a signature, and those
are the only provider strings stored. The raw `payment.captured` JSON carries a
card's last four digits, its issuer and the cardholder's name, and copying that into
a database that also holds children's answers would be a leak waiting for a backup to
go somewhere it was not meant to.

Amounts are in paise. ₹299 as a float is 299.0, ₹2,499 as a float is fine, and the
first rounding error nobody notices is the one on an invoice a parent has to trust.

Apply with `alembic upgrade head`, or `alembic stamp` the previous revision first on
a database the app already prepared — see the note at the top of 0001. On SQLite the
app's own `create_all` builds these tables too, so a fresh local run needs nothing.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_payments_tables"
down_revision: str | None = "0003_clerk_link"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "subscriptions",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("plan_code", sa.String(length=24), nullable=False),
        # free | payment | granted. `granted` is how a school licence or a teacher's
        # cohort gets a paid plan without this database claiming money arrived.
        sa.Column("source", sa.String(length=12), nullable=False),
        sa.Column("interval", sa.String(length=12), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        # NULL means this plan does not end on its own — the free plan, or a granted
        # licence. A paid period always has one.
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("changed_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=16), nullable=False),
        sa.Column("order_id", sa.String(length=64), nullable=False),
        # NULL until the provider says the payment exists. Many NULLs are allowed in
        # a unique index on both engines, which is why this can be unique at all.
        sa.Column("payment_id", sa.String(length=64), nullable=True),
        sa.Column("plan_code", sa.String(length=24), nullable=False),
        sa.Column("interval", sa.String(length=12), nullable=False),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("failure_reason", sa.String(length=200), nullable=True),
        sa.Column("receipt", sa.String(length=48), nullable=False),
        sa.Column("captured_at", sa.DateTime(), nullable=True),
        # The adult attestation, stored per order rather than once per account: the
        # question "who said they were allowed to pay for this?" has a different answer
        # for each payment, and it is the one a dispute will ask.
        sa.Column("adult_attested", sa.Boolean(), nullable=False),
        sa.Column("test_mode", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_payments_user_id"), "payments", ["user_id"])
    # Two unique *indexes* rather than constraints, matching models.py: SQLite cannot
    # add a named constraint to a table that already has rows, and an index behaves
    # the same on both engines. The one order id may never be paid twice, and the one
    # payment id may never unlock a plan twice.
    op.create_index("ix_payments_order_id", "payments", ["order_id"], unique=True)
    op.create_index("ix_payments_payment_id", "payments", ["payment_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_payments_payment_id", table_name="payments")
    op.drop_index("ix_payments_order_id", table_name="payments")
    op.drop_index(op.f("ix_payments_user_id"), table_name="payments")
    op.drop_table("payments")
    op.drop_table("subscriptions")
