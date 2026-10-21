#!/bin/sh
# What happens between `docker run` and uvicorn answering.
#
# Two jobs, both of which the app used to do itself on first boot, and neither of which
# it should do there any more:
#
#   1. bring the schema to head, and
#   2. seed the catalogue if the tables that just arrived are empty.
#
# The order is the whole content of this script.
#
# It used to be a different story, and the reason is worth keeping in one sentence so
# nobody re-introduces it: `0001_assessment_tables` rows belong to a person, so it points
# a foreign key at `users`. Before the baseline revision, nothing in the chain created
# `users` — the app did, with `create_all`, on first boot. SQLite lets a `CREATE TABLE`
# point at a table that does not exist yet and only complains when a row is written;
# Postgres rejects the DDL outright with `relation "users" does not exist`. So on the
# database a deployment actually uses, "migrations first, tables second" was not
# buildable from nothing, and this script had to run `db_init.py` before Alembic could
# run at all.
#
# `0000_baseline_schema` fixed that: the chain now owns all thirty-seven tables, and an
# empty Postgres can be built by `alembic upgrade head` alone. Which leaves three states a
# container can boot into, and the script tells them apart by asking the database:
#
#   * `alembic_version` exists → migrations own it. `upgrade head` runs whatever the
#     deployment is behind by, against a schema whose core tables are already there.
#   * no `alembic_version` and no tables → this is a volume that has never held anything,
#     which is exactly the case the baseline was written for. Build it with the chain, not
#     with `create_all`, so the deployment schema is the reviewed SQL and nothing else.
#   * no `alembic_version` but tables present → a database prepared by the app's own first
#     boot, or restored from a backup taken before the chain existed. Its schema is what the
#     models describe; `db_init.py` confirms it, and `stamp head` records that fact without
#     replaying DDL over tables that exist. That is what the header of
#     `0001_assessment_tables` used to tell an operator to do by hand; doing it here is what
#     stops the hand-off from being a thing only somebody remembers at 3am.
#
# The stamp is not a shortcut for a *running* database: a database at `0005` takes the
# first path and gets 0006–0009 actually applied, reviewed SQL and all.
#
# Nothing here downgrades. A full `downgrade base` now drops `users` with everything else,
# because the baseline owns that table — so an undo at 3am would take the accounts with it.
# Schema changes move forward, one reviewed revision at a time.
#
# `DB_AUTO_SETUP=true` — still the default for a laptop running SQLite — creates tables and
# seeds on every cold start. That is convenient locally and wrong in a container that may
# be restarted, scaled or rolled while holding a real database: schema changes belong in a
# step somebody reviewed, not in whatever the app notices at 03:00. So this script runs
# that step and then turns the convenience off for the process it starts.
#
# Set RUN_MIGRATIONS=0 on a replica that should follow a leader rather than race it.
# Several containers all running `upgrade head` against one Postgres is a deadlock waiting
# to happen, and Postgres itself serialises the DDL — but only one of them gets to find out.

set -e

ask_the_database() {
  # One of: alembic (this database is under migration control) / empty (nothing yet) /
  # app-built (tables, but no version table — the chain has never been pointed at it).
  python - <<'PY'
from sqlalchemy import inspect

from app.database import engine

tables = set(inspect(engine).get_table_names())
if "alembic_version" in tables:
    print("alembic")
elif not tables:
    print("empty")
else:
    print(f"app-built:{len(tables)}")
PY
}

case "$(ask_the_database)" in
  alembic)
    echo "[entrypoint] migrations own this database: alembic upgrade head"
    python -m alembic upgrade head
    echo "[entrypoint] confirming tables and seeding the catalogue if it is empty"
    # Masked URL in the output; refuses to drop anything that holds rows.
    python scripts/db_init.py
    ;;
  empty)
    echo "[entrypoint] empty database: the chain builds all of it, baseline first"
    python -m alembic upgrade head
    echo "[entrypoint] seeding the catalogue"
    python scripts/db_init.py
    ;;
  *)
    echo "[entrypoint] tables with no alembic_version: preparing from the models, then stamping"
    python scripts/db_init.py
    python -m alembic stamp head
    ;;
esac

export DB_AUTO_SETUP=false
echo "[entrypoint] DB_AUTO_SETUP=false for the app: this script owns the schema now"

exec "$@"
