"""Require the student's own approval before a guardian link shares anything.

Revision ID: 0021_guardian_consent
Revises: 0020_drop_comeback_code
Create Date: 2026-11-13

`guardianships` used to be access itself: redeeming a share code created a row and the
parent could read the summary with no further step. The two columns added here separate
the request from the agreement, so a pending row reaches no parent route and a withdrawn
one reads as withdrawn rather than simply missing.

Every row that already exists was created by a code the student handed over, so the
backfill treats that hand-over as the agreement that was on record at the time. New rows
start NULL and wait for the student's approval in Family Access.

Guarded like 0013–0020: a database built with `Base.metadata.create_all` before this
chain ran has the table but may not have these columns, and offline mode has no database
to inspect, so the ADD is emitted there rather than skipped.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0021_guardian_consent"
down_revision: str | None = "0020_drop_comeback_code"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNS: list[tuple[str, sa.types.TypeEngine]] = [
    ("consent_granted_at", sa.DateTime()),
    ("consent_withdrawn_at", sa.DateTime()),
]


def _has_table() -> bool:
    if context.is_offline_mode():
        return True
    return sa.inspect(op.get_bind()).has_table("guardianships")


def _present(column: str) -> bool:
    if context.is_offline_mode():
        return True
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("guardianships"):
        return False
    return any(item["name"] == column for item in inspector.get_columns("guardianships"))


def upgrade() -> None:
    if not _has_table():
        return
    added = False
    for column, column_type in COLUMNS:
        if not _present(column):
            op.add_column("guardianships", sa.Column(column, column_type, nullable=True))
            added = True
    if added and _present("consent_granted_at"):
        # Existing links came from a code the student chose to hand over, which is the
        # only agreement this table ever recorded. They keep that access; links made
        # after this revision wait for an approval the student can see.
        #
        # Only when this revision added the column. If boot sync got there first, the new
        # code has been running against it, and a pending request made in that window is
        # indistinguishable from an old link by these columns alone — so nothing is
        # backfilled and every such link waits for an approval instead. Failing closed
        # costs a parent a re-approval; guessing wrong would grant access nobody gave.
        op.execute(
            "UPDATE guardianships SET consent_granted_at = created_at "
            "WHERE consent_granted_at IS NULL"
        )


def downgrade() -> None:
    if not _has_table():
        return
    for column, _ in COLUMNS:
        if _present(column):
            op.drop_column("guardianships", column)
