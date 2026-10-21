"""Who runs the site, and what they did: an operator log nothing else can write to.

Revision ID: 0008_admin_audit
Revises: 0007_tenancy
Create Date: 2026-10-19

One table. It exists because the admin screens change live data — they decide who else
counts as an operator, disable an account, correct a career entry, answer a family's
enquiry — and a deployment that can be changed by five people but cannot say who changed
it has no record worth trusting. Every column below is arranged around what such a log
must **not** contain:

* No request body. `detail` is a short string written by the route that knows what
  changed (`"is_admin -> true"`, `"status -> disabled"`), never a dump of the record.
  The records an operator touches carry a student's name and a family's question, and a
  log is read by whoever has the run of the deployment, which is not the same list of
  people entitled to those rows.
* No conversation content, and no route that could put it there. Messages stay behind
  the guardian rules; nothing in this migration references them.
* No IP address, no user agent, no device string. The privacy page states that location
  and device fingerprints are not stored, and an operator log that quietly kept a
  geolocation per action would make that sentence false. `origin` names the surface the
  call came from (`api`, `webhook`, `script`), which is the part that actually helps
  someone read the log back.
* No edit path. There is no update and no delete for these rows anywhere in the app, and
  a log the operator can revise is a log nobody can rely on. This migration is the only
  way rows appear or leave.

`actor_user_id` is nullable with `ondelete="SET NULL"`, and `actor_name` is a snapshot
taken at write time. The pairing is deliberate: an operator account that is later closed
must leave a legible history behind, and keeping a dead account alive to satisfy a
foreign key is the wrong way to get it. The name is capped by a column because it came
from a profile the actor once typed, not from this table.

Like 0007, the indexes are created explicitly so that `migrations/` and
`Base.metadata.create_all` build the identical database — SQLite cannot attach a named
index to an existing table, and the two composite indexes below are the two questions
this table will actually be asked: what did this person do, and when was this action
last taken.

Downgrade drops the table and with it the history of every operator action since the
site had operators. That is the honest cost of a downgrade, and it is why no screen
offers one.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_admin_audit"
down_revision: str | None = "0007_tenancy"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = (
    "audit_events",
)


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Integer(), nullable=False),
        # Null after the account is deleted, by design — see the docstring. The row has
        # to keep meaning something once the person who caused it is gone.
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        # Snapshot of the actor's label at write time, so a `SET NULL` above still
        # leaves a readable line.
        sa.Column("actor_name", sa.String(length=80), nullable=True),
        # A dotted verb owned by the routes, never free text: `user.admin_grant`,
        # `user.status`, `career.update`, `question.update`, `lead.reply`,
        # `university.update`, `story.update`, `org.update`, `deployment.read`.
        sa.Column("action", sa.String(length=48), nullable=False),
        sa.Column("subject_type", sa.String(length=24), nullable=True),
        # A string, not an integer: subjects are careers (slug), questions (code),
        # universities (slug) and organisations (slug) as often as they are user ids.
        sa.Column("subject_id", sa.String(length=48), nullable=True),
        sa.Column("detail", sa.String(length=400), nullable=True),
        # Which surface the call arrived on. Presentation and provenance only — it is
        # never read back as permission for anything.
        sa.Column(
            "origin", sa.String(length=16), nullable=False, server_default="api"
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["actor_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_audit_events_actor_user_id"), "audit_events", ["actor_user_id"]
    )
    op.create_index(
        "ix_audit_events_actor_time", "audit_events", ["actor_user_id", "created_at"]
    )
    op.create_index(
        "ix_audit_events_action", "audit_events", ["action", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_audit_events_action", table_name="audit_events")
    op.drop_index("ix_audit_events_actor_time", table_name="audit_events")
    op.drop_index(op.f("ix_audit_events_actor_user_id"), table_name="audit_events")
    op.drop_table("audit_events")
