#!/bin/sh
# Take a backup of the database this app is pointed at.
#
# Why a script rather than "somebody remembers": every screen a child has filled in — the
# questionnaire answers, the conversation, the observations a recommendation cites — lives
# in one Postgres database, and the schema has no second copy. `docker-compose.yml` puts it
# on a named volume, which survives a container being recreated and does not survive a disk
# or a `docker volume rm`. A backup is the difference between those two sentences.
#
# What it writes is a PostgreSQL *custom-format* archive (`pg_dump -Fc`), because that is the
# only format that is both compressed and selective: `pg_restore --list` shows the tables, and
# a restore can bring back one table instead of the whole database. A plain `.sql` dump cannot
# do that, and `tar`-ing the data directory only works on a database that is not running.
#
# Three ways to point it at a database, tried in this order:
#
#   1. `DATABASE_URL` — the app's own variable, so the backup follows the same setting that
#      decides what the API reads. It is read from `backend/.env` when the shell does not
#      already have it, because a scheduled job has no terminal that sourced one.
#      `postgresql://` and `postgresql+psycopg://` both work; the driver prefix is stripped,
#      since that is Python's business and not libpq's.
#   2. The standard libpq variables (`PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`), or the
#      `POSTGRES_*` names `docker-compose.yml` uses, which are mapped onto them. This is what
#      the `db-backup` service in compose relies on, because inside that container there is no
#      `.env` to read and no reason to duplicate one.
#   3. The running stack: find the database container with `docker ps`, run `pg_dump` inside it
#      with that container's own credentials, and copy the archive out with `docker cp`. The
#      fallback for a laptop where nobody has `pg_dump` installed — which is the common case on
#      Windows, and the reason this script refuses to pretend otherwise.
#
# Nothing here prints a password. The URL is masked in every message, the same way
# `scripts/db_init.py` masks it.
#
# Run from `backend/`:
#
#     ./scripts/backup_db.sh                      # into ./backups, keep the last 14
#     ./scripts/backup_db.sh --dest /mnt/nas/careerguide --keep 30
#     ./scripts/backup_db.sh --dry-run            # what it would do, and to what database
#
# Then schedule it — see README §"Backing up the database" for the cron line. A backup that
# only exists because somebody remembered to run it is not a backup.

set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DEST="${BACKUP_DIR:-$ROOT/backups}"
KEEP="${BACKUP_KEEP:-14}"
PREFIX="careerguide"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DRY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dest) DEST="$2"; shift 2 ;;
    --keep) KEEP="$2"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) sed -n '/^set -eu/q;p' "$0"; exit 0 ;;
    *) echo "unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
done

mask() {
  # Keep the host and the database name, hide the credential. Only a URL has a credential
  # in it: `127.0.0.1:5432/careerguide` is a libpq target whose colon separates a host from
  # a *port*, and printing it as `127.0.0.1:****@5432/…` would be worse than printing it —
  # it would look like a masked secret and hide nothing.
  case "$1" in
    *://*@*)
      head=$(printf '%s' "$1" | cut -d: -f1)
      tail=$(printf '%s' "$1" | cut -d: -f2-)
      printf '%s:****@%s\n' "$head" "$(printf '%s' "$tail" | sed 's|^//[^@]*@|//|')"
      ;;
    *) printf '%s\n' "$1" ;;
  esac
}

# `.env` is where the URL actually lives on a laptop and in the compose file's own host, and
# a scheduled job has no shell that sourced it. Read the one key, rather than sourcing the
# file: an entry with a space or a `#` in it must not be able to run a command here.
if [ -z "${DATABASE_URL:-}" ] && [ -f "$ROOT/.env" ]; then
  DATABASE_URL=$(sed -n 's/^DATABASE_URL=//p' "$ROOT/.env" | tail -1 | tr -d '"' | tr -d "'" || true)
  export DATABASE_URL
fi

TARGET=""
MODE=""
DUMPFILE="$DEST/$PREFIX-$STAMP.dump"

if [ -n "${DATABASE_URL:-}" ]; then
  case "$DATABASE_URL" in
    sqlite*)
      # `sqlite:///./careerguide.db`, `sqlite:///C:\…\careerguide.db`, and a bare file name
      # all mean the same thing to SQLAlchemy. Three slashes and an optional host are the
      # only part to strip, and the path has to survive intact for the command to be usable.
      echo "This is a SQLite database, and pg_dump does not apply to it." >&2
      echo "Back the file up instead, with the app not writing to it:" >&2
      echo "    sqlite3 $(printf '%s' "$DATABASE_URL" | sed 's|^sqlite://[^/]*/*||') \".backup '$DEST/$PREFIX-$STAMP.sqlite'\"" >&2
      echo "(or stop the API and copy the file). Then set DATABASE_URL to the Postgres URL.)" >&2
      exit 1
      ;;
    postgres*)
      TARGET=$(printf '%s' "$DATABASE_URL" | sed 's/^postgresql+psycopg:/postgres:/')
      MODE="url"
      ;;
    *)
      echo "DATABASE_URL is neither a postgres:// nor a sqlite URL — refusing to guess." >&2
      exit 1
      ;;
  esac
else
  # The compose names, if that is how the stack was configured, mapped onto libpq's own.
  [ -z "${PGHOST:-}" ] && [ -n "${POSTGRES_HOST:-}" ] && PGHOST="$POSTGRES_HOST"
  [ -z "${PGUSER:-}" ] && [ -n "${POSTGRES_USER:-}" ] && PGUSER="$POSTGRES_USER"
  [ -z "${PGDATABASE:-}" ] && [ -n "${POSTGRES_DB:-}" ] && PGDATABASE="$POSTGRES_DB"
  [ -z "${PGPASSWORD:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ] && PGPASSWORD="$POSTGRES_PASSWORD"
  [ -z "${PGPORT:-}" ] && [ -n "${POSTGRES_PORT:-}" ] && PGPORT="$POSTGRES_PORT"
  if [ -n "${PGDATABASE:-}" ] && [ -n "${PGHOST:-}" ]; then
    TARGET="${PGHOST}:${PGPORT:-5432}/${PGDATABASE}"
    MODE="libpq"
  fi
fi

if [ -z "$MODE" ] && command -v docker >/dev/null 2>&1; then
  # Last resort, and the one that works on a machine with no PostgreSQL client installed: run
  # the dump inside the container that has one, and copy the archive out.
  #
  # `docker ps`, deliberately, rather than `docker compose ps`: compose needs to be run from the
  # project directory with the same `.env` present to even parse the file, and a scheduled job
  # has neither. A running container's name is readable from anywhere.
  CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -i postgres | head -1 || true)
  if [ -n "$CONTAINER" ]; then
    TARGET="docker:$CONTAINER"
    MODE="container"
  fi
fi

if [ -z "$MODE" ]; then
  echo "No database to back up: DATABASE_URL is unset, no PG*/POSTGRES_* environment, and no" >&2
  echo "running container named like a postgres one that \`docker ps\` can see." >&2
  echo "Run it from a machine that has the stack up, or point DATABASE_URL at the database." >&2
  exit 1
fi

if [ "$MODE" != "container" ] && ! command -v pg_dump >/dev/null 2>&1; then
  echo "\`pg_dump\` is not on PATH, and the dump cannot be made from outside the database" >&2
  echo "container. Either install the PostgreSQL client tools, or run this where the compose" >&2
  echo "stack's \`db-backup\` service runs it for you (see docker-compose.yml)." >&2
  exit 1
fi

echo "database   : $(mask "$TARGET")"
echo "destination: $DUMPFILE"
if [ "$DRY" = "1" ]; then
  echo "dry run    : nothing was written"
  exit 0
fi

mkdir -p "$DEST"

# `--no-owner --no-privileges` belong to the *restore* rather than the dump, so the archive keeps
# the roles it was taken from and can be read on a server where those names mean something else.
#
# `TOC` is the archive's own table of contents, read back with `pg_restore --list` — inside the
# database container when the dump was made there, so the laptop path verifies its backup too
# instead of skipping the check because Windows has no PostgreSQL client installed.
TOC=""
case "$MODE" in
  url)
    pg_dump --format=custom --file="$DUMPFILE" "$TARGET"
    if command -v pg_restore >/dev/null 2>&1; then TOC=$(pg_restore --list "$DUMPFILE"); fi
    ;;
  libpq)
    pg_dump --format=custom --file="$DUMPFILE"
    if command -v pg_restore >/dev/null 2>&1; then TOC=$(pg_restore --list "$DUMPFILE"); fi
    ;;
  container)
    # The container's own POSTGRES_* variables are what `docker exec` inherits, so no
    # credential is ever written into this script's command line or into a host file.
    #
    # Every path below is inside a single-quoted `sh -c` string on purpose. Passed as a bare
    # argument, Git Bash rewrites `/tmp/…` into `C:\Users\…\Temp\…` before docker ever sees it,
    # and the container then looks for a Windows path: `pg_dump` wrote its archive happily and
    # `pg_restore --list` failed on the very next line. One quoted command string, converted
    # nowhere.
    docker exec "$CONTAINER" sh -c \
      'pg_dump --format=custom --file=/tmp/careerguide-backup.dump "postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5432/$POSTGRES_DB"'
    TOC=$(docker exec "$CONTAINER" sh -c 'pg_restore --list /tmp/careerguide-backup.dump' || true)
    docker cp "$CONTAINER:/tmp/careerguide-backup.dump" "$DUMPFILE"
    docker exec "$CONTAINER" sh -c 'rm -f /tmp/careerguide-backup.dump'
    ;;
esac

BYTES=$(wc -c < "$DUMPFILE" | tr -d ' ')
if [ "$BYTES" -lt 1024 ]; then
  # A custom-format archive of a database that has the catalogue in it is never this small,
  # and a truncated file is worse than no file, because it restores into nothing.
  echo "The dump is $BYTES bytes, which is not a backup of this application. Keeping it as" \
    "$DUMPFILE.failed and failing." >&2
  mv "$DUMPFILE" "$DUMPFILE.failed"
  exit 1
fi

# An archive nobody has opened is a rumour about a backup. `--list` reads the TOC the same way
# a restore does, so this catches a truncated or corrupt file now rather than on the day it is
# needed.
if [ -n "$TOC" ]; then
  # The line is `<dump id>; <catalog id> <oid> TABLE DATA <schema> <table> <owner>`, so the object
  # type is not at the start of it: a pattern anchored at `^` matched nothing and failed every
  # good backup when this was first written.
  TABLES=$(printf '%s\n' "$TOC" | grep -c 'TABLE DATA' || true)
  OBJECTS=$(printf '%s\n' "$TOC" | grep -c '^[0-9]' || true)
  echo "verified   : $BYTES bytes, $OBJECTS archive entries, $TABLES of them holding rows"
  if [ "$TABLES" -lt 1 ]; then
    echo "The archive lists no table holding rows. Either this database is empty — it should have" \
      "the career catalogue in it — or the file is not a usable archive." >&2
    exit 1
  fi
else
  echo "verified   : $BYTES bytes, and nothing opened the archive to read it back — there is no" \
    "pg_restore where this ran. Do the first restore on a scratch database before you trust it." >&2
fi

# Rotation happens after the new file is proven, so a failed run can never be the reason the
# last good backup disappeared. Only files this script wrote are counted, and only in $DEST.
if [ "$KEEP" -gt 0 ] 2>/dev/null; then
  COUNT=$(ls -1 "$DEST/$PREFIX-"*.dump 2>/dev/null | wc -l | tr -d ' ')
  if [ "$COUNT" -gt "$KEEP" ]; then
    ls -1 "$DEST/$PREFIX-"*.dump | head -n $((COUNT - KEEP)) | while read -r OLD; do
      echo "rotated out: $OLD"
      rm -f "$OLD"
    done
  fi
  echo "retained   : $(ls -1 "$DEST/$PREFIX-"*.dump 2>/dev/null | wc -l | tr -d ' ') dumps in $DEST (keeping $KEEP)"
fi

echo
echo "Restore into a database of your choosing (it does not have to be empty, but a fresh one"
echo "is easier to reason about than a merge):"
echo "    pg_restore --clean --if-exists --no-owner -d <DATABASE_URL> $DUMPFILE"
echo
echo "The file holds children's names, answers and conversations. Move it off this machine and"
echo "keep it somewhere with its own access control; a backup on the same disk as the database"
echo "protects against a bad DELETE and nothing else."
