#!/bin/sh
# Restore a backup into a scratch database and prove it came back whole.
#
# Listing an archive proves it opens. Only a restore proves it restores, and the day
# to find out is not the day somebody needs it. This is the drill that
# docs/ARCHITECTURE_AND_TESTS.md §7 asks for once a quarter.
#
# The defaults are the safety model, not suggestions:
#
#   * the target must be PostgreSQL, and its host must be local unless
#     `--allow-remote` is passed — a scratch database is something you made for
#     this check, not the production instance;
#   * the target must not be the database this app is pointed at, and not
#     `postgres`/`template0`/`template1`;
#   * the target must have no user tables yet, because this restore never drops or
#     overwrites anything: restoring over a populated database is how a drill wipes
#     the thing it was meant to protect;
#   * an interactive run asks you to type the target database's name; `--yes` is
#     for CI and skips the prompt, but none of the refusals above.
#
# It never drops anything, never writes to the source database, and never prints a
# credential: the URL is masked in every message.
#
# Run from `backend/`:
#
#     ./scripts/restore_check.sh --from ~/.local/share/careerguide/backups/careerguide-….dump \
#                                --to postgresql://owner@127.0.0.1:5432/careerguide_restore_check
#
# What it checks after the restore:
#
#   * `pg_restore --exit-on-error --no-owner --no-privileges`, so a single failed
#     statement fails the drill instead of being counted as a warning;
#   * every table the archive lists is present in the target;
#   * every table's rows can be counted, and the total is above zero — an empty
#     restore that "succeeded" is the exact failure this exists to catch.

set -eu
umask 077

FROM=""
TO=""
YES=0
ALLOW_REMOTE=0

usage() {
  sed -n '/^set -eu/q;p' "$0"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="$2"; shift 2 ;;
    --to) TO="$2"; shift 2 ;;
    --yes) YES=1; shift ;;
    --allow-remote) ALLOW_REMOTE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
done

die() {
  echo "$1" >&2
  exit 1
}

mask() {
  # Same rule as backup_db.sh: only a URL carries a credential worth hiding.
  case "$1" in
    *://*@*)
      scheme=${1%%://*}
      printf '%s://****@%s\n' "$scheme" "$(printf '%s' "${1#*://}" | sed 's|^[^@]*@||')"
      ;;
    *) printf '%s\n' "$1" ;;
  esac
}

[ -n "$FROM" ] || die "Pass --from <archive>. Nothing was restored."
[ -n "$TO" ] || die "Pass --to <scratch database URL>. Nothing was restored."
[ -f "$FROM" ] || die "The archive $FROM does not exist. Nothing was restored."

for tool in pg_restore psql; do
  command -v "$tool" >/dev/null 2>&1 || die "\`$tool\` is not on PATH. Install the PostgreSQL client tools; nothing was restored."
done

case "$TO" in
  postgres://*|postgresql://*) ;;
  *) die "The target must be a postgres:// or postgresql:// URL. Nothing was restored." ;;
esac

# Split the URL without printing it: host and database name are enough for every refusal.
rest=${TO#*://}
rest=${rest#*@}
case "$rest" in
  */*) ;;
  *) die "The target URL names no database (…/<name>). Nothing was restored." ;;
esac
hostport=${rest%%/*}
dbpart=${rest#*/}
db=${dbpart%%\?*}
case "$hostport" in
  \[*\]:*) host=${hostport%%\]:*}; host=${host#\[} ;;
  *) host=${hostport%%:*} ;;
esac
case "$db" in
  postgres|template0|template1)
    die "Refusing to restore into the database \"$db\": it belongs to the server, not to this drill."
    ;;
esac

if [ "$ALLOW_REMOTE" != "1" ]; then
  case "$host" in
    localhost|127.0.0.1|::1|host.docker.internal) ;;
    *) die "The target host is \"$host\", not localhost. A scratch database is made here; if you really mean a remote scratch instance, pass --allow-remote. Nothing was restored." ;;
  esac
fi

# The exact production string, and the same host+database reached another way, are both refusals.
if [ -n "${DATABASE_URL:-}" ]; then
  prod_rest=${DATABASE_URL#*://}
  prod_rest=${prod_rest#*@}
  prod_hostport=${prod_rest%%/*}
  prod_dbpart=${prod_rest#*/}
  prod_db=${prod_dbpart%%\?*}
  prod_host=${prod_hostport%%:*}
  if [ "$TO" = "$DATABASE_URL" ]; then
    die "The target is DATABASE_URL itself. A drill never restores into the configured database."
  fi
  if [ "$host" = "$prod_host" ] && [ "$db" = "$prod_db" ]; then
    die "The target resolves to the same host and database as DATABASE_URL. Nothing was restored."
  fi
fi

pg_restore --list "$FROM" >/dev/null 2>&1 \
  || die "The archive $FROM cannot be read by pg_restore, so it is not a usable backup."

TABLE_LINES=$(pg_restore --list "$FROM" | awk '$4 == "TABLE" && $5 == "DATA" { print $6 " " $7 }')
[ -n "$TABLE_LINES" ] || die "The archive lists no table holding rows, which is not a backup of this app."

echo "archive    : $FROM"
echo "target     : $(mask "$TO")"
echo "expected   : $(printf '%s\n' "$TABLE_LINES" | wc -l | tr -d ' ') tables holding rows"

EXISTING=$(psql "$TO" -tAc "select count(*) from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema')") \
  || die "Could not reach the target database. Nothing was restored."
if [ "$EXISTING" != "0" ]; then
  die "The target already has $EXISTING user tables. This drill restores only into an empty scratch database; create a fresh one instead of restoring over this one."
fi

if [ "$YES" != "1" ]; then
  printf 'Type the target database name (%s) to confirm: ' "$db"
  confirm=""
  read -r confirm || die "No confirmation was read, so nothing was restored."
  [ "$confirm" = "$db" ] || die "Confirmation did not match. Nothing was restored."
fi

echo "restoring  : pg_restore --exit-on-error --no-owner --no-privileges"
pg_restore --exit-on-error --no-owner --no-privileges -d "$TO" "$FROM" \
  || die "pg_restore failed; the scratch database is incomplete. Drop and recreate it before trying again."

restored=0
rows_total=0
missing=""
while read -r schema table; do
  [ -n "$table" ] || continue
  present=$(psql "$TO" -tAc "select count(*) from information_schema.tables where table_schema = '$schema' and table_name = '$table'")
  if [ "$present" != "1" ]; then
    missing="$missing $schema.$table"
    continue
  fi
  rows=$(psql "$TO" -tAc "select count(*) from \"$schema\".\"$table\"") \
    || die "The table $schema.$table exists but cannot be read. The restore is not usable."
  restored=$((restored + 1))
  rows_total=$((rows_total + rows))
done <<EOF
$TABLE_LINES
EOF

if [ -n "$missing" ]; then
  die "The restore is incomplete; missing tables:$missing"
fi
[ "$restored" -gt 0 ] || die "No tables were found in the target after the restore."
[ "$rows_total" -gt 0 ] || die "Every restored table is empty, which means the archive carried no data."

echo "verified   : $restored tables present, $rows_total rows readable"
echo
echo "The drill passed. This script never drops anything — when the evidence has been"
echo "recorded, drop the scratch database yourself from a connection to another database,"
echo "e.g. psql -d postgres -c 'drop database \"$db\"'."
