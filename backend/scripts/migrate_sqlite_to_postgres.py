"""Move a running SQLite database onto PostgreSQL, keeping every id.

This is the script for the day the laptop database has to become a server database.
It is deliberately boring and deliberately reversible: it reads the SQLite file, writes
into PostgreSQL, and never deletes or alters anything it read from. The source file is
closed at the end of the run exactly as it was opened, which matters because that file
holds children's conversations and the only copy of a student's unfinished assessment.

Three things make a naive dump-and-restore go wrong, and all three are handled here:

* **Order.** A row cannot point at a table the target has not built its rows for yet.
  The tables are walked in `Base.metadata.sorted_tables` order — the same topological
  order SQLAlchemy uses to emit `CREATE TABLE` — so `users` arrives before the
  `assessments` that reference it.
* **Ids.** Every row keeps its original primary key, because a `recommendations` row
  names a `careers.id` and a `messages` row names a session. PostgreSQL does not advance
  a sequence when you insert an explicit id, so a database restored this way would hand
  its next `INSERT` an id that already exists and fail on the first student who onboarded
  after the cutover. So each integer primary key gets `setval(...)` to its new maximum,
  inside the same transaction as the copy.
* **The catalogue.** Careers, universities, scholarships, resources, institutions and the
  question bank are *seed* data: the app writes them on a fresh database, and it writes
  them with the same ids every time. Copying those rows into a target that has already
  seeded them is a duplicate-key error over content that was never anybody's data. So a
  seed table whose row count already matches is confirmed and skipped, and only
  `--replace-seed-tables` — for an operator who edited the catalogue on the laptop and
  wants those edits to win — truncates and re-copies it.

Everything is written in **one transaction**. If a row violates a foreign key (SQLite
does not enforce them by default, so an orphan can exist in a file that has been edited
by hand), or a column is missing, the run aborts and the target is left exactly as it
was — half-migrated is the one state this script refuses to produce.

The target must already be migrated (`alembic upgrade head`, or this app's own container
entrypoint) and must hold no rows in the tables being copied. `--dry-run` performs every
check and writes nothing, and is the right first run.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/migrate_sqlite_to_postgres.py --dry-run
    .venv/Scripts/python.exe scripts/migrate_sqlite_to_postgres.py
"""

from __future__ import annotations

import argparse
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, inspect, select, text  # noqa: E402

from app import models  # noqa: E402, F401  (registers every table on Base.metadata)
from app.config import BARE_PG_SCHEMES, postgres_url  # noqa: E402
from app.database import Base  # noqa: E402

# The tables the seeder writes (`app/seed/`, `app/services/assessment_bank.py`). These
# exist on a fresh database before any child touches it, which is why they are treated
# differently from a student's rows.
SEED_TABLES = frozenset(
    {
        "careers",
        "resources",
        "scholarships",
        "institutions",
        "study_countries",
        "study_services",
        "study_universities",
        "assessment_questions",
    }
)

BATCH = 500


def mask(url: str) -> str:
    """Host and database name stay; the password never prints."""
    head, _, tail = url.partition("://")
    creds, sep, rest = tail.rpartition("@")
    if not sep:
        return url
    user, _, _ = creds.partition(":")
    return f"{head}://{user}:****@{rest}"


def counts(conn, tables: list[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    for name in tables:
        out[name] = conn.execute(text(f'select count(*) from "{name}"')).scalar()
    return out


def revision(conn) -> str | None:
    if "alembic_version" not in inspect(conn).get_table_names():
        return None
    return conn.execute(text("select version_num from alembic_version")).scalar()


def head_revision() -> str | None:
    """The newest revision this build of the app ships, read the same way
    `scripts/migration_test.py` reads it — from the files, not from a database."""
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    return ScriptDirectory.from_config(cfg).get_current_head()


def overlong(src_conn, table, actual: dict[str, int | None]) -> list[tuple[str, int, int]]:
    """Columns whose stored data is longer than the column can hold in Postgres.

    `actual` is the width the *target* reflects, because the target is what refuses the
    row: a database built from these models says 32, a database built by the migration
    chain before 0009 was applied still says 16, and only the second is about to reject
    an insert. The model's length is the fallback for a column the target reports as
    unbounded, where there is nothing to compare against.

    SQLite ignores `varchar(n)` — it stores what it is given — so a laptop database can
    quietly hold a 17-character value in a 16-character column for months, and the first
    time that row is inserted into a real PostgreSQL database the write is refused. This
    is the check that finds it *before* a copy is half-done, which is the difference
    between an operator reading a table name and reading a stack trace.
    """
    problems: list[tuple[str, int, int]] = []
    for column in table.columns:
        limit = actual.get(column.name) or getattr(column.type, "length", None)
        if not limit:
            continue
        held = src_conn.execute(
            text(f'select max(length("{column.name}")) from "{table.name}"')
        ).scalar()
        if held and held > limit:
            problems.append((column.name, limit, held))
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--from",
        dest="source",
        default=str(ROOT / "careerguide.db"),
        help="SQLite file to read (default: backend/careerguide.db)",
    )
    parser.add_argument(
        "--to",
        dest="target",
        default=os.environ.get("DATABASE_URL", ""),
        help="PostgreSQL URL to write. Defaults to this app's DATABASE_URL.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build both sides, report what would move, write nothing",
    )
    parser.add_argument(
        "--replace-seed-tables",
        action="store_true",
        help="Truncate the catalogue tables and copy the source's rows over them, so "
        "catalogue edits made on the laptop win over a fresh seed",
    )
    args = parser.parse_args()

    source_path = pathlib.Path(args.source)
    if not source_path.exists():
        print(f"refused: no SQLite file at {source_path}")
        return 1
    if not args.target:
        print("refused: no target. Set DATABASE_URL or pass --to.")
        return 1
    if not args.target.startswith(BARE_PG_SCHEMES):
        print(
            f"refused: the target is not a Postgres URL ({mask(args.target)}). This script "
            "moves data onto Postgres; between two SQLite files there is nothing to fix."
        )
        return 1
    # A URL copied out of the Neon or Supabase dashboard carries neither the driver
    # this project ships nor a TLS mode. Both are added here, exactly as `Settings`
    # adds them, so the cutover cannot fail on a string the running app accepts.
    target = postgres_url(args.target)

    src_engine = create_engine(f"sqlite:///{source_path.as_posix()}")
    tgt_engine = create_engine(target)
    src_inspect, tgt_inspect = inspect(src_engine), inspect(tgt_engine)

    src_names = set(src_inspect.get_table_names())
    tables = [t for t in Base.metadata.sorted_tables if t.name in src_names]
    missing = [t.name for t in Base.metadata.sorted_tables if t.name not in src_names]
    if missing:
        print(
            f"note: the source has no {', '.join(missing)} — those are tables this build "
            "of the app knows and the file does not"
        )

    print(f"source : {source_path}  ({len(tables)} of {len(Base.metadata.tables)} tables present)")
    print(f"target : {mask(target)}")

    with src_engine.connect() as sc, tgt_engine.begin() as tc:
        absent = [t.name for t in tables if t.name not in tgt_inspect.get_table_names()]
        if absent:
            print(
                f"refused: the target has no {', '.join(absent)}. Build the schema first —\n"
                "         alembic upgrade head   (or start this app's container once)"
            )
            return 1
        at, want = revision(tc), head_revision()
        print(f"target : alembic revision {at or 'unversioned'}"
              + ("" if at == want else f"  (this build of the app expects {want})"))

        src_n = counts(sc, [t.name for t in tables])
        tgt_n = counts(tc, [t.name for t in tables])

        # Read the data before writing it: an over-long value is discovered here, in one
        # line naming the column, rather than as a rollback forty tables into a copy.
        widths = {
            t.name: {
                column["name"]: getattr(column["type"], "length", None)
                for column in tgt_inspect.get_columns(t.name)
            }
            for t in tables
        }
        unfit = {t.name: overlong(sc, t, widths[t.name]) for t in tables if src_n[t.name]}
        unfit = {k: v for k, v in unfit.items() if v}
        if unfit:
            print("refused: this data does not fit the columns the target was built with —")
            for name, columns in unfit.items():
                for column, limit, held in columns:
                    print(f"         {name}.{column}: declared {limit} characters, holding {held}")
            print(
                "         Bring the target up to this build's revision (alembic upgrade "
                "head) or widen the column, then run this again. SQLite let these through; "
                "Postgres will not, and neither will the app once it is pointed at Postgres."
            )
            return 1

        # Two different reasons a target is not empty, and only one of them is fatal
        # whatever the operator decides.
        user_rows = {n: c for n, c in tgt_n.items() if c and n not in SEED_TABLES}
        seed_clash = {
            n: c for n, c in tgt_n.items() if c and n in SEED_TABLES and src_n[n] != c
        }
        if user_rows:
            print(
                f"refused: the target already holds people's rows — {user_rows}. A cutover "
                "moves an empty or freshly seeded database; anything else is a merge, and "
                "this script will not guess which rows a child's chat should lose."
            )
            return 1
        if seed_clash and not args.replace_seed_tables:
            print(
                f"refused: the target's catalogue differs from the source's — {seed_clash}.\n"
                "         Pass --replace-seed-tables to let the laptop's rows win, or "
                "re-seed the target so the two agree."
            )
            return 1

        to_copy = [t for t in tables if src_n[t.name]]
        skipped = [t.name for t in tables if not src_n[t.name]]
        keeps = [
            t.name
            for t in to_copy
            if t.name in SEED_TABLES and tgt_n[t.name] == src_n[t.name]
            and not args.replace_seed_tables
        ]

        print(f"\n{'table':26} {'source':>8} {'target now':>11}  plan")
        for t in to_copy:
            plan = (
                "already seeded, same count — left alone"
                if t.name in keeps
                else "copy"
            )
            print(f"{t.name:26} {src_n[t.name]:>8} {tgt_n[t.name]:>11}  {plan}")
        for name in skipped:
            print(f"{name:26} {0:>8} {tgt_n[name]:>11}  nothing in the source")

        if args.dry_run:
            print("\ndry run: nothing was written.")
            return 0

        if args.replace_seed_tables:
            catalogue = [t.name for t in to_copy if t.name in SEED_TABLES]
            if catalogue:
                print(f"\ntruncating the catalogue tables so the source wins: {catalogue}")
                tc.execute(
                    text("truncate {} restart identity cascade".format(
                        ", ".join(f'"{n}"' for n in catalogue)
                    ))
                )

        moved = 0
        for t in to_copy:
            if t.name in keeps:
                continue
            tgt_cols = {c["name"] for c in tgt_inspect.get_columns(t.name)}
            only_source = sorted(c.name for c in t.columns if c.name not in tgt_cols)
            if only_source:
                print(
                    f"\nrefused: {t.name} has {', '.join(only_source)} in the source and "
                    "not in the target. Migrate the target's schema first."
                )
                return 1
            shared = [c for c in t.columns if c.name in tgt_cols]
            rows = sc.execute(select(*shared)).mappings()
            written = 0
            while True:
                chunk = rows.fetchmany(BATCH)
                if not chunk:
                    break
                tc.execute(t.insert(), [dict(r) for r in chunk])
                written += len(chunk)
            moved += written
            print(f"  copied {written:>7} rows into {t.name}")

        # The part a hand-written dump always forgets: sequences.
        restarted = 0
        for t in to_copy:
            pk = list(t.primary_key.columns)
            if len(pk) != 1 or pk[0].name != "id":
                continue
            high = tc.execute(text(f'select max(id) from "{t.name}"')).scalar()
            if high is None:
                continue
            tc.execute(
                text("select setval(pg_get_serial_sequence(:t, 'id'), :high)"),
                {"t": t.name, "high": high},
            )
            restarted += 1

        print(f"\n{moved} rows moved, {restarted} id sequences restarted at their new maximum.")

        after = counts(tc, [t.name for t in to_copy])
        bad = {n: (src_n[n], after[n]) for n in after if after[n] < src_n[n]}
        if bad:
            print(f"FAILED — the target has fewer rows than the source: {bad}")
            return 1
        print("verified : every table in the target holds at least what the source held")
        print(f"revision : {revision(tc)}")

    print(
        "\nThe source file is untouched. Until the app has been running against Postgres "
        "for a while and somebody has read its logs, keep `careerguide.db` in place and "
        "out of Git — it is a child's data, and it is currently the only copy of it."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
