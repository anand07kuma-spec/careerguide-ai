"""Prove the Alembic setup builds the schema the app's models describe.

The dangerous failure here is silent: `app/main.py` creates tables straight from the
models, while `alembic upgrade` runs SQL somebody wrote. If the two ever disagree, a
database built one way breaks the other, and on a deployment only Alembic can reach,
nobody notices until a query fails. So this suite builds the schema twice — once from
the revision chain, once from the models — and compares them table by table, column by
column.

Two states a real database is actually in, and both are tested:

* **Empty.** `upgrade head` has to build all forty tables from nothing. That is
  the job `0000_baseline_schema` exists for: before it, revision 0001 pointed its foreign
  keys at a `users` table it expected somebody else to have made, which is a precondition
  SQLite lets you violate and PostgreSQL refuses outright with `relation "users" does not
  exist`. So the deployment database — the one `docker-entrypoint.sh` and the hosted
  instance use — could not be built by the chain at all. Section 2b is that regression
  test, and it also checks the baseline stayed a *photograph* of 2026-10-17: a baseline
  "corrected" to today's models would make 0003, 0005, 0008, 0009, 0012 and 0013 fail on a
  fresh database by adding columns and widths that are already there.
* **Already running.** A database the app prepared before migrations existed, holding a
  child's account, gets `db_init.py` then `alembic stamp`. Section 3 widens that one and
  insists the row survives, because a migration that rebuilds a table instead of widening
  it silently empties an account.

It also runs `--sql`, the offline mode, which is how the diff is read before any real
database is touched — the baseline in particular has to stay pure DDL or that mode breaks
— and a full `downgrade`, because a migration that cannot be undone is not reviewable.

Never touches `careerguide.db`: eight throwaway databases in the temp directory. To read
the PostgreSQL DDL without a server:

    alembic upgrade head --sql

Run from `backend/`:

    .venv/Scripts/python.exe scripts/migration_test.py
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import pathlib
import secrets
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import _console  # noqa: E402,F401 -- utf-8 stdout, see _console.py

MIGRATED = pathlib.Path(tempfile.gettempdir()) / "careerguide_migration_test.db"
FROM_MODELS = pathlib.Path(tempfile.gettempdir()) / "careerguide_models_ref.db"
EMPTY = pathlib.Path(tempfile.gettempdir()) / "careerguide_empty_build_test.db"
for path in (MIGRATED, FROM_MODELS, EMPTY):
    if path.exists():
        path.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{MIGRATED.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from alembic.script import ScriptDirectory  # noqa: E402
from sqlalchemy import create_engine, inspect, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app import models  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.database import Base  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402
from app.security import device_hash_of, token_hash_of  # noqa: E402
from app.schema_sync import add_missing_columns  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    print(f"  [{'PASS' if condition else 'FAIL'}] {label}")
    if not condition and detail:
        print(f"        {detail}")


TABLES = [
    "assessments",
    "assessment_questions",
    "assessment_responses",
    "assessment_results",
    "report_pdfs",
    "subscriptions",
    "payments",
    "email_jobs",
    "study_countries",
    "study_universities",
    "study_services",
    "study_leads",
    "study_stories",
    # In dependency order: a branding row, a membership and a note all point back up.
    "organizations",
    "organization_branding",
    "memberships",
    "session_notes",
    # Dependency order again: an exam points at the door it belongs to.
    "exam_groups",
    "exams",
    # Its primary key is the account, so `users` has to exist before it can.
    "resumes",
    # Points at `users` and must survive its deletion, so it is last.
    "audit_events",
]
# The tables `0000_baseline_schema` creates: everything the app shipped before the
# revision chain started. Listed here rather than derived from the models, so a new table
# silently appearing in only one of the two places is something this suite notices.
BASELINE_TABLES = [
    "users",
    "auth_tokens",
    "student_profiles",
    "guardianships",
    "consent_records",
    "user_settings",
    "conversation_sessions",
    "messages",
    "interest_observations",
    "careers",
    "saved_careers",
    "recommendations",
    "study_plans",
    "study_plan_items",
    "journey_events",
    "career_reports",
    "resources",
    "scholarships",
    "institutions",
]
ALL_TABLES = [*BASELINE_TABLES, *TABLES]
# The eight columns that arrive on `users` later, and the three indexes that arrive with
# them. A baseline that already contains them is a baseline that cannot be upgraded.
ADDED_LATER = (
    "clerk_user_id",
    "clerk_linked_at",
    "contact_email",
    "email_confirm_hash",
    "email_confirm_expires_at",
    "email_confirmed_at",
    "is_admin",
    "erased_at",
)
BASELINE = "0000_baseline_schema"
FIRST = "0001_assessment_tables"
SECOND = "0002_report_pdfs"
THIRD = "0003_clerk_link"
FOURTH = "0004_payments_tables"
FIFTH = "0005_email_outbox"
SIXTH = "0006_study_abroad"
SEVENTH = "0007_tenancy"
EIGHTH = "0008_admin_audit"
NINTH = "0009_observation_source_width"
TENTH = "0010_hashed_device_and_token"
ELEVENTH = "0011_exams"
TWELFTH = "0012_user_erasure"
THIRTEENTH = "0013_student_age"
FOURTEENTH = "0014_resume"
FIFTEENTH = "0015_result_roadmap"
HEAD = "0016_career_source"
URL = os.environ["DATABASE_URL"]
EMPTY_URL = f"sqlite:///{EMPTY.as_posix()}"


def alembic_config() -> Config:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    return cfg


def shape(url: str, tables: list[str] | None = None) -> dict:
    """Everything a hand-written migration and a model can disagree about.

    Columns are compared by name, not by position: on a database built from the chain, a
    column that `0005` added sits after the ones the baseline created, while the model
    declares it among them. Same column, same type, same nullability — a different order,
    which is not something a query can notice.
    """
    engine = create_engine(url)
    insp = inspect(engine)
    out: dict[str, dict] = {}
    for table in tables or ALL_TABLES:
        if table not in insp.get_table_names():
            out[table] = {"missing": True}
            continue
        out[table] = {
            "columns": {
                column["name"]: (str(column["type"]), column["nullable"])
                for column in insp.get_columns(table)
            },
            "pk": sorted(insp.get_pk_constraint(table)["constrained_columns"]),
            "fks": sorted(
                (
                    foreign["constrained_columns"][0],
                    foreign["referred_table"],
                    foreign["referred_columns"][0],
                    foreign.get("options", {}).get("ondelete"),
                )
                for foreign in insp.get_foreign_keys(table)
            ),
            "uniques": sorted(
                (unique["name"] or "", tuple(unique["column_names"]))
                for unique in insp.get_unique_constraints(table)
            ),
            "indexes": sorted(
                (index["name"], tuple(index["column_names"]), index["unique"])
                for index in insp.get_indexes(table)
                if not index["name"].startswith("sqlite_autoindex")
            ),
        }
    engine.dispose()
    return out


def tables_in(url: str) -> list[str]:
    engine = create_engine(url)
    names = inspect(engine).get_table_names()
    engine.dispose()
    return names


cfg = alembic_config()

print("\n=== 1. the revision graph")
script = ScriptDirectory.from_config(cfg)
walked = list(script.walk_revisions())
check("seventeen revisions are on file", len(walked) == 17, [revision.revision for revision in walked])
check("the newest is the one the file declares",
      walked[0].revision == HEAD, walked[0].revision)
check("it is the head", script.get_current_head() == HEAD, script.get_current_head())
# The newest revision widens two tables the baseline made, so it has to sit on the plan column
# rather than beside it, and every pair below is the chain that was already there. It is walked
# as a list rather than written out as sixteen indexed checks, because adding a revision used to
# mean renumbering every line under it — which is a change no reviewer would notice getting wrong.
# Section 9 is the one that proves a device account and a live session both survive 0010,
# wherever in the chain it now sits.
CHAIN: list[tuple[str, str, str]] = [
    (HEAD, FIFTEENTH, "the source columns build on the plan column rather than replacing it"),
    (FIFTEENTH, FOURTEENTH,
     "…and the plan column builds on the resume table rather than replacing it"),
    (FOURTEENTH, THIRTEENTH,
     "…and the resume table builds on the stated age rather than replacing it"),
    (THIRTEENTH, TWELFTH,
     "…and the stated age builds on the erasure date rather than replacing it"),
    (TWELFTH, ELEVENTH,
     "…and the erasure date builds on the exam catalogue rather than replacing it"),
    (ELEVENTH, TENTH,
     "…and the exam catalogue builds on the digested credentials rather than replacing them"),
    (TENTH, NINTH,
     "…and the digested credentials build on the widened column rather than replacing it"),
    (NINTH, EIGHTH,
     "…and the widened column builds on the operator log rather than replacing it"),
    (EIGHTH, SEVENTH,
     "…and the operator log builds on the tenancy tables rather than replacing them"),
    (SEVENTH, SIXTH,
     "…and the tenancy tables build on the study-abroad directory rather than replacing it"),
    (SIXTH, FIFTH, "…and the study-abroad tables build on the email outbox"),
    (FIFTH, FOURTH, "…and the outbox builds on the payments revision"),
    (FOURTH, THIRD, "…and payments builds on the email-sign-in revision"),
    (THIRD, SECOND, "…and that one builds on the report revision"),
    (SECOND, FIRST, "…and that one on the assessment revision"),
    # The bottom of the chain, and the reason the sixteen above it can point at `users` at all.
    (FIRST, BASELINE,
     "…and the assessment revision builds on the baseline rather than replacing it"),
]
for _step, (_revision, _below, _label) in enumerate(CHAIN):
    check(_label,
          walked[_step].revision == _revision and walked[_step].down_revision == _below,
          [walked[_step].revision, walked[_step].down_revision])
check("the baseline has nothing before it, so a fresh database can be built from nothing",
      walked[-1].revision == BASELINE and walked[-1].down_revision is None,
      [walked[-1].revision, walked[-1].down_revision])
# A baseline is only usable if it really is the bottom and only if it covers the tables
# the revisions above it assume already exist.
check("…and it is exactly one revision, not a second root the chain would fork over",
      sum(1 for revision in walked if revision.down_revision is None) == 1,
      [revision.revision for revision in walked if revision.down_revision is None])
check("…and it claims nineteen tables, which with the twenty-one the later revisions add "
      "is the whole application",
      len(ALL_TABLES) == len(set(ALL_TABLES)) == len(BASELINE_TABLES) + len(TABLES) == 40,
      [len(BASELINE_TABLES), len(TABLES)])

print("\n=== 2. offline mode prints the SQL, which is the diff to read")
stream = io.StringIO()
error: Exception | None = None
try:
    with contextlib.redirect_stdout(stream):
        command.upgrade(cfg, "head", sql=True)
except Exception as caught:  # noqa: BLE001 - reported as a failed check
    error = caught
printed = stream.getvalue()
check("alembic upgrade head --sql runs", error is None, repr(error))
check("…and emits forty-one CREATE TABLEs: the forty app tables plus its own "
      "version table",
      printed.count("CREATE TABLE") == 41, printed.count("CREATE TABLE"))
check("…naming all of them", all(f"CREATE TABLE {table}" in printed for table in ALL_TABLES),
      [table for table in ALL_TABLES if f"CREATE TABLE {table}" not in printed])
check("…starting with `users`, which is the table whose absence used to make this chain "
      "unbuildable on PostgreSQL",
      printed.index("CREATE TABLE users") < printed.index("CREATE TABLE assessments"),
      printed[:200])
# 0013's guard only consults the database when there is one to consult, so the offline diff
# still shows the column being added — which is the copy a reviewer reads before running it.
check("…and the stated age as a one-column ALTER on the table the baseline made",
      "ADD COLUMN age" in printed, [line for line in printed.splitlines()
                                    if "student_profiles" in line][:4])
# 0015 has the same guard for the same reason, so a reviewer of the offline diff sees the
# plan column being added even though a live database may already have had it since boot.
# `assessment_results` is 0001's table rather than the baseline's, so the ordering is the
# check here: the table is created without the column and widened later, which is what keeps
# a database that stopped at 0001 upgradeable.
check("…and the plan column as a one-column ALTER on the result table the first revision made",
      "ADD COLUMN roadmap_json" in printed,
      [line for line in printed.splitlines() if "assessment_results" in line][:4])
created_results = printed.split("CREATE TABLE assessment_results", 1)[1].split(";", 1)[0] \
    if "CREATE TABLE assessment_results" in printed else ""
check("…which the create statement itself does not carry, because the column is 0015's",
      "roadmap_json" not in created_results and created_results != "",
      created_results[:200])
# 0016 is the same shape again — nullable columns on tables the chain already made — so the
# reviewer of this diff sees them arrive as three separate ALTERs, and sees that the statement
# which created `careers` does not contain them. That ordering is the point: a database that
# stopped at any earlier revision can still be widened to today's.
check("…and the source columns as three one-column ALTERs, two pages and one date",
      printed.count("ADD COLUMN source_url") == 2
      and printed.count("ADD COLUMN verified_at") == 1,
      [line.strip() for line in printed.splitlines()
       if "ADD COLUMN" in line and ("source_url" in line or "verified_at" in line)])
created_careers = printed.split("CREATE TABLE careers", 1)[1].split(";", 1)[0] \
    if "CREATE TABLE careers" in printed else ""
check("…which the careers create statement does not carry, because they are 0016's",
      "source_url" not in created_careers and "verified_at" not in created_careers
      and created_careers != "",
      created_careers[:200])
# The baseline is the one revision that must never grow a query: offline mode cannot run
# Python that connects, so a `SELECT` in it would break `--sql` for the whole chain.
check("…which is possible because the baseline is pure DDL, with no data step in it",
      "SELECT" not in printed.upper().replace("SELECT version_num", ""), printed[:200])
check("…without connecting, so nothing was applied", not MIGRATED.exists(), str(MIGRATED))

print("\n=== 2b. an empty database: `upgrade head` now builds the whole schema")
# The failure this section exists for: on an empty PostgreSQL, `upgrade head` used to die
# in 0001 with `relation "users" does not exist`, because that revision points a foreign
# key at a table the app made with `create_all` and no revision created. So the deployment
# database — the one the container entrypoint and every hosted instance use — could not be
# brought up by the chain at all. Building it here, twice, also proves the baseline is a
# photograph of 2026-10-17 rather than a mirror of today's models: step it to 0000 and the
# eight late `users` columns must be missing, `student_profiles` must have no typed age and
# `interest_observations.source` must be 16 characters, because 0003/0005/0008/0012 add the
# columns, 0013 adds the age and 0009 widens the source. A baseline "fixed" to match the
# models makes all six of those revisions fail on a fresh database.
os.environ["DATABASE_URL"] = EMPTY_URL
get_settings.cache_clear()
command.upgrade(cfg, BASELINE)
engine = create_engine(EMPTY_URL)
at_baseline = inspect(engine).get_table_names()
check("the baseline on its own creates nineteen tables",
      all(table in at_baseline for table in BASELINE_TABLES), at_baseline)
check("…and none of the twenty the later revisions own",
      not any(table in at_baseline for table in TABLES),
      [table for table in at_baseline if table in TABLES])
baseline_users = {column["name"] for column in inspect(engine).get_columns("users")}
check("…leaving `users` as it stood that day: no email sign-in, contact address or admin "
      "flag yet",
      not (set(ADDED_LATER) & baseline_users), sorted(baseline_users & set(ADDED_LATER)))
check("…and not creating the indexes that arrive with those columns, because 0003 and "
      "0005 would then fail on a fresh database",
      not any(
          index["name"] in {"ix_users_clerk_user_id", "ix_users_contact_email",
                            "ix_users_email_confirm_hash"}
          for index in inspect(engine).get_indexes("users")
      ),
      inspect(engine).get_indexes("users"))
width_at_baseline = next(
    getattr(column["type"], "length", None)
    for column in inspect(engine).get_columns("interest_observations")
    if column["name"] == "source"
)
check("…with `interest_observations.source` still 16 characters, which 0009 widens",
      width_at_baseline == 16, width_at_baseline)
baseline_profiles = {column["name"] for column in inspect(engine).get_columns("student_profiles")}
check("…and `student_profiles` holding no typed age, because that is 0013's to add",
      "age" not in baseline_profiles, sorted(baseline_profiles))

command.upgrade(cfg, "head")
check("and the rest of the chain runs over that baseline without a collision",
      engine.connect().execute(text("select version_num from alembic_version")).scalar()
      == HEAD,
      engine.connect().execute(text("select version_num from alembic_version")).scalar())
check("…reaching all forty tables", all(table in inspect(engine).get_table_names()
                                               for table in ALL_TABLES),
      inspect(engine).get_table_names())
check("…and nothing beyond them and its own version table",
      sorted(inspect(engine).get_table_names()) == sorted([*ALL_TABLES, "alembic_version"]),
      inspect(engine).get_table_names())
width_at_head = next(
    getattr(column["type"], "length", None)
    for column in inspect(engine).get_columns("interest_observations")
    if column["name"] == "source"
)
check("…with the column it set out to widen actually widened to 32",
      width_at_head == 32, width_at_head)
check("…and the eight columns that belong to later revisions present on the fresh build "
      "too, so both paths land on the same schema",
      set(ADDED_LATER) <= {column["name"] for column in inspect(engine).get_columns("users")},
      sorted(column["name"] for column in inspect(engine).get_columns("users")))
head_profiles = {column["name"]: column
                 for column in inspect(engine).get_columns("student_profiles")}
check("…and the typed age 0013 adds, nullable so a student who has never stated one is "
      "not asked for it on a fresh build either",
      "age" in head_profiles and head_profiles["age"]["nullable"],
      sorted(head_profiles))
engine.dispose()

print("\n=== 3. a database that has been running since before the chain started")
# The other state a deployment arrives in: the app created the tables itself on first
# boot, years of answers are already in them, and no `alembic_version` table exists. This
# is the shape `create_all` left behind on 2026-10-17 — section 4 proves the baseline is
# identical to it — so building that state with the baseline and then running the chain
# over it reproduces the deployment without hand-writing DDL that could drift from both.
os.environ["DATABASE_URL"] = URL
get_settings.cache_clear()
seed = create_engine(URL)
command.upgrade(cfg, BASELINE)
with seed.begin() as conn:
    conn.execute(
        text("insert into users (id, role, display_name, preferred_language, is_active, "
             "created_at) values (1, 'student', 'Asha', 'en', 1, '2026-10-16 09:00:00')")
    )
    # The student's own answers, in the shape this app shipped with: a band chosen from a
    # list rather than an age typed in. 0013 adds a column to this table and 6 undoes it,
    # so there has to be a row here for the undo to be judged against.
    conn.execute(
        text("insert into student_profiles (user_id, class_level, age_range, interest_areas, "
             "created_at) values (1, 'class-9', '11-12', '[]', '2026-10-16 09:00:00')")
    )
before = {column["name"] for column in inspect(seed).get_columns("users")}
check("it has no email-sign-in columns yet", "clerk_user_id" not in before, sorted(before))
check("…and no contact-address columns either",
      not ({"contact_email", "email_confirm_hash", "email_confirmed_at"} & before),
      sorted(before))
check("…and no admin flag, so nobody already in the table runs the site",
      "is_admin" not in before, sorted(before))
check("…and one account is already in it",
      seed.connect().execute(text("select count(*) from users")).scalar() == 1)
seed.dispose()

print("\n=== 3b. upgrade head runs over a running database without disturbing it")
get_settings.cache_clear()
command.upgrade(cfg, "head")
check("all twenty tables the later revisions own are there, beside the nineteen the "
      "baseline brought",
      all(table in tables_in(URL) for table in ALL_TABLES), tables_in(URL))
engine = create_engine(URL)
check("alembic_version records the revision",
      "alembic_version" in inspect(engine).get_table_names())
check(f"…at {HEAD}",
      engine.connect().execute(text("select version_num from alembic_version")).scalar()
      == HEAD)
check("it created nothing else", sorted(tables_in(URL)) == sorted([*ALL_TABLES, "alembic_version"]),
      tables_in(URL))
# 0013 is the newest instance of the same demand, on a different table: a nullable column
# onto a profile that somebody has already filled in.
profile_at_head = {column["name"]: column
                   for column in inspect(engine).get_columns("student_profiles")}
check("the typed age arrives on the profile table that already holds a student's answers",
      "age" in profile_at_head and profile_at_head["age"]["nullable"],
      sorted(profile_at_head))
check("…reading back as NULL for the student whose profile was already there, so the band "
      "they chose before this existed is still the only age the app can see",
      engine.connect().execute(
          text("select user_id, class_level, age_range, age from student_profiles")
      ).all() == [(1, "class-9", "11-12", None)],
      engine.connect().execute(text("select * from student_profiles")).all())
# The point of section 3: this chain had to widen a table that already existed and
# already held a child's account.
after = {column["name"]: column for column in inspect(engine).get_columns("users")}
check("the email sign-in columns were added to the existing users table",
      {"clerk_user_id", "clerk_linked_at"} <= set(after), sorted(after))
check("…both nullable, so every account that predates them is untouched",
      all(after[name]["nullable"] for name in ("clerk_user_id", "clerk_linked_at")),
      {name: after[name]["nullable"] for name in ("clerk_user_id", "clerk_linked_at")})
check("…and the row that was already there survived the widening",
      engine.connect().execute(
          text("select display_name, clerk_user_id from users where id = 1")
      ).all() == [("Asha", None)],
      engine.connect().execute(text("select * from users")).all())
check("one email cannot open two accounts, because the index is unique",
      any(
          index["name"] == "ix_users_clerk_user_id" and index["unique"]
          for index in inspect(engine).get_indexes("users")
      ),
      inspect(engine).get_indexes("users"))

# The same widening, one revision later, for the optional contact address. Both halves
# matter: the columns have to arrive on a table that already holds rows, and every one
# of them has to be nullable, because an account that wants no mail at all is the
# common case rather than an edge case.
ADDRESS_COLUMNS = (
    "contact_email",
    "email_confirm_hash",
    "email_confirm_expires_at",
    "email_confirmed_at",
)
check("the four contact-address columns were added to that same existing users table",
      set(ADDRESS_COLUMNS) <= set(after), sorted(after))
check("…every one of them nullable, so no account is asked for an address",
      all(after[name]["nullable"] for name in ADDRESS_COLUMNS),
      {name: after[name]["nullable"] for name in ADDRESS_COLUMNS})
check("…and one address still cannot belong to two accounts",
      any(
          index["name"] == "ix_users_contact_email" and index["unique"]
          for index in inspect(engine).get_indexes("users")
      ),
      inspect(engine).get_indexes("users"))
check("…and a confirmation link is found by its hash, so that column is indexed",
      any(
          index["name"] == "ix_users_email_confirm_hash"
          for index in inspect(engine).get_indexes("users")
      ),
      inspect(engine).get_indexes("users"))

# The admin flag is the newest thing attached to this table, and it is the one that
# has a reason to be shaped this way: a NOT NULL column cannot go onto a table holding
# real people's rows, and `schema_sync.add_missing_columns` only ever adds nullable
# ones. So the column arrives reading as NULL — which has to mean "not an admin", or
# widening a database would hand the admin screens to whoever signed up first.
check("the admin flag arrived on that same existing table",
      "is_admin" in after, sorted(after))
check("…nullable, because it is attached to rows that already exist",
      after.get("is_admin", {}).get("nullable"), str(after.get("is_admin")))
check("…and the account that predates it reads as not an admin",
      engine.connect().execute(text("select is_admin from users where id = 1")).scalar() is None)
engine.dispose()

print("\n=== 4. every table the chain builds matches the table the models build")
reference = create_engine(f"sqlite:///{FROM_MODELS.as_posix()}")
# All forty at once: `create_all` puts them in dependency order for the same
# reason the baseline lists them in one, and this is the database the app would have made
# on a laptop with no migrations in sight.
Base.metadata.create_all(reference)
reference.dispose()

built_from_models = shape(f"sqlite:///{FROM_MODELS.as_posix()}")
# Two chains, one destination. A database from nothing (section 2b) and a database that
# was already running when the chain arrived (section 3) are the only two states a
# deployment is ever in, and a model can disagree with either of them alone.
built_by_migration = shape(URL)
built_from_empty = shape(EMPTY_URL)
for table in ALL_TABLES:
    check(f"{table}: the chain from an empty database, the chain over a running one and "
          "the models all describe the same table",
          built_from_empty[table] == built_by_migration[table] == built_from_models[table],
          f"empty ={built_from_empty[table]}\n"
          f"      upgraded={built_by_migration[table]}\n"
          f"      models   ={built_from_models[table]}")

print("\n=== 4b. the application's own writes work against the database the chain built")
# Reflection can agree with the models and still leave an app that cannot start: a column
# the ORM calls by a different name, a JSON variant the driver refuses, a NOT NULL the
# route never fills. So run the app's real first boot against the database built from
# nothing in section 2b — `seed_if_empty` is the same call `scripts/db_init.py` and the
# container entrypoint make — and then ask the question the API asks on every page.
os.environ["DATABASE_URL"] = EMPTY_URL
get_settings.cache_clear()
engine = create_engine(EMPTY_URL)
with Session(engine) as session:
    counts = seed_if_empty(session)
check("the catalogue seeds through the models into the chain-built tables",
      bool(counts) and counts.get("careers"), counts)
with Session(engine) as again:
    second = seed_if_empty(again)
check("…and a second run seeds nothing, because the guard is a row count rather than a "
      "sentinel file",
      not second, second)
careers = engine.connect().execute(text("select count(*) from careers")).scalar()
check("…with careers readable the way a page reads them, through the JSON columns",
      careers > 0 and engine.connect().execute(
          text("select title, typical_activities from careers order by id limit 1")
      ).scalar() is not None, careers)
engine.dispose()
os.environ["DATABASE_URL"] = URL
get_settings.cache_clear()

print("\n=== 5. the tables hold what the app writes into them")
engine = create_engine(URL)
# `users` was made in 2b, the way a real database already has it, and one student is
# already in there. The migration's own scope is the questionnaire tables and the
# stored report, so the rows below are what the application writes.
with engine.begin() as conn:
    conn.execute(
        text("insert into assessments (id, user_id, assessment_type, language, bank_version, "
             "started_at, status, created_at) values "
             "(1, 1, 'interest', 'en', '1', '2026-10-17 10:00:00', 'in_progress', '2026-10-17 10:00:00')")
    )
    conn.execute(
        # `order` is a reserved word: quoted here exactly as the app quotes it.
        text('insert into assessment_questions (id, assessment_type, code, dimension, "order", '
             'response_type, keyed, text_en, text_hi, options_json, created_at) values '
             "(1, 'interest', 'R1', 'R', 1, 'likert', '+', 'x', 'x', '[]', '2026-10-17 10:00:00')")
    )
    conn.execute(
        text("insert into assessment_responses (id, assessment_id, code, question_id, value, created_at) "
             "values (1, 1, 'R1', 1, '5', '2026-10-17 10:00:00')")
    )
    conn.execute(
        text("insert into assessment_results (id, assessment_id, user_id, assessment_type, "
             "score_json, traits_json, detail_json, completed_at, created_at) values "
             "(1, 1, 1, 'interest', '{}', '[]', '{}', '2026-10-17 10:05:00', '2026-10-17 10:05:00')")
    )
    # The PDF as a BLOB parameter rather than a hex literal, because that is how the
    # app writes it and how PostgreSQL will receive it.
    conn.execute(
        text("insert into report_pdfs (id, student_id, anchor_result_id, language, filename, "
             "result_ids, pdf_bytes, size_bytes, generated_at, is_deleted, created_at) values "
             "(1, 1, 1, 'en', 'careerguide-interest-report-1.pdf', '[1]', :pdf, 3, "
             "'2026-10-17 10:10:00', 0, '2026-10-17 10:10:00')"),
        {"pdf": b"%PDF"},
    )
    # The money tables the newest revision adds, written the way the app writes them:
    # one plan row keyed by the account itself, and one order per payment.
    conn.execute(
        text("insert into subscriptions (user_id, plan_code, source, interval, started_at, "
             "expires_at, changed_at, created_at) values "
             "(1, 'pro_monthly', 'payment', 'monthly', '2026-10-18 09:00:00', "
             "'2026-11-17 09:00:00', '2026-10-18 09:00:00', '2026-10-18 09:00:00')")
    )
    conn.execute(
        text("insert into payments (user_id, provider, order_id, payment_id, plan_code, interval, "
             "amount_paise, currency, status, receipt, captured_at, adult_attested, test_mode, created_at) "
             "values (1, 'razorpay', 'order_MigrationTest1', 'pay_MigrationTest1', 'pro_monthly', "
             "'monthly', 29900, 'INR', 'captured', 'cg20261018-u1-pro_monthly', "
             "'2026-10-18 09:00:00', 1, 1, '2026-10-18 09:00:00')")
    )
check("a sitting, an item, an answer and a result all insert",
      engine.connect().execute(text("select count(*) from assessment_results")).scalar() == 1)
with engine.connect() as conn:
    stored = conn.execute(
        text("select pdf_bytes, size_bytes, result_ids from report_pdfs where id = 1")
    ).first()
check("…and a generated PDF round-trips as bytes, not as text",
      stored is not None and bytes(stored[0]) == b"%PDF" and stored[1] == 3, stored)

with engine.connect() as conn:
    money = conn.execute(
        text("select s.plan_code, s.source, p.amount_paise, p.status, p.test_mode "
             "from subscriptions s join payments p on p.user_id = s.user_id where s.user_id = 1")
    ).first()
check("one account holds one plan row, and its order joins to it",
      money is not None and money[0] == "pro_monthly" and money[1] == "payment"
      and money[2] == 29_900 and money[3] == "captured" and bool(money[4]), money)
check("a price survives as a whole number of paise, not as a rounded decimal",
      money is not None and money[2] == 29_900, money)
check("whether a plan is still running is a date, not a stored status flag",
      "status" not in {column["name"] for column in inspect(engine).get_columns("subscriptions")},
      [column["name"] for column in inspect(engine).get_columns("subscriptions")])

# Both rules below are the ones a race would break, so they live in the schema rather
# than only in the router: one order cannot be recorded twice, and one account cannot
# hold two plans.
duplicate_order = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into payments (user_id, provider, order_id, plan_code, interval, amount_paise, "
                 "currency, status, receipt, adult_attested, test_mode, created_at) values "
                 "(1, 'razorpay', 'order_MigrationTest1', 'pro_monthly', 'monthly', 29900, 'INR', "
                 "'created', 'cg-duplicate-order', 1, 1, '2026-10-18 09:01:00')")
        )
except Exception as caught:  # noqa: BLE001 - asserting the constraint fired
    duplicate_order = type(caught).__name__
check("the same order cannot be written twice, so it cannot be paid for twice",
      duplicate_order is not None, duplicate_order)

second_plan = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into subscriptions (user_id, plan_code, source, changed_at, created_at) values "
                 "(1, 'pro_yearly', 'payment', '2026-10-18 09:02:00', '2026-10-18 09:02:00')")
        )
except Exception as caught:  # noqa: BLE001
    second_plan = type(caught).__name__
check("one account cannot be on two plans at once", second_plan is not None, second_plan)

# A fresh order has no payment id yet. Many NULLs in a unique index is the normal state
# of a checkout somebody abandoned, so it must be allowed on both engines.
with engine.begin() as conn:
    conn.execute(
        text("insert into payments (user_id, provider, order_id, plan_code, interval, amount_paise, "
             "currency, status, receipt, adult_attested, test_mode, created_at) values "
             "(1, 'razorpay', 'order_UncapturedOne', 'pro_yearly', 'yearly', 249900, 'INR', "
             "'created', 'cg-uncaptured-one', 1, 1, '2026-10-18 09:03:00')")
    )
    unpaid = conn.execute(
        text("select count(*) from payments where payment_id is null and status = 'created'")
    ).scalar()
check("an unpaid order is allowed to exist with no payment id", unpaid == 1, unpaid)

refused = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into assessment_responses (assessment_id, code, value, created_at) "
                 "values (1, 'R1', '4', '2026-10-17 10:06:00')")
        )
except Exception as caught:  # noqa: BLE001 - asserting the constraint fired
    refused = type(caught).__name__
check("answering the same item twice is refused by the database", refused is not None, refused)

# ------------------------------------------------------------- the outbox
#
# The email queue is the one table in this chain whose whole job is to be written
# twice by accident — a double-tapped submit, a webhook and a callback for the same
# payment, two requests that both noticed the week had ended. So the rule being tested
# here is not a convenience: it is the reason a family is never mailed the same
# receipt twice, and it has to hold in the schema rather than only in the service.
with engine.begin() as conn:
    conn.execute(
        text("insert into email_jobs (user_id, purpose, ref_id, status, attempts, "
             "next_attempt_at, created_at) values "
             "(1, 'email_result', 1, 'pending', 0, '2026-10-18 09:30:00', '2026-10-18 09:30:00')")
    )
    queued = conn.execute(
        text("select count(*) from email_jobs where user_id = 1 and purpose = 'email_result'")
    ).scalar()
check("a message waiting to be sent is one row", queued == 1, queued)

job_columns = {column["name"] for column in inspect(engine).get_columns("email_jobs")}
check("…which is a pointer, not a copy: nothing in it can hold an address or a message",
      not any(word in name for name in job_columns
              for word in ("address", "email_to", "body", "subject", "html")),
      sorted(job_columns))

duplicate_job = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into email_jobs (user_id, purpose, ref_id, status, attempts, "
                 "next_attempt_at, created_at) values "
                 "(1, 'email_result', 1, 'pending', 0, '2026-10-18 09:31:00', '2026-10-18 09:31:00')")
        )
except Exception as caught:  # noqa: BLE001 - asserting the index fired
    duplicate_job = type(caught).__name__
check("the same result cannot be queued twice, so a second tap sends nothing",
      duplicate_job is not None, duplicate_job)

with engine.begin() as conn:
    conn.execute(
        text("insert into email_jobs (user_id, purpose, ref_key, status, attempts, "
             "next_attempt_at, created_at) values "
             "(1, 'email_digest', '2026-10-05', 'pending', 0, '2026-10-18 09:32:00', '2026-10-18 09:32:00'),"
             "(1, 'email_digest', '2026-10-12', 'pending', 0, '2026-10-18 09:32:00', '2026-10-18 09:32:00')")
    )
    weeks = conn.execute(
        text("select count(*) from email_jobs where purpose = 'email_digest'")
    ).scalar()
check("two different weeks for the same account are two rows", weeks == 2, weeks)

same_week = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into email_jobs (user_id, purpose, ref_key, status, attempts, "
                 "next_attempt_at, created_at) values "
                 "(1, 'email_digest', '2026-10-12', 'pending', 0, "
                 "'2026-10-18 09:33:00', '2026-10-18 09:33:00')")
        )
except Exception as caught:  # noqa: BLE001
    same_week = type(caught).__name__
check("…and the same week twice is the refusal that stops a second summary today",
      same_week is not None, same_week)

with engine.begin() as conn:
    conn.execute(
        text("insert into email_jobs (user_id, purpose, ref_id, ref_key, status, attempts, "
             "next_attempt_at, created_at) values "
             "(1, 'receipt', 1, null, 'pending', 0, '2026-10-18 09:34:00', '2026-10-18 09:34:00')")
    )
    receipts = conn.execute(
        text("select count(*) from email_jobs where purpose = 'receipt'")
    ).scalar()
check("a payment's receipt is queued against the payment row, not against a copy of the money",
      receipts == 1, receipts)

second_receipt = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into email_jobs (user_id, purpose, ref_id, ref_key, status, attempts, "
                 "next_attempt_at, created_at) values "
                 "(1, 'receipt', 1, null, 'pending', 0, '2026-10-18 09:35:00', '2026-10-18 09:35:00')")
        )
except Exception as caught:  # noqa: BLE001
    second_receipt = type(caught).__name__
check("one payment cannot be queued twice, so the callback and the webhook send one receipt",
      second_receipt is not None, second_receipt)

# The known gap, stated rather than hidden: a unique index over columns that are all
# NULL lets any number of rows through, on both engines, because NULL never equals
# NULL. A message about the account alone — no order, no result, no week — has empty
# pointer columns, so the index cannot be what keeps it single. `email_jobs.enqueue`
# looks for the row before writing it, and this check records why that is not
# redundant belt-and-braces but the only guard that exists for those rows.
with engine.begin() as conn:
    conn.execute(
        text("insert into email_jobs (user_id, purpose, status, attempts, next_attempt_at, created_at) "
             "values (1, 'welcome', 'pending', 0, '2026-10-18 09:36:00', '2026-10-18 09:36:00'),"
             "(1, 'welcome', 'pending', 0, '2026-10-18 09:36:00', '2026-10-18 09:36:00')")
    )
    welcomes = conn.execute(
        text("select count(*) from email_jobs where purpose = 'welcome'")
    ).scalar()
check("a row with nothing in its pointer columns is NOT stopped by the index, which is "
      "why the service checks before it writes",
      welcomes == 2, welcomes)

# ------------------------------------------------------------ study abroad
#
# The rule this section tests is the one the whole feature is built on: a fact about a
# university is stored with the page it came from and the day somebody read it, or it
# is not stored at all. That is a schema property before it is a page property — if a
# NULL fee could not be written, the seed would have to carry a number, and a number
# nobody checked is the thing a family ends up budgeting against.
with engine.begin() as conn:
    # The JSON columns are bound as text the way the driver would receive them: a raw
    # list cannot be bound to a `text()` statement, because a text statement carries no
    # column types for SQLAlchemy to serialise with.
    conn.execute(
        text("insert into study_countries (slug, name, code, overview, to_check, "
             "visa_portal_url, visa_portal_label, is_active, sort_order, created_at) values "
             "('united-states', 'United States', 'US', 'A very large country.', :to_check, "
             "'https://studyinthestates.dhs.gov/', 'Study in the States (official)', "
             "1, 1, '2026-10-18 10:00:00')"),
        {"to_check": json.dumps(["Is the money my family holds in a form the I-20 will accept?"])},
    )
    conn.execute(
        text("insert into study_universities (country_id, slug, name, city, kind, official_url, "
             "areas, intakes, application_urls, verified, sponsored, is_active, sort_order, created_at) "
             "values ((select id from study_countries where slug = 'united-states'), "
             "'university-of-michigan', 'University of Michigan', 'Ann Arbor', 'public', "
             "'https://umich.edu/', :areas, :intakes, :urls, 0, 0, 1, 1, '2026-10-18 10:00:00')"),
        {"areas": json.dumps(["Engineering", "Medicine"]),
         "intakes": json.dumps([]), "urls": json.dumps({})},
    )
    conn.execute(
        text("insert into study_services (slug, title, summary, steps, includes, not_included, "
             "available, sort_order, created_at) values "
             "('profile-building', 'Profile building', 'What we do.', :steps, :includes, "
             ":not_included, 1, 1, '2026-10-18 10:00:00')"),
        {"steps": json.dumps([]), "includes": json.dumps([]),
         "not_included": json.dumps(["Anything a university decides."])},
    )
    conn.execute(
        text("insert into study_leads (name, email, phone, stage, country_id, service_id, message, "
             "source_page, consent_contact, consent_contact_at, status, created_at) values "
             "('Reena', 'reena@example.com', null, 'class-12', "
             "(select id from study_countries where slug = 'united-states'), "
             "(select id from study_services where slug = 'profile-building'), "
             "'We would like to talk.', '/study-abroad', 1, "
             "'2026-10-18 10:00:00', 'new', '2026-10-18 10:00:00')")
    )

# Read back through the models rather than raw SQL, because the columns worth judging
# here are the JSON ones and the nullable ones — and the app only ever sees them
# decoded, as a list or as None.
with Session(engine) as db:
    destination = db.query(models.StudyCountry).filter_by(slug="united-states").one()
    campus = db.query(models.University).filter_by(slug="university-of-michigan").one()
    enquiry = db.query(models.StudyLead).filter_by(email="reena@example.com").one()
check("a destination, a university in it and an enquiry about it all insert and join",
      campus.country_id == destination.id and enquiry.country_id == destination.id
      and campus.name == "University of Michigan"
      and campus.official_url == "https://umich.edu/" and enquiry.status == "new",
      (destination.id, campus.country_id, enquiry.country_id))
check("…and the university nobody has checked is stored as unknown, not as a number",
      campus.verified is False and campus.tuition_note is None
      and campus.deadline_note is None and campus.source_url is None
      and campus.verified_at is None,
      (campus.verified, campus.tuition_note, campus.source_url))
check("…with its intakes and application links kept as the empty list and dict the page reads",
      campus.intakes == [] and campus.application_urls == {}
      and campus.areas == ["Engineering", "Medicine"],
      (campus.intakes, campus.application_urls, campus.areas))
check("…and the destination carries the questions a family still has to ask itself",
      len(destination.to_check) == 1 and destination.visa_portal_url.startswith("https://"),
      destination.to_check)
check("…and nobody has claimed to have re-read that copy against the portal",
      destination.checked_at is None, destination.checked_at)
check("…and the enquiry remembers only what the person typed, with the tick dated",
      enquiry.name == "Reena" and enquiry.phone is None and enquiry.stage == "class-12"
      and enquiry.consent_contact is True and enquiry.consent_contact_at is not None,
      (enquiry.name, enquiry.stage, enquiry.consent_contact))

university_columns = {column["name"] for column in inspect(engine).get_columns("study_universities")}
check("the fee, intake and deadline columns are all nullable, so a seed can leave them empty",
      all(next(column for column in inspect(engine).get_columns("study_universities")
               if column["name"] == name)["nullable"]
          for name in ("tuition_note", "deadline_note", "english_test_note", "source_url",
                       "verified_at", "founded_year")),
      sorted(university_columns))

duplicate_country = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into study_countries (slug, name, code, overview, to_check, is_active, "
                 "sort_order, created_at) values "
                 "('united-states', 'USA again', '', 'x', '[]', 1, 2, '2026-10-18 10:01:00')")
        )
except Exception as caught:  # noqa: BLE001 - asserting the index fired
    duplicate_country = type(caught).__name__
check("two destinations cannot share one address, because the slug index is unique",
      duplicate_country is not None, duplicate_country)

duplicate_university = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into study_universities (country_id, slug, name, city, kind, official_url, "
                 "areas, intakes, application_urls, verified, sponsored, is_active, sort_order, created_at) "
                 "values ((select id from study_countries where slug = 'united-states'), "
                 "'university-of-michigan', 'Duplicate', 'x', 'public', 'https://example.invalid/', "
                 "'[]', '[]', '{}', 0, 0, 1, 2, '2026-10-18 10:01:00')")
        )
except Exception as caught:  # noqa: BLE001
    duplicate_university = type(caught).__name__
check("…and the same for a university, so a directory cannot list one twice",
      duplicate_university is not None, duplicate_university)

# The point of a marketing enquiry being its own table: it has no account behind it.
lead_columns = {column["name"] for column in inspect(engine).get_columns("study_leads")}
check("an enquiry is not attached to an account, so a sales follow-up cannot reach a "
      "child's career record",
      "user_id" not in lead_columns, sorted(lead_columns))

stories = engine.connect().execute(text("select count(*) from study_stories")).scalar()
check("no success story exists yet, because none could be verified",
      stories == 0, stories)

# A destination is a catalogue entry and can be retired. The enquiry somebody sent about
# it is a person's message, and must not go with it.
with engine.connect() as conn:
    conn.exec_driver_sql("PRAGMA foreign_keys=ON")
    conn.execute(text("delete from study_services where slug = 'profile-building'"))
    kept_lead = conn.execute(
        text("select name, service_id from study_leads where email = 'reena@example.com'")
    ).first()
    conn.commit()
check("retiring a service leaves the enquiry standing, with its service pointer cleared",
      kept_lead is not None and kept_lead[0] == "Reena" and kept_lead[1] is None, kept_lead)

# ---------------------------------------------------------------- organisations
#
# The rule 0007 exists to make physical: **a school's invite is a row with no account
# behind it, and there is nothing in this schema for a school to read through it.** That
# is not a route-level check the database could be talked out of — an `invited` row holds
# an address and a digest, and no `user_id` to join to a sitting. So the checks below are
# the ones that matter: what a roster looks like, what one person cannot be twice, and
# what leaves when a person or a school leaves.
with engine.begin() as conn:
    conn.execute(
        text("insert into organizations (slug, kind, name, tier_code, verified, is_active, created_at) values "
             "('green-school', 'school', 'Green School', 'school_starter', 0, 1, '2026-10-18 11:00:00'),"
             "('reena-practice', 'counsellor', 'Reena Career Practice', 'counsellor_solo', 0, 1, "
             "'2026-10-18 11:00:00')")
    )
    school = conn.execute(text("select id from organizations where slug = 'green-school'")).scalar()
    practice = conn.execute(text("select id from organizations where slug = 'reena-practice'")).scalar()
    conn.execute(
        text("insert into organization_branding (organization_id, portal_title, welcome_note, logo_url, "
             "accent_color, changed_at, created_at) values (:o, 'Green School career corner', "
             "'We meet on Tuesdays.', 'https://green-school.example.invalid/logo.png', '#0f62fe', "
             "'2026-10-18 11:00:00', '2026-10-18 11:00:00')"),
        {"o": school},
    )
    # The second counsellor account, so "one person, two organisations" can be tested
    # rather than asserted. Deleted at the end of this section, with everything under it.
    conn.execute(
        text("insert into users (id, role, display_name, preferred_language, is_active, created_at) values "
             "(5, 'parent', 'Nadia', 'en', 1, '2026-10-18 11:00:00')")
    )
    # Two addresses a school invited and nobody has accepted yet.
    conn.execute(
        text("insert into memberships (organization_id, org_role, status, invited_email, invite_hash, "
             "invite_expires_at, display_label, share_results, created_at) values "
             "(:o, 'student', 'invited', 'asha@family.test', 'hash-asha', '2026-10-25 11:00:00', 'Asha K', 0, "
             "'2026-10-18 11:00:00'),"
             "(:o, 'student', 'invited', 'bilal@family.test', 'hash-bilal', '2026-10-25 11:00:00', 'Bilal R', 0, "
             "'2026-10-18 11:00:00')"),
        {"o": school},
    )
    roster = conn.execute(
        text("select count(*) from memberships where organization_id = :o and user_id is null"), {"o": school}
    ).scalar()
    accepted = conn.execute(
        text("select count(*) from memberships where user_id is not null")
    ).scalar()
check("two invites in one school are two rows, because a roster is not yet an account",
      roster == 2, roster)
check("…and neither of them points at a person, so there is nothing to read",
      accepted == 0, accepted)

with engine.connect() as conn:
    one_more = conn.execute(
        text("select portal_title, accent_color, welcome_note from organization_branding "
             "where organization_id = :o"), {"o": school}
    ).first()
check("a school gets exactly one branding row, keyed by itself", one_more is not None
      and one_more[0] == "Green School career corner" and one_more[1] == "#0f62fe", one_more)
check("…and the note a child reads before joining is stored as typed, not as a claim",
      one_more is not None and one_more[2] == "We meet on Tuesdays.", one_more)

same_address = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into memberships (organization_id, org_role, status, invited_email, invite_hash, "
                 "share_results, created_at) values (:o, 'student', 'invited', 'asha@family.test', "
                 "'hash-asha-again', 0, '2026-10-18 11:01:00')"), {"o": school}
        )
except Exception as caught:  # noqa: BLE001 - asserting the index fired
    same_address = type(caught).__name__
check("one address cannot be invited twice into one school, so a bulk upload cannot "
      "queue the same child's mail twice", same_address is not None, same_address)

# An accepted invite: the account itself arrives holding the token, and the row gains a
# `user_id` it could not have had before.
with engine.begin() as conn:
    conn.execute(
        text("insert into memberships (organization_id, user_id, org_role, status, joined_at, "
             "share_results, created_at) values "
             "(:o, 1, 'student', 'active', '2026-10-18 11:02:00', 1, '2026-10-18 11:02:00')"), {"o": school}
    )
    conn.execute(
        text("insert into memberships (organization_id, user_id, org_role, status, joined_at, "
             "share_results, created_at) values "
             "(:o, 5, 'counsellor', 'active', '2026-10-18 11:02:00', 0, '2026-10-18 11:02:00')"), {"o": school}
    )
    student_m = conn.execute(
        text("select id from memberships where organization_id = :o and user_id = 1"), {"o": school}
    ).scalar()
    counsellor_m = conn.execute(
        text("select id from memberships where organization_id = :o and user_id = 5"), {"o": school}
    ).scalar()
    conn.execute(
        # The school assigns a counsellor as the person to talk to. That is a pointer on
        # the student's own row and grants nothing: the counsellor's access is their own
        # membership, and the sharing flag is the student's.
        text("update memberships set assigned_counsellor_id = :c where id = :s"),
        {"c": counsellor_m, "s": student_m},
    )
    conn.execute(
        text("insert into session_notes (organization_id, client_membership_id, author_user_id, body, "
             "shared_with_family, created_at) values (:o, :client, 5, 'Talked about class 12 subjects "
             "and next steps.', 0, '2026-10-18 11:03:00')"),
        {"o": school, "client": student_m},
    )

twice = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into memberships (organization_id, user_id, org_role, status, share_results, "
                 "created_at) values (:o, 1, 'student', 'active', 0, '2026-10-18 11:04:00')"), {"o": school}
        )
except Exception as caught:  # noqa: BLE001
    twice = type(caught).__name__
check("one student cannot hold two places in one school, so a dashboard cannot list them twice",
      twice is not None, twice)

with engine.begin() as conn:
    conn.execute(
        text("insert into memberships (organization_id, user_id, org_role, status, joined_at, "
             "share_results, created_at) values (:o, 5, 'counsellor', 'active', "
             "'2026-10-18 11:05:00', 0, '2026-10-18 11:05:00')"), {"o": practice}
    )
    in_two = conn.execute(
        text("select count(*) from memberships where user_id = 5")
    ).scalar()
check("the same person can work at two practices, because a role belongs to one organisation",
      in_two == 2, in_two)

with engine.connect() as conn:
    note = conn.execute(
        text("select body, shared_with_family, shared_at from session_notes")
    ).first()
check("a counsellor's note is private working text until they share it",
      note is not None and note[1] == 0 and note[2] is None, note)

# What leaving takes with it, and what it must not.
with engine.connect() as conn:
    conn.exec_driver_sql("PRAGMA foreign_keys=ON")
    conn.execute(text("delete from memberships where id = :c"), {"c": counsellor_m})
    still = conn.execute(
        text("select user_id, assigned_counsellor_id from memberships where id = :s"), {"s": student_m}
    ).first()
    conn.execute(text("delete from organizations where id = :o"), {"o": practice})
    other_org = conn.execute(
        text("select count(*) from memberships where organization_id = :o"), {"o": school}
    ).scalar()
    conn.execute(text("delete from users where id = 5"))
    orphan_notes = conn.execute(text("select count(*) from session_notes")).scalar()
    remaining_users = conn.execute(text("select id, display_name from users")).all()
    conn.commit()
check("a counsellor leaving the school clears the assignment but keeps the student's place",
      still is not None and still[0] == 1 and still[1] is None, still)
check("closing a practice takes its memberships with it, and none of the school's",
      other_org == 3, other_org)
check("deleting an account deletes the notes it wrote, so a data request reaches this table",
      orphan_notes == 0, orphan_notes)
check("…and the student who joined the school keeps their own account",
      remaining_users == [(1, "Asha")], remaining_users)

member_columns = {column["name"]: column for column in inspect(engine).get_columns("memberships")}
check("the sharing switch cannot be left undefined, so it is always somebody's recorded "
      "answer rather than an absent one",
      member_columns["share_results"]["nullable"] is False, member_columns["share_results"])
check("…and an invite carries only a digest, never a token a reader could use to join",
      not any(name.endswith("token") for name in member_columns), sorted(member_columns))
check("…and no column here can hold a child's answer, a transcript or a report",
      not any(word in name for name in member_columns
              for word in ("answer", "transcript", "score", "result_json", "report")),
      sorted(member_columns))

second_result = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into assessment_results (assessment_id, user_id, assessment_type, score_json, "
                 "traits_json, detail_json, completed_at, created_at) values "
                 "(1, 1, 'interest', '{}', '[]', '{}', '2026-10-17 10:07:00', '2026-10-17 10:07:00')")
        )
except Exception as caught:  # noqa: BLE001
    second_result = type(caught).__name__
check("one sitting cannot carry two results", second_result is not None, second_result)

duplicate_pdf = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into report_pdfs (student_id, anchor_result_id, language, filename, "
                 "result_ids, pdf_bytes, size_bytes, generated_at, is_deleted, created_at) values "
                 "(1, 1, 'en', 'again.pdf', '[1]', :pdf, 3, "
                 "'2026-10-17 10:11:00', 0, '2026-10-17 10:11:00')"),
            {"pdf": b"%PDF"},
        )
except Exception as caught:  # noqa: BLE001
    duplicate_pdf = type(caught).__name__
check("the same student, anchor and print language cannot hold two files",
      duplicate_pdf is not None, duplicate_pdf)

# The rule "one email opens one account" lives in a unique index rather than a
# unique constraint, because SQLite cannot add a constraint to a table that already
# exists. So the index has to refuse it here, not only in the router.
with engine.begin() as conn:
    conn.execute(text("update users set clerk_user_id = 'user_01ABC' where id = 1"))
duplicate_clerk = None
try:
    with engine.begin() as conn:
        conn.execute(
            text("insert into users (id, role, display_name, preferred_language, is_active, "
                 "clerk_user_id, created_at) values "
                 "(2, 'student', 'Bilal', 'en', 1, 'user_01ABC', '2026-10-18 09:00:00')")
        )
except Exception as caught:  # noqa: BLE001
    duplicate_clerk = type(caught).__name__
check("one email sign-in cannot open two accounts", duplicate_clerk is not None, duplicate_clerk)

# SQLite ignores ON DELETE unless told otherwise (PostgreSQL never does), so the
# cascade is checked with the switch on: the DDL has to be right for the database
# the app is moving to.
with engine.connect() as conn:
    conn.exec_driver_sql("PRAGMA foreign_keys=ON")
    conn.execute(text("delete from assessments where id = 1"))
    responses = conn.execute(text("select count(*) from assessment_responses")).scalar()
    results = conn.execute(text("select count(*) from assessment_results")).scalar()
    pdfs = conn.execute(text("select count(*) from report_pdfs")).scalar()
    conn.commit()
check("deleting a sitting cascades to its answers, its result and its printed report",
      responses == 0 and results == 0 and pdfs == 0, (responses, results, pdfs))

# The operator log is the one table here that has to outlive the account that wrote it.
# `ON DELETE SET NULL` plus a name snapshotted at write time is the mechanism, and it is
# the difference between a history and a side effect: closing a person's account must not
# be a way to erase what that person did while running the site.
with engine.connect() as conn:
    conn.exec_driver_sql("PRAGMA foreign_keys=ON")
    conn.execute(
        text("insert into users (id, role, display_name, preferred_language, is_active, "
             "created_at) values (2, 'parent', 'Chiru', 'en', 1, '2026-10-19 09:00:00')")
    )
    conn.execute(
        text("insert into audit_events (actor_user_id, actor_name, action, subject_type, "
             "subject_id, detail, origin, created_at) values "
             "(2, 'Chiru', 'user.admin_grant', 'user', '1', 'is_admin -> true', 'script', "
             "'2026-10-19 09:05:00')")
    )
    conn.execute(text("delete from users where id = 2"))
    survived = conn.execute(
        text("select actor_user_id, actor_name, action, detail from audit_events")
    ).all()
    conn.commit()
check("deleting an account does not delete what that account did",
      survived == [(None, "Chiru", "user.admin_grant", "is_admin -> true")], survived)
check("…the actor column becomes a null rather than a hole, and the snapshot name stays",
      survived and survived[0][0] is None and survived[0][1] == "Chiru", survived)

audit_columns = {column["name"] for column in inspect(engine).get_columns("audit_events")}
check("the log has no address, device string, user agent or request body to hold",
      not any(word in name for name in audit_columns
              for word in ("ip", "address", "agent", "body", "payload", "content",
                           "token", "hash")),
      sorted(audit_columns))
check("…and the only table it points at is the account, so no child's row is reachable "
      "by following a log entry",
      {foreign["referred_table"]
       for foreign in inspect(engine).get_foreign_keys("audit_events")} == {"users"},
      inspect(engine).get_foreign_keys("audit_events"))
engine.dispose()

print("\n=== 6. downgrade: each revision can be undone, down to the baseline")
# Back as far as the baseline, not further: the twenty tables the later revisions
# created go, the nineteen that predate them stay, and the child's account in `users` is
# untouched — which is the only undo anybody would ever run on a database with real data.
command.downgrade(cfg, BASELINE)
left = tables_in(URL)
check("all twenty tables the later revisions created are gone",
      not any(table in left for table in TABLES), left)
check("…and the nineteen the baseline created are still there, `users` among them",
      all(table in left for table in BASELINE_TABLES), left)

# Surviving the table is not enough: these revisions only widened it, so undoing them
# has to leave the account and its history exactly as they were found.
engine = create_engine(URL)
kept = {column["name"] for column in inspect(engine).get_columns("users")}
check("the email sign-in columns are removed again",
      not {"clerk_user_id", "clerk_linked_at"} & kept, sorted(kept))
check("…with their unique index",
      not any(index["name"] == "ix_users_clerk_user_id" for index in inspect(engine).get_indexes("users")),
      inspect(engine).get_indexes("users"))
check("…and the contact-address columns, the outbox and the study-abroad tables leave "
      "no column behind",
      not (set(ADDED_LATER) & kept), sorted(kept))
check("…and the account that was there before this revision is still there, row for row",
      engine.connect().execute(text("select id, display_name from users")).all() == [(1, "Asha")],
      engine.connect().execute(text("select * from users")).all())
check("…and 0009's widening reverses to 16 characters, which is what makes the baseline's "
      "16 the right number to start a fresh database with",
      next(getattr(column["type"], "length", None)
           for column in inspect(engine).get_columns("interest_observations")
           if column["name"] == "source") == 16)
check("…and 0013's typed age goes with it, so the undo is the whole of that revision",
      "age" not in {column["name"] for column in inspect(engine).get_columns("student_profiles")},
      sorted(column["name"] for column in inspect(engine).get_columns("student_profiles")))
check("…while the profile row that was already there keeps every answer it held, which on "
      "SQLite means the table had to be rebuilt around the dropped column rather than "
      "emptied by it",
      engine.connect().execute(
          text("select user_id, class_level, age_range from student_profiles")
      ).all() == [(1, "class-9", "11-12")],
      engine.connect().execute(text("select * from student_profiles")).all())
engine.dispose()

# The rest of the way down is the part a baseline makes new, and it is worth saying out
# loud rather than leaving for somebody to discover: `users` is now inside the chain, so
# `downgrade base` drops the account table along with everything else. It runs here
# because a chain that cannot be fully undone cannot be tested from nothing, and it must
# never run against a database holding real children. Nothing in the repository calls it —
# `docker-entrypoint.sh` only ever runs `upgrade head`, and `scripts/db_init.py` only
# creates.
command.upgrade(cfg, "head")
check("the chain runs forward again from the baseline, over a table it has already widened "
      "once and undone once",
      create_engine(URL).connect().execute(
          text("select version_num from alembic_version")).scalar() == HEAD)
command.downgrade(cfg, "base")
check("and `downgrade base` leaves nothing but the version table — a full undo now takes "
      "the account table with it, which is why no deployment step here ever runs one",
      tables_in(URL) == ["alembic_version"], tables_in(URL))

print("\n=== 7. stamp: for a database the app prepared before the chain was pointed at it")
# The path `docker-entrypoint.sh` takes when it finds tables and no `alembic_version`:
# the schema is already whatever the app's own `create_all` made, so the chain has to
# record that fact instead of replaying DDL over tables that exist. `create_all` on an
# empty file reproduces that state exactly — section 4 is what proves the two agree.
STAMPED = pathlib.Path(tempfile.gettempdir()) / "careerguide_stamp_test.db"
if STAMPED.exists():
    STAMPED.unlink()
STAMP_URL = f"sqlite:///{STAMPED.as_posix()}"
prepared = create_engine(STAMP_URL)
Base.metadata.create_all(prepared)
prepared.dispose()
os.environ["DATABASE_URL"] = STAMP_URL
get_settings.cache_clear()
check("it has all forty tables and no alembic_version, which is the state the "
      "entrypoint looks for",
      sorted(tables_in(STAMP_URL)) == sorted(ALL_TABLES), tables_in(STAMP_URL))
command.stamp(cfg, "head")
engine = create_engine(STAMP_URL)
check("stamp records the revision without building anything",
      engine.connect().execute(text("select version_num from alembic_version")).scalar()
      == HEAD)
check("…and the tables `create_all` made stay exactly as they were",
      sorted(tables_in(STAMP_URL)) == sorted([*ALL_TABLES, "alembic_version"]),
      tables_in(STAMP_URL))
engine.dispose()
command.upgrade(cfg, "head")
check("after stamping, upgrade head changes nothing instead of failing on existing tables",
      sorted(tables_in(STAMP_URL)) == sorted([*ALL_TABLES, "alembic_version"]),
      tables_in(STAMP_URL))
os.environ["DATABASE_URL"] = URL
get_settings.cache_clear()

print("\n=== 8. 0009 on a database the app built before migrations existed")
# The revision under test does not create a table, it widens a column in one — and the
# table it widens is `interest_observations`. The baseline now creates that table too, but
# a database that predates the chain never ran the baseline: it got the table from the
# models, on a laptop, with the 16-character column this app shipped with, and it already
# holds `interest_activity` because SQLite stores a too-long value without measuring it.
# That is the state 0009 was written for, so it is built here by hand, row and all, before
# the chain is asked to fix it — and stamped at 0008, the way the entrypoint stamps a
# database it did not build.
WIDEN = pathlib.Path(tempfile.gettempdir()) / "careerguide_widen_test.db"
if WIDEN.exists():
    WIDEN.unlink()
WIDE_URL = f"sqlite:///{WIDEN.as_posix()}"
laptop = create_engine(WIDE_URL)
with laptop.begin() as conn:
    conn.execute(
        text("create table interest_observations (id integer primary key, "
             "student_id integer not null, session_id integer, theme varchar(48) not null, "
             "evidence text not null, source varchar(16) not null, created_at datetime not null)")
    )
    conn.execute(
        text("insert into interest_observations (id, student_id, theme, evidence, source, created_at) "
             "values (1, 1, 'creative_exploration', 'I like drawing and computers. What kind of "
             "work uses both?', 'interest_activity', '2026-10-11 17:26:21')")
    )
before_width = next(
    getattr(column["type"], "length", None)
    for column in inspect(laptop).get_columns("interest_observations")
    if column["name"] == "source"
)
check("the column this revision is about arrived as varchar(16)",
      before_width == 16, before_width)
check("…and it already holds a 17-character value, which is the whole reason 0009 exists",
      laptop.connect().execute(
          text("select length(source) from interest_observations where id = 1")
      ).scalar() == 17)
laptop.dispose()

os.environ["DATABASE_URL"] = WIDE_URL
get_settings.cache_clear()
command.stamp(cfg, "0008_admin_audit")
check("stamping the revision the column was broken under records it without changing anything",
      create_engine(WIDE_URL).connect().execute(
          text("select version_num from alembic_version")).scalar() == EIGHTH)
command.upgrade(cfg, "head")
engine = create_engine(WIDE_URL)
after_width = next(
    getattr(column["type"], "length", None)
    for column in inspect(engine).get_columns("interest_observations")
    if column["name"] == "source"
)
check("upgrade head widens it to 32", after_width == 32, after_width)
check("…without touching the observation that was already there, text and all",
      engine.connect().execute(
          text("select source, theme, student_id is not null from interest_observations")
      ).all() == [("interest_activity", "creative_exploration", 1)],
      engine.connect().execute(text("select * from interest_observations")).all())
check("…and the columns around it kept their names and their order",
      [column["name"] for column in inspect(engine).get_columns("interest_observations")]
      == ["id", "student_id", "session_id", "theme", "evidence", "source", "created_at"],
      [column["name"] for column in inspect(engine).get_columns("interest_observations")])
engine.dispose()

print("\n=== 9. 0010 on a database that holds a device account and a live session")
# The revision under test renames two columns and rewrites the values inside them, and the
# values are the two things a browser presents as proof of who it is. The state it has to
# be tested against is therefore not an empty chain: it is a running database with one real
# device id, one real bearer token, and — because the app is already writing digests by the
# time the backfill reaches the second row of a busy site — one of each that arrived during
# the migration. All four are built by hand here, stamped at 0009 the way the entrypoint
# stamps a database it did not build, and then the chain is asked to fix them up.
HASHED = pathlib.Path(tempfile.gettempdir()) / "careerguide_hash_test.db"
if HASHED.exists():
    HASHED.unlink()
HASH_URL = f"sqlite:///{HASHED.as_posix()}"
DEVICE = "3f2b7c1d-9a4e-4b6f-8c2d-1e5a7b9c0d3f"  # what `crypto.randomUUID()` hands out
TOKEN = secrets.token_urlsafe(32)  # what `issue_token` hands out: 43 characters
ALREADY_DEVICE = "a" * 64  # a digest written by the app while this revision was running
ALREADY_TOKEN = "b" * 64
laptop = create_engine(HASH_URL)
with laptop.begin() as conn:
    conn.execute(
        text("create table users (id integer primary key, role varchar(16) not null, "
             "display_name varchar(64) not null, preferred_language varchar(8) not null, "
             "is_active boolean not null, device_id varchar(64), created_at datetime not null)")
    )
    conn.execute(text("create index ix_users_device_id on users (device_id)"))
    conn.execute(
        text("insert into users (id, role, display_name, preferred_language, is_active, "
             "device_id, created_at) values "
             "(1, 'student', 'Asha', 'en', 1, :device, '2026-10-11 17:26:21'), "
             "(2, 'student', 'Bilal', 'en', 1, :already, '2026-10-19 08:00:00')"),
        {"device": DEVICE, "already": ALREADY_DEVICE},
    )
    conn.execute(
        text("create table auth_tokens (token varchar(64) primary key, user_id integer not null, "
             "expires_at datetime not null, created_at datetime, updated_at datetime)")
    )
    conn.execute(
        text("insert into auth_tokens (token, user_id, expires_at, created_at) values "
             "(:token, 1, '2026-11-11 17:26:21', '2026-10-11 17:26:21'), "
             "(:already, 2, '2026-11-19 08:00:00', '2026-10-19 08:00:00')"),
        {"token": TOKEN, "already": ALREADY_TOKEN},
    )
check("it starts with exactly the two columns this revision is about",
      {"device_id"} <= {column["name"] for column in inspect(laptop).get_columns("users")}
      and {"token"} <= {column["name"] for column in inspect(laptop).get_columns("auth_tokens")})
check("…and both hold the plaintext a browser would present: 36 characters of device id, "
      f"{len(TOKEN)} of token",
      laptop.connect().execute(
          text("select length(device_id) from users where id = 1")).scalar() == 36
      and laptop.connect().execute(
          text("select length(token) from auth_tokens where user_id = 1")).scalar() == 43)
laptop.dispose()

os.environ["DATABASE_URL"] = HASH_URL
get_settings.cache_clear()
command.stamp(cfg, NINTH)
command.upgrade(cfg, "head")
laptop = create_engine(HASH_URL)
hashed_users = {column["name"] for column in inspect(laptop).get_columns("users")}
hashed_tokens = {column["name"] for column in inspect(laptop).get_columns("auth_tokens")}
check("the columns are renamed", "device_hash" in hashed_users and "token_hash" in hashed_tokens,
      sorted(hashed_users))
check("…and the old names, which were the credentials, are gone",
      not ({"device_id"} & hashed_users or {"token"} & hashed_tokens),
      [sorted(hashed_users), sorted(hashed_tokens)])
stored_device = laptop.connect().execute(
    text("select device_hash from users where id = 1")).scalar()
check("the device id is stored as the digest `app/security.py` looks it up by, not as text",
      stored_device == device_hash_of(DEVICE) and stored_device != DEVICE, stored_device)
check("…which is 64 lowercase hex characters, the width the column already had",
      len(stored_device) == 64 and all(c in "0123456789abcdef" for c in stored_device),
      stored_device)
check("…and no row of the table still holds the plaintext, so a dump of it grants nothing",
      laptop.connect().execute(
          text("select count(*) from users where device_hash = :plain"),
          {"plain": DEVICE},
      ).scalar() == 0)
check("a token is stored the same way, so the primary key is no longer a live session",
      laptop.connect().execute(
          text("select count(*) from auth_tokens where token_hash = :plain"),
          {"plain": TOKEN},
      ).scalar() == 0
      and laptop.connect().execute(
          text("select token_hash from auth_tokens where user_id = 1")).scalar()
      == token_hash_of(TOKEN))
check("…and the session row is still there: the same user, the same expiry, not a new key "
      "the browser was never told about",
      laptop.connect().execute(
          text("select user_id, expires_at from auth_tokens")).all()
      == [(1, "2026-11-11 17:26:21"), (2, "2026-11-19 08:00:00")],
      laptop.connect().execute(text("select * from auth_tokens")).all())
check("the value already digested when this revision reached it is left exactly alone, "
      "because re-hashing it would silently end a live child's session",
      laptop.connect().execute(
          text("select device_hash from users where id = 2")).scalar() == ALREADY_DEVICE
      and laptop.connect().execute(
          text("select token_hash from auth_tokens where user_id = 2")).scalar() == ALREADY_TOKEN)
check("…and the account beside that value is unharmed, name and join date and all",
      laptop.connect().execute(
          text("select display_name, role, is_active, created_at from users where id = 1")
      ).all() == [("Asha", "student", 1, "2026-10-11 17:26:21")],
      laptop.connect().execute(text("select * from users")).all())
check("the index follows the column it covers, which is the name `app/models.py` declares",
      sorted(index["name"] for index in inspect(laptop).get_indexes("users"))
      == ["ix_users_device_hash"],
      inspect(laptop).get_indexes("users"))
laptop.dispose()

# Undoing it, and undoing the undo. This part is not decoration: it is the only place that
# says out loud what `alembic downgrade` costs on a database holding accounts.
command.downgrade(cfg, NINTH)
laptop = create_engine(HASH_URL)
check("downgrade gives the columns their old names back",
      "device_id" in {column["name"] for column in inspect(laptop).get_columns("users")}
      and "token" in {column["name"] for column in inspect(laptop).get_columns("auth_tokens")})
check("…and clears them rather than leaving digests under a name that promises plaintext: "
      "every device starts a new account and every session ends, which is the honest meaning "
      "of undoing this one",
      laptop.connect().execute(
          text("select count(*) from users where device_id is not null")).scalar() == 0
      and laptop.connect().execute(text("select count(*) from auth_tokens")).scalar() == 0)
check("…while the accounts themselves stay, because the undo touches two columns and not a "
      "row of children",
      laptop.connect().execute(
          text("select display_name from users order by id")).all()
      == [("Asha",), ("Bilal",)])
check("…and the index comes back under its old name",
      sorted(index["name"] for index in inspect(laptop).get_indexes("users"))
      == ["ix_users_device_id"], inspect(laptop).get_indexes("users"))
laptop.dispose()
command.upgrade(cfg, "head")
laptop = create_engine(HASH_URL)
check("running it forward again after that does not hash a hash: the guard leaves both "
      "columns as they were, so a downgrade-then-retry cannot corrupt an account twice",
      laptop.connect().execute(
          text("select count(*) from users where device_hash is not null")).scalar() == 0)
check("…and the chain still ends at the head",
      laptop.connect().execute(
          text("select version_num from alembic_version")).scalar() == HEAD)
laptop.dispose()

print("\n=== 10. 0010 on a database the application changed before Alembic did")
# The state that made this revision crash in the field. `app/schema_sync.py` runs on every
# boot, and on a table that already exists it adds any nullable column the models declare and
# the database lacks — so a deployment that starts the new code before migrating it has
# `users.device_hash` (empty, plus its index) sitting beside the plaintext `users.device_id`
# it is stamped at 0009 for. `RENAME COLUMN … TO device_hash` against that is a
# `DuplicateColumnError` inside SQLite's batch rebuild, and the entrypoint that runs
# `alembic upgrade head` dies on it: the app boots, schema sync mutates the table, and the
# migration that follows can no longer find a table it can fix. This section rebuilds exactly
# that database, one row of it holding a digest the app had already written, and asks the
# chain to merge the two columns instead of renaming one into the other.
BOOTS_FIRST = pathlib.Path(tempfile.gettempdir()) / "careerguide_schemasync_test.db"
if BOOTS_FIRST.exists():
    BOOTS_FIRST.unlink()
BOOT_URL = f"sqlite:///{BOOTS_FIRST.as_posix()}"
PLAIN_DEVICE = "9c1f27e0-5b34-4a8f-9d61-2c7e0b4a8f15"
DURING = "c" * 64  # written by the app between the boot and the migration
boot = create_engine(BOOT_URL)
with boot.begin() as conn:
    conn.execute(
        text("create table users (id integer primary key, role varchar(16) not null, "
             "display_name varchar(64) not null, preferred_language varchar(8) not null, "
             "is_active boolean not null, device_id varchar(64), created_at datetime not null, "
             "device_hash varchar(64))")
    )
    conn.execute(text("create index ix_users_device_id on users (device_id)"))
    conn.execute(text("create index ix_users_device_hash on users (device_hash)"))
    conn.execute(
        text("create table auth_tokens (token varchar(64) primary key, user_id integer not null, "
             "expires_at datetime not null, created_at datetime, updated_at datetime)")
    )
    conn.execute(
        text("insert into users (id, role, display_name, preferred_language, is_active, "
             "device_id, device_hash, created_at) values "
             "(1, 'student', 'Chika', 'en', 1, :plain, null, '2026-10-12 09:00:00'), "
             "(2, 'student', 'Dev', 'en', 1, null, :during, '2026-10-20 07:00:00'), "
             "(3, 'guardian', 'Ms Rao', 'en', 1, null, null, '2026-10-13 11:30:00')"),
        {"plain": PLAIN_DEVICE, "during": DURING},
    )
    conn.execute(
        text("insert into auth_tokens (token, user_id, expires_at, created_at) values "
             "(:token, 1, '2026-11-12 09:00:00', '2026-10-12 09:00:00')"),
        {"token": secrets.token_urlsafe(32)},
    )
boot_cols = {column["name"] for column in inspect(boot).get_columns("users")}
check("the table has both columns, which is what a rename cannot survive",
      {"device_id", "device_hash"} <= boot_cols, sorted(boot_cols))
check("…and the plaintext is still in the old one while the new one is empty",
      boot.connect().execute(
          text("select device_id, device_hash from users where id = 1")).all()
      == [(PLAIN_DEVICE, None)])
boot.dispose()

os.environ["DATABASE_URL"] = BOOT_URL
get_settings.cache_clear()
command.stamp(cfg, NINTH)
command.upgrade(cfg, "head")
boot = create_engine(BOOT_URL)
merged = {column["name"] for column in inspect(boot).get_columns("users")}
check("the revision merges instead of crashing: the plaintext column is gone and the "
      "digest column is the one left",
      "device_hash" in merged and "device_id" not in merged, sorted(merged))
check("…and every device id that was plaintext is now the digest the guest route looks up",
      boot.connect().execute(
          text("select device_hash from users where id = 1")).scalar() == device_hash_of(PLAIN_DEVICE),
      boot.connect().execute(text("select device_hash from users where id = 1")).scalar())
check("…with nothing left anywhere in the table that a browser could present as a plain "
      "device id",
      boot.connect().execute(
          text("select count(*) from users where device_hash = :plain"),
          {"plain": PLAIN_DEVICE},
      ).scalar() == 0)
check("a row whose digest the application wrote during the boot keeps it, because "
      "re-hashing that value would sign the child out of the account they are in",
      boot.connect().execute(
          text("select device_hash from users where id = 2")).scalar() == DURING)
check("…and a row that never had a device id at all is still NULL rather than being "
      "invented one",
      boot.connect().execute(
          text("select device_hash from users where id = 3")).scalar() is None)
check("the accounts are untouched — three of them, names and join dates and all",
      boot.connect().execute(
          text("select display_name, role, created_at from users order by id")).all()
      == [("Chika", "student", "2026-10-12 09:00:00"),
          ("Dev", "student", "2026-10-20 07:00:00"),
          ("Ms Rao", "guardian", "2026-10-13 11:30:00")],
      boot.connect().execute(text("select * from users")).all())
check("the index ends up on the surviving column under the name `app/models.py` declares, "
      "and the one that covered the dropped column is gone",
      sorted(index["name"] for index in inspect(boot).get_indexes("users"))
      == ["ix_users_device_hash"], inspect(boot).get_indexes("users"))
check("…and `auth_tokens`, which schema sync can never have touched (its column is the "
      "primary key, so it is not nullable), still just renames",
      "token_hash" in {column["name"] for column in inspect(boot).get_columns("auth_tokens")}
      and "token" not in {column["name"] for column in inspect(boot).get_columns("auth_tokens")},
      {column["name"] for column in inspect(boot).get_columns("auth_tokens")})
check("…with its session row and expiry intact, so nobody who was signed in is asked again",
      boot.connect().execute(
          text("select user_id, expires_at from auth_tokens")).all()
      == [(1, "2026-11-12 09:00:00")])
check("and the chain ends at the head, which is the whole point: this database is now on "
      "the schema the running code expects",
      boot.connect().execute(
          text("select version_num from alembic_version")).scalar() == HEAD)
boot.dispose()

print("\n=== 11. 0013 on a database the application already widened")
# The state 0013 has to survive, and the reason it is written with an inspector instead of
# as a bare `op.add_column`: `app/schema_sync.py` runs on every boot and adds any *nullable*
# column the models declare that the database lacks. A deployment that starts the new code
# before migrating it therefore arrives at `alembic upgrade head` with
# `student_profiles.age` already present, and an unguarded `ADD COLUMN` there is
# `duplicate column name: age` inside the container entrypoint — the app is healthy, the
# migration that follows cannot run, and every later revision is stuck behind it. This
# section performs the boot first and the migration second, in that order, with a typed age
# already written in between.
AGE_DB = pathlib.Path(tempfile.gettempdir()) / "careerguide_age_test.db"
if AGE_DB.exists():
    AGE_DB.unlink()
AGE_URL = f"sqlite:///{AGE_DB.as_posix()}"
os.environ["DATABASE_URL"] = AGE_URL
get_settings.cache_clear()
command.upgrade(cfg, TWELFTH)
aged = create_engine(AGE_URL)
with aged.begin() as conn:
    conn.execute(
        text("insert into users (id, role, display_name, preferred_language, is_active, "
             "created_at) values (1, 'student', 'Ishaan', 'en', 1, '2026-10-18 09:00:00')")
    )
    conn.execute(
        text("insert into student_profiles (user_id, class_level, age_range, interest_areas, "
             "created_at) values (1, 'class-10', '11-12', '[]', '2026-10-18 09:00:00')")
    )
check("it starts at 0012, where no age column exists yet",
      aged.connect().execute(
          text("select version_num from alembic_version")).scalar() == TWELFTH
      and "age" not in {column["name"] for column in inspect(aged).get_columns("student_profiles")},
      sorted(column["name"] for column in inspect(aged).get_columns("student_profiles")))
# The boot, called the way `scripts/db_init.py` and the app's own startup call it.
added = add_missing_columns(aged)
check("the application's own boot sync adds the column the new model declares",
      "student_profiles.age" in added, added)
boot_columns = [column for column in inspect(aged).get_columns("student_profiles")
                if column["name"] == "age"]
check("…as a nullable small integer, which is why the migration is allowed to consider "
      "skipping it",
      len(boot_columns) == 1 and boot_columns[0]["nullable"], boot_columns)
with aged.begin() as conn:
    conn.execute(text("update student_profiles set age = 14 where user_id = 1"))
    # The same window for the catalogue: the new code can certify a career row before the
    # migration reaches it, which is the only way a green badge gets a date the chain would
    # otherwise be about to erase by failing on a duplicate column.
    conn.execute(
        text("insert into careers (id, slug, title, category, summary, typical_activities, "
             "useful_skills, school_subjects, education_pathways, entry_requirements, "
             "preparation_stages, benefits, challenges, explore_activities, official_links, "
             "related_slugs, interest_themes, min_class, needs_verification, created_at) "
             "values (1, 'chartered-accountant', 'Chartered Accountant', 'commerce', 'A row "
             "the app put a source on', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', "
             "'[]', '[]', '[]', 6, 0, '2026-10-18 09:00:00')")
    )
    conn.execute(
        text("update careers set source_url = 'https://www.icai.org', "
             "verified_at = '2026-10-23 10:00:00' where id = 1")
    )
aged.dispose()

error = None
try:
    command.upgrade(cfg, "head")
except Exception as caught:  # noqa: BLE001 - reported as a failed check
    error = caught
check("so `upgrade head` runs instead of dying on a duplicate column", error is None,
      repr(error))
aged = create_engine(AGE_URL)
check("…and reaches the head, which is the only thing the entrypoint needs",
      aged.connect().execute(
          text("select version_num from alembic_version")).scalar() == HEAD,
      aged.connect().execute(text("select version_num from alembic_version")).scalar())
final_columns = [column for column in inspect(aged).get_columns("student_profiles")
                 if column["name"] == "age"]
check("…leaving exactly one age column rather than a second one beside it",
      len(final_columns) == 1, final_columns)
check("…with the age the student typed during that window still stored, because skipping "
      "the DDL is what protects the row",
      aged.connect().execute(
          text("select age, age_range from student_profiles where user_id = 1")
      ).all() == [(14, "11-12")],
      aged.connect().execute(text("select * from student_profiles")).all())
# The same boot sync adds *every* nullable column the current models declare, so this
# database reaches 0015 in exactly the state 0013 arrived at 0013 with: the column already
# there, written by the running code rather than by a revision. Without 0015's own guard the
# `upgrade head` above would have died on `duplicate column name: roadmap_json`, and the age
# checks would have passed while the plan column was the one that broke the chain.
check("…and the very same window is what 0015 has to survive, because boot sync widened "
      "the plan column too",
      "roadmap_json" in {column["name"]
                         for column in inspect(aged).get_columns("assessment_results")},
      sorted(column["name"] for column in inspect(aged).get_columns("assessment_results")))
plan_columns = [column for column in inspect(aged).get_columns("assessment_results")
                if column["name"] == "roadmap_json"]
check("…leaving exactly one plan column, nullable, after the chain ran over it",
      len(plan_columns) == 1 and plan_columns[0]["nullable"], plan_columns)
# 0016 is three nullable columns on two more tables, so the identical boot sync hands it the
# identical window. It is the newest revision, which means it is the one a laptop meets on the
# very first boot after a `git pull` — and an unguarded ALTER there would strand every revision
# written after it behind a `duplicate column name`.
check("…and 0016 met the same window on the catalogue tables, source column and all",
      {"source_url", "verified_at"} <= {column["name"]
                                       for column in inspect(aged).get_columns("careers")},
      sorted(column["name"] for column in inspect(aged).get_columns("careers")))
check("…on the scheme table too, where only the page is new and the date already had a name",
      "source_url" in {column["name"]
                       for column in inspect(aged).get_columns("scholarships")}
      and "verified_at" not in {column["name"]
                                for column in inspect(aged).get_columns("scholarships")},
      sorted(column["name"] for column in inspect(aged).get_columns("scholarships")))
duplicates = {f"{table}.{column}": len([item for item in inspect(aged).get_columns(table)
                                        if item["name"] == column])
              for table, column in [("careers", "source_url"), ("careers", "verified_at"),
                                    ("scholarships", "source_url")]}
check("…leaving exactly one of each, so a badge has one date and one page to read",
      all(count == 1 for count in duplicates.values()), duplicates)
check("…with the source the app recorded during that window still on the row, because "
      "skipping the DDL is what protects it",
      aged.connect().execute(
          text("select source_url, verified_at, needs_verification from careers where id = 1")
      ).all() == [("https://www.icai.org", "2026-10-23 10:00:00", 0)],
      aged.connect().execute(
          text("select source_url, verified_at, needs_verification from careers where id = 1")
      ).all())
aged.dispose()

os.environ["DATABASE_URL"] = URL
get_settings.cache_clear()

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
