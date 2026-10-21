"""Schools and counsellors as organisations: who a person belongs to, and what that shows.

Revision ID: 0007_tenancy
Revises: 0006_study_abroad
Create Date: 2026-10-18

Four tables, and one rule that every column below is arranged around: **no work of a
child is readable through a membership until that child — or their guardian — accepts
the invite, and even then only what the accepting account switched on.** A school that
bulk-invites fifty addresses gets fifty rows in `memberships` with `status = 'invited'`,
no `user_id`, and nothing joinable to a sitting, an answer or a conversation. That is not
a limitation of the migration; it is the thing it is built to guarantee.

The three columns that carry it:

* `memberships.status` — only the accept route moves a row from `invited` to `active`,
  and it can do that only for the account that presents the token.
* `memberships.share_results` — the member's own switch. No organisation route writes it,
  so a school cannot decide that its students' reports are visible to the school.
* `session_notes.shared_with_family` — starts false, so a counsellor's working text about
  a client is private until that counsellor deliberately shares it.

`users.role` is not touched. It stays `student | parent`, which is what the account is to
its own family. `counsellor` and `school_admin` live in `memberships.org_role`, scoped to
one organisation and read from the database on every request — a token still carries no
role, and a person may be a parent in one portal and a counsellor in another without
either overwriting the other. `users.is_admin` remains the platform owner's flag, set only
by `scripts/admin_grant.py`; nothing here grants it.

The two indexes over `memberships` are partial uniques rather than composite constraints,
and the reason is the same as in 0005: a unique index treats NULL as distinct on SQLite
and PostgreSQL alike, so a plain `(organization_id, user_id)` rule would let one person
hold five `invited` rows in one school, and a plain constraint could not be added to a
table that already has rows anyway. They are indexes so that `migrations/` and
`Base.metadata.create_all` build the identical database — SQLite cannot attach a named
constraint to an existing table.

`organizations.slug` doubles as the left-hand label of a branded subdomain. Nothing in
this schema makes that an authorisation input, and nothing in the code is allowed to: the
Host header picks which portal to render, and every route re-checks the caller's
membership against the slug in the URL.

Downgrade drops the four tables. It deletes memberships, the addresses they hold, and any
session notes written against them; it does not delete the accounts of people who joined,
because those accounts are their own and predate the school's invite.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_tenancy"
down_revision: str | None = "0006_study_abroad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = (
    "session_notes",
    "memberships",
    "organization_branding",
    "organizations",
)


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), nullable=False),
        # Also the subdomain label. Validated to lowercase letters, digits and single
        # hyphens by the route and re-checked by the resolver, so a name the browser can
        # reach is always one the API can address.
        sa.Column("slug", sa.String(length=40), nullable=False),
        # school | counsellor — the two kinds differ in what their members may do.
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        # A catalogue code from app/services/reseller.py. Not a charge: no tier here is
        # purchasable, and the payment routes still refuse a plan that is not sellable.
        sa.Column("tier_code", sa.String(length=24), nullable=False),
        # Whether the platform has confirmed the institution is what it says it is. A
        # portal's public label reads from this, never from the name somebody typed.
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)
    op.create_index(op.f("ix_organizations_kind"), "organizations", ["kind"])
    # What the operator's list asks: live organisations of one kind.
    op.create_index("ix_organizations_kind_active", "organizations", ["kind", "is_active"])

    op.create_table(
        "organization_branding",
        # Keyed by the organisation, so there is no "which branding is current" query.
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("portal_title", sa.String(length=80), nullable=True),
        # The one free-text field, and the one a child reads before deciding to join.
        sa.Column("welcome_note", sa.Text(), nullable=True),
        # A URL, not an upload: there is no tenant file storage, and a hosted logo would
        # outlive the school that put it there.
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        # "#rrggbb" from a fixed palette checked at the route — a free-form colour can
        # make a warning look like a button on a child's result screen.
        sa.Column("accent_color", sa.String(length=7), nullable=True),
        sa.Column("changed_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("organization_id"),
    )

    op.create_table(
        "memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        # NULL until the person joins, and the accept route is the only thing that gives
        # it a value. A row with no user is a roster entry, not access.
        sa.Column("user_id", sa.Integer(), nullable=True),
        # student | parent | counsellor | school_admin — inside this organisation only.
        sa.Column("org_role", sa.String(length=16), nullable=False),
        # invited | active | revoked
        sa.Column("status", sa.String(length=12), nullable=False),
        # Normalised to lowercase. The inviter's own data about somebody they already
        # employ or enrol; never used to address a person in a message.
        sa.Column("invited_email", sa.String(length=254), nullable=True),
        # SHA-256 of the single-use invite token, never the token itself — same reasoning
        # as users.email_confirm_hash in 0005.
        sa.Column("invite_hash", sa.String(length=64), nullable=True),
        # Checked only while the row is still `invited`; a live membership ends when a
        # person leaves or the platform removes them, not on a clock.
        sa.Column("invite_expires_at", sa.DateTime(), nullable=True),
        sa.Column("joined_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        # What the inviter typed as the name, so a roster is readable before anybody
        # joins. Never joined to anything the child has written.
        sa.Column("display_label", sa.String(length=80), nullable=True),
        # The member's own switch, written only by their accept call and their settings.
        sa.Column("share_results", sa.Boolean(), nullable=False),
        # An assignment of *contact*, not of data: it names one of this organisation's own
        # counsellor memberships and grants nothing extra.
        sa.Column("assigned_counsellor_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_counsellor_id"], ["memberships.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_memberships_organization_id"), "memberships", ["organization_id"])
    op.create_index(op.f("ix_memberships_user_id"), "memberships", ["user_id"])
    # The accept route arrives with a token and nothing else.
    op.create_index("ix_memberships_invite_hash", "memberships", ["invite_hash"])
    # What both dashboards ask: this organisation's members, by status.
    op.create_index("ix_memberships_org_status", "memberships", ["organization_id", "status"])
    op.create_index(
        "ux_memberships_org_user",
        "memberships",
        ["organization_id", "user_id"],
        unique=True,
        sqlite_where=sa.text("user_id is not null"),
        postgresql_where=sa.text("user_id is not null"),
    )
    op.create_index(
        "ux_memberships_org_email",
        "memberships",
        ["organization_id", "invited_email"],
        unique=True,
        sqlite_where=sa.text("invited_email is not null"),
        postgresql_where=sa.text("invited_email is not null"),
    )

    op.create_table(
        "session_notes",
        sa.Column("id", sa.Integer(), nullable=False),
        # Denormalised beside the client on purpose: every query here is scoped by
        # organisation first, and isolation should not depend on remembering a join.
        sa.Column("organization_id", sa.Integer(), nullable=False),
        # Must be an *active* membership — the route enforces it, so a note cannot be
        # written about a child who has not accepted the arrangement.
        sa.Column("client_membership_id", sa.Integer(), nullable=False),
        sa.Column("author_user_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        # Private working text until the counsellor deliberately shares it.
        sa.Column("shared_with_family", sa.Boolean(), nullable=False),
        sa.Column("shared_at", sa.DateTime(), nullable=True),
        sa.Column("edited_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["client_membership_id"], ["memberships.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_session_notes_organization_id"), "session_notes", ["organization_id"])
    # A client's history, in order; and an author's own notes.
    op.create_index("ix_session_notes_client", "session_notes", ["client_membership_id", "created_at"])
    op.create_index("ix_session_notes_author", "session_notes", ["author_user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_session_notes_author", table_name="session_notes")
    op.drop_index("ix_session_notes_client", table_name="session_notes")
    op.drop_index(op.f("ix_session_notes_organization_id"), table_name="session_notes")
    op.drop_table("session_notes")
    op.drop_index("ux_memberships_org_email", table_name="memberships")
    op.drop_index("ux_memberships_org_user", table_name="memberships")
    op.drop_index("ix_memberships_org_status", table_name="memberships")
    op.drop_index("ix_memberships_invite_hash", table_name="memberships")
    op.drop_index(op.f("ix_memberships_user_id"), table_name="memberships")
    op.drop_index(op.f("ix_memberships_organization_id"), table_name="memberships")
    op.drop_table("memberships")
    op.drop_table("organization_branding")
    op.drop_index("ix_organizations_kind_active", table_name="organizations")
    op.drop_index(op.f("ix_organizations_kind"), table_name="organizations")
    op.drop_index("ix_organizations_slug", table_name="organizations")
    op.drop_table("organizations")
