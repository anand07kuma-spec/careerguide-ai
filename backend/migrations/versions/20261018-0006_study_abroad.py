"""A directory of foreign universities, the work sold around it, and the enquiries.

Revision ID: 0006_study_abroad
Revises: 0005_email_outbox
Create Date: 2026-10-18

Five tables, and every one of them is built around the same refusal: **a fact about a
university is stored with the page it came from and the day somebody read it, or it is
not stored at all.** Tuition, intake months, application deadlines and visa routes
change every year, and this repository cannot go and check a hundred institutions. So
the columns that hold those figures are nullable, `verified` defaults to false, and an
unseeded row renders as "Not verified yet — check the university's own site" instead of
a plausible number. A guessed fee on a study-abroad page is the worse outcome: it is
exactly the figure a family budgets against.

`users.is_admin` is added as a nullable column for the same reason every earlier
widening of that table was: it goes onto a table already holding real accounts, and a
NOT NULL column cannot do that. NULL reads as "not an admin", so this migration grants
nothing to anybody — the flag is set afterwards, deliberately, by
`scripts/admin_grant.py`, by somebody who already owns the database.

`study_leads` is the only table here that stores what a person typed. It has no
`user_id` column, and that is on purpose: an enquiry about studying abroad is not part
of a child's career record, and linking the two would let a commercial follow-up reach
an account that was never asked. `study_stories` is created empty. A testimonial about
an admissions outcome is a claim that something happened to a real somebody, and this
migration cannot invent one — an admin form and a page section exist for it, and the
page says nothing has been published until the owner publishes something with the
person's agreement dated.

Downgrade drops the five tables, their indexes and the flag. Enquiries already stored
are deleted with the table; anything already mailed to an operator is not recalled by
this, and does not pretend to be.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op
from sqlalchemy.dialects import postgresql

revision: str = "0006_study_abroad"
down_revision: str | None = "0005_email_outbox"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Generic JSON on SQLite (stored as TEXT), JSONB on PostgreSQL so the columns stay
# indexable there — the same variant `app/models.py` declares.
JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")

TABLES = (
    "study_stories",
    "study_leads",
    "study_services",
    "study_universities",
    "study_countries",
)


def _users_is_there() -> bool:
    """`users` predates the revision chain; see the note in 0003."""
    if context.is_offline_mode():
        return True
    return sa.inspect(op.get_bind()).has_table("users")


def upgrade() -> None:
    if _users_is_there():
        op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=True))

    op.create_table(
        "study_countries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("code", sa.String(length=3), nullable=False),
        # Our own prose. Where a legal fact has to be mentioned the row links to the
        # official portal below instead of summarising it, because a summary of visa
        # rules is a thing that silently goes wrong.
        sa.Column("overview", sa.Text(), nullable=False),
        sa.Column("language_note", sa.Text(), nullable=True),
        sa.Column("intake_note", sa.Text(), nullable=True),
        sa.Column("cost_note", sa.Text(), nullable=True),
        sa.Column("work_after_note", sa.Text(), nullable=True),
        # Questions a family still has to check themselves, not answers about them.
        sa.Column("to_check", JSON, nullable=False),
        sa.Column("visa_portal_url", sa.String(length=500), nullable=True),
        sa.Column("visa_portal_label", sa.String(length=120), nullable=True),
        sa.Column("qualifications_portal_url", sa.String(length=500), nullable=True),
        sa.Column("qualifications_portal_label", sa.String(length=120), nullable=True),
        # NULL means nobody has re-read this copy against the portal since it was
        # written, and the page says so rather than dating it silently.
        sa.Column("checked_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_study_countries_slug", "study_countries", ["slug"], unique=True)

    op.create_table(
        "study_universities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("country_id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("city", sa.String(length=80), nullable=False),
        # public | private, in India's sense of who funds the institution.
        sa.Column("kind", sa.String(length=16), nullable=False),
        # The university's own domain: the one claim a seeded row makes besides its
        # name, and the link every unverified column below tells the reader to use.
        sa.Column("official_url", sa.String(length=400), nullable=False),
        sa.Column("founded_year", sa.Integer(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("areas", JSON, nullable=False),
        # --- Everything from here stays NULL until somebody reads it off a source. ---
        sa.Column("tuition_note", sa.Text(), nullable=True),
        sa.Column("intakes", JSON, nullable=False),
        sa.Column("application_urls", JSON, nullable=False),
        sa.Column("english_test_note", sa.Text(), nullable=True),
        sa.Column("deadline_note", sa.Text(), nullable=True),
        # A fee with no source and no date on it is a fee that will quietly become
        # wrong while still looking like a fact.
        sa.Column("source_url", sa.String(length=500), nullable=True),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        # Paid placement, disclosed on screen and never used to order the list.
        sa.Column("sponsored", sa.Boolean(), nullable=False),
        sa.Column("sponsorship_disclosure", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["country_id"], ["study_countries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_study_universities_country_id"), "study_universities", ["country_id"])
    op.create_index("ix_study_universities_slug", "study_universities", ["slug"], unique=True)
    # What the public pages actually ask: the live universities of one country, in the
    # order the operator set.
    op.create_index("ix_study_universities_country", "study_universities", ["country_id", "is_active"])

    op.create_table(
        "study_services",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=60), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("steps", JSON, nullable=False),
        sa.Column("includes", JSON, nullable=False),
        # As important as `includes`: the thing a family assumes is covered and is not.
        sa.Column("not_included", JSON, nullable=False),
        sa.Column("who_for", sa.Text(), nullable=True),
        sa.Column("fees_note", sa.Text(), nullable=True),
        # False means the page shows the service as coming soon, with no button that
        # pretends otherwise. There is no `outcomes` column at all: no row here gets to
        # say what a university will decide.
        sa.Column("available", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_study_services_slug", "study_services", ["slug"], unique=True)

    op.create_table(
        "study_leads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        # Plaintext, because it is the address the operator has to write back to. It is
        # never confirmed by a link, which is why the acknowledgement is the only mail
        # this row can ever cause.
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("phone", sa.String(length=24), nullable=True),
        # "class 12 this year", not a school, not a city: nothing here identifies where
        # a minor studies.
        sa.Column("stage", sa.String(length=32), nullable=True),
        sa.Column("country_id", sa.Integer(), nullable=True),
        sa.Column("service_id", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("source_page", sa.String(length=120), nullable=True),
        sa.Column("consent_contact", sa.Boolean(), nullable=False),
        sa.Column("consent_contact_at", sa.DateTime(), nullable=True),
        # new | contacted | closed
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("handled_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        # SET NULL, not CASCADE: deleting a destination or a service is a catalogue
        # edit, and it must not quietly delete the enquiry a family sent about it.
        sa.ForeignKeyConstraint(["country_id"], ["study_countries.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["service_id"], ["study_services.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_study_leads_email"), "study_leads", ["email"])
    # The admin list: what is still unanswered, newest first.
    op.create_index("ix_study_leads_status", "study_leads", ["status", "created_at"])

    op.create_table(
        "study_stories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("headline", sa.String(length=160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        # However the person asked to be named: a first name, initials, or a role.
        sa.Column("attribution", sa.String(length=80), nullable=False),
        sa.Column("country_id", sa.Integer(), nullable=True),
        sa.Column("university_id", sa.Integer(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        # The day the named person agreed to this being published. The admin route
        # refuses to publish a row without it, which is the whole reason this table
        # ships with zero rows in it.
        sa.Column("consent_confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("published", sa.Boolean(), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["country_id"], ["study_countries.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["university_id"], ["study_universities.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("study_stories")
    op.drop_index("ix_study_leads_status", table_name="study_leads")
    op.drop_index(op.f("ix_study_leads_email"), table_name="study_leads")
    op.drop_table("study_leads")
    op.drop_index("ix_study_services_slug", table_name="study_services")
    op.drop_table("study_services")
    op.drop_index("ix_study_universities_country", table_name="study_universities")
    op.drop_index("ix_study_universities_slug", table_name="study_universities")
    op.drop_index(op.f("ix_study_universities_country_id"), table_name="study_universities")
    op.drop_table("study_universities")
    op.drop_index("ix_study_countries_slug", table_name="study_countries")
    op.drop_table("study_countries")
    if not _users_is_there():
        return
    op.drop_column("users", "is_admin")
