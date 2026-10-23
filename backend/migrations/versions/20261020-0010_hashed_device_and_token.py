"""Store the browser's two credentials as digests: `users.device_id` and `auth_tokens.token`.

Revision ID: 0010_hashed_device_and_token
Revises: 0009_observation_source_width
Create Date: 2026-10-20

Both columns held something that *is* a credential. `auth_tokens.token` was the primary key
and the bearer string, byte for byte, as issued — so a database read was a list of live
sessions, and a backup that left the machine (see docs/ARCHITECTURE_AND_TESTS.md §7,
"Backing up the database") was a
box of keys. `users.device_id` was the value `/api/auth/guest` accepts as the whole proof
that a browser may have an account — stored in plaintext, it turned the same read into a way
to reopen every device account on the site. Neither is plaintext any more.

What the two columns hold now is `sha256(value)` as 64 lowercase hex characters, which fits
the 64-character columns exactly, so **the shape of the tables does not change and nobody is
signed out**: the same bytes rename, then the same rows are rewritten in place. Unsalted
sha256 is the right tool for a 122-bit random value and a 43-character token, and the wrong
tool for a come-back code a child reads out loud, which is why that one has kept salted
PBKDF2 at 210,000 iterations since it was introduced. Two properties worth naming, because
they are what the change buys and what it does not:

* a dump, a `SELECT *` during an incident, or a hosted provider's query log no longer grants
  access, and no longer reveals which device ids are real;
* the browser still holds the values themselves, so a stolen *browser* (an XSS that reads
  `localStorage`, a shared laptop with an open session) is unaffected by this revision —
  that half is the `httpOnly` cookie, and it is still open.

One database arrives with **both** columns. `app/schema_sync.py` runs on every boot and adds
a nullable model column that an existing table lacks, so any deployment that started this code
before migrating has `users.device_hash` empty beside a plaintext `users.device_id`. A rename
into a name the table already holds raises `DuplicateColumnError`, which is how this revision
first failed in the field: the container boots, schema sync mutates the table, the entrypoint
then runs `alembic upgrade head`, and the entrypoint is what crashes. The merge path in
`upgrade` handles that state — hash the values across, drop the plaintext column — and
`scripts/migration_test.py` §10 builds the state on purpose to prove it. `auth_tokens` cannot
reach it: its column is the primary key, so it is not nullable, so schema sync will never add it.

The backfill is Python, not SQL. Neither engine has a usable `sha256()` in the standard
library set Postgres and SQLite both ship — Postgres's lives in `pgcrypto`, which is not
enabled on a managed database by default, and SQLite has none at all — and the hashing has to
match `app/security.py` character for character, so the function that reads these columns at
runtime is the function that wrote them. That is also why `alembic upgrade head --sql` prints
a warning instead of a migration for this revision: **offline mode cannot hash**, and a
server whose schema is applied by hand-run SQL would come up with a renamed column full of
plaintext values that every query then misses. Read the rendered SQL, then apply this
revision online (`alembic upgrade head`), which is what the container entrypoint does.

`upgrade` skips a value that is already 64 hex characters long, which is the one deliberate
loose end on this page. The reason is a session created *during* the migration: the application
has been writing digests by the time this backfill runs, and re-hashing a digest would silently
invalidate a live child's session. The cost is symmetric and small: a legacy device id that
happens to be exactly 64 characters is left as text, and that one browser has to start a new
account. The app never generates such an id — it is a `crypto.randomUUID()`, 36 characters — and
the test suite asserts the skip by name so this line cannot rot into a mystery.

`downgrade` renames the columns back and **clears them**, because the digests cannot be
reversed and a column named `device_id` full of sha256 values is a trap for whoever reads it
next. Every session ends and every device has to sign in again. No screen offers this, and it
is written only so that `alembic downgrade` is a real operation rather than a stack of
half-true statements.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0010_hashed_device_and_token"
down_revision: str | None = "0009_observation_source_width"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CHARS = sa.String(length=64)


def _digest(value: str) -> str:
    """The same function `app/security.py` uses to look these rows up.

    Imported rather than reimplemented would be nicer, but a migration that depends on the
    application's import graph breaks the day a module beside it fails to load, and this one
    has to run before the app does.
    """
    import hashlib

    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _has_table(table: str) -> bool:
    if context.is_offline_mode():
        return True
    return sa.inspect(op.get_bind()).has_table(table)


def _has_column(table: str, name: str) -> bool:
    if not _has_table(table):
        return False
    if context.is_offline_mode():
        return True
    insp = sa.inspect(op.get_bind())
    return any(column["name"] == name for column in insp.get_columns(table))


def _has_index(table: str, name: str) -> bool:
    if not _has_table(table):
        return False
    if context.is_offline_mode():
        return True
    return any(index["name"] == name for index in sa.inspect(op.get_bind()).get_indexes(table))


def _rename(table: str, old: str, new: str) -> None:
    """`RENAME COLUMN`, batched on SQLite the way every other ALTER here is.

    Batch mode rebuilds the table, which is the only way SQLite changes a column at all, and
    it is refused in offline mode — so `--sql` prints nothing for SQLite, exactly as revision
    0009 does, and the two engines still arrive at the same schema.
    """
    if op.get_context().dialect.name == "sqlite":
        if context.is_offline_mode():
            return
        with op.batch_alter_table(table) as batch:
            batch.alter_column(old, new_column_name=new, existing_type=CHARS,
                               existing_nullable=(table == "users"))
        return
    op.alter_column(table, old, new_column_name=new, existing_type=CHARS,
                    existing_nullable=(table == "users"))


def _drop_column(table: str, name: str) -> None:
    """`DROP COLUMN`, batched on SQLite the same way every ALTER here is.

    Batch mode is what keeps the surviving columns, their defaults and the primary key in
    place while one column goes; on Postgres the statement is the plain one.
    """
    if op.get_context().dialect.name == "sqlite":
        with op.batch_alter_table(table) as batch:
            batch.drop_column(name)
        return
    op.drop_column(table, name)


def _sqlite_offline() -> bool:
    """True when there is nothing this revision could print.

    Every SQLite change here goes through batch mode, and batch mode has no offline form —
    the same dispatch revision 0009 makes, for the same reason. `--sql` against a `.db` file
    therefore prints nothing for this revision, which is right: there is no statement a
    SQLite script could run that would not need the table rebuilt first.
    """
    return context.is_offline_mode() and op.get_context().dialect.name == "sqlite"


def _hash_across(table: str, ident: str, source: str, target: str) -> None:
    """Copy the plaintext in `source` into `target` as a digest, row by row.

    A value already exactly 64 characters is copied as it stands rather than re-digested —
    the same guard the backfill below uses, for the same reason: it may be a digest the
    application wrote while this revision was running, and hashing it again would silently
    end that child's session. A legacy plaintext id of that exact length is the one case
    that then stops matching, and its browser starts a fresh account.
    """
    bind = op.get_bind()
    for row in bind.execute(sa.text(
        f"SELECT {ident}, {source} FROM {table} "
        f"WHERE {source} IS NOT NULL AND {target} IS NULL"
    )).all():
        value = str(row[1])
        bind.execute(
            sa.text(f"UPDATE {table} SET {target} = :hash WHERE {ident} = :id"),
            {"hash": value if len(value) == 64 else _digest(value), "id": row[0]},
        )


def upgrade() -> None:
    if _sqlite_offline():
        return

    renamed_users = False
    renamed_tokens = False

    # users.device_id -> users.device_hash
    #
    # The index is dropped and recreated rather than left alone: renaming a column does not
    # rename the index on either engine, so `ix_users_device_id` would go on pointing at a
    # column with that name in the metadata and nowhere in the database. The new name is what
    # `app/models.py` declares, and `scripts/migration_test.py` compares index names between
    # the two build paths, so a leftover would fail there rather than in production.
    if _has_column("users", "device_id"):
        if _has_column("users", "device_hash"):
            # Both columns: the application got here first. `app/schema_sync.py` runs on
            # every boot and adds a nullable model column an existing table lacks, so a
            # deployment that started the new code before migrating has `device_hash`
            # sitting beside the plaintext `device_id` — and renaming into a name the table
            # already holds is the `DuplicateColumnError` that crashed this revision on the
            # first such database. This path hashes the values across, then drops the column
            # that held them, which lands on the same schema the rename lands on.
            #
            # Offline mode renders neither half of it. A hand-applied SQL script cannot
            # hash (see the module docstring), so dropping `device_id` there would delete
            # the only copy of those ids; the warning below tells the reader to run this
            # revision online instead.
            if not context.is_offline_mode():
                _hash_across("users", "id", "device_id", "device_hash")
                if _has_index("users", "ix_users_device_id"):
                    op.drop_index("ix_users_device_id", table_name="users")
                _drop_column("users", "device_id")
                if not _has_index("users", "ix_users_device_hash"):
                    op.create_index("ix_users_device_hash", "users", ["device_hash"],
                                    unique=False)
        else:
            renamed_users = True
            if not context.is_offline_mode():
                op.drop_index("ix_users_device_id", table_name="users")
            _rename("users", "device_id", "device_hash")
            op.create_index("ix_users_device_hash", "users", ["device_hash"], unique=False)

    # auth_tokens.token -> auth_tokens.token_hash
    #
    # A primary key rename, and only a name: the constraint travels with the column on
    # Postgres, and batch mode recreates it on SQLite. No session row is inserted, deleted or
    # moved, so every browser keeps the session it has.
    if _has_column("auth_tokens", "token"):
        renamed_tokens = True
        _rename("auth_tokens", "token", "token_hash")

    if context.is_offline_mode():
        op.execute(
            "-- 0010: the renamed columns now need their values hashed. Offline SQL cannot do "
            "that (no sha256 in either engine's built-ins, and the digest has to match "
            "app/security.py exactly), so this rendered file is for reading, not for applying "
            "to a database that holds accounts. Run `alembic upgrade head` against it instead."
        )
        return

    bind = op.get_bind()
    # `length(x) <> 64` is the already-a-digest guard described in the docstring: a plaintext
    # token is 43 characters and a plaintext device id is a 36-character UUID, while every
    # value this app now writes is exactly 64.
    #
    # Each loop is gated on the column this revision just renamed, not on the table existing:
    # a database that arrives here without `users` at all (§8 of `migration_test.py` builds one
    # by hand, the way an app boot once did) must not be asked a question about a table it has
    # never held. On such a database this revision genuinely has nothing to do — the baseline
    # that follows creates the column already hashed.
    if renamed_users:
        for row in bind.execute(sa.text(
            "SELECT id, device_hash FROM users "
            "WHERE device_hash IS NOT NULL AND length(device_hash) <> 64"
        )).all():
            bind.execute(
                sa.text("UPDATE users SET device_hash = :hash WHERE id = :id"),
                {"hash": _digest(str(row[1])), "id": row[0]},
            )
    if renamed_tokens:
        for row in bind.execute(sa.text(
            "SELECT token_hash FROM auth_tokens WHERE length(token_hash) <> 64"
        )).all():
            bind.execute(
                sa.text("UPDATE auth_tokens SET token_hash = :hash WHERE token_hash = :old"),
                {"hash": _digest(str(row[0])), "old": row[0]},
            )


def downgrade() -> None:
    if _sqlite_offline():
        return
    if _has_column("auth_tokens", "token_hash"):
        _rename("auth_tokens", "token_hash", "token")
        if not context.is_offline_mode():
            # Cleared rather than left as digests under a column named `token`, and this
            # cannot be a copy-back: a primary key holds one value per session and the
            # plaintext is gone. Undoing this revision signs every child out, which is the
            # honest meaning of undoing it.
            op.get_bind().execute(sa.text("DELETE FROM auth_tokens"))
    if _has_column("users", "device_hash"):
        if not context.is_offline_mode():
            op.drop_index("ix_users_device_hash", table_name="users")
        _rename("users", "device_hash", "device_id")
        op.create_index("ix_users_device_id", "users", ["device_id"], unique=False)
        if not context.is_offline_mode():
            op.get_bind().execute(sa.text("UPDATE users SET device_id = NULL"))
