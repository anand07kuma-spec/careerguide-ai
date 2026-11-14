"""One normalised profile photo per account, held in the database.

Revision ID: 0019_profile_photos
Revises: 0018_email_password_auth
Create Date: 2026-11-12

`image` holds the bytes, for exactly the reason 0002 gives for `report_pdfs.pdf_bytes`:
the deployed backend has no filesystem that outlives a request or a deploy, and a path
would be a second copy of something a family asked to have erased. With the picture in
this table, deleting the account deletes the photo by the same row `users.py` already
walks, and there is no bucket to enter separately.

`user_id` is the primary key, not a surrogate id: one account has one photo, replacing
it is an UPDATE, and there is never an old object left behind to sweep. `updated_at` is
also the URL's cache-busting version.

`Pillow` (added to requirements.txt beside this revision) is what decides whether the
bytes are an image at all, and writes the square JPEG that lands here — see
`app/services/profile_photos.py`.

Guarded the way 0013–0018 are: `Base.metadata.create_all` can make this table on a
laptop where the new code booted before Alembic was pointed at the database, and
offline mode (`alembic upgrade head --sql`) has no database to inspect, so the CREATE
is emitted there rather than skipped.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0019_profile_photos"
down_revision: str | None = "0018_email_password_auth"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _exists() -> bool:
    if context.is_offline_mode():
        return False
    return sa.inspect(op.get_bind()).has_table("profile_photos")


def upgrade() -> None:
    if _exists():
        return
    op.create_table(
        "profile_photos",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(length=32), nullable=False),
        sa.Column("image", sa.LargeBinary(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    if _exists():
        op.drop_table("profile_photos")
