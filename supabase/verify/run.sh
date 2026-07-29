#!/usr/bin/env bash
#
# Replays the whole migration chain into a throwaway local Postgres and asserts
# the rules against it.
#
# Usage:  supabase/verify/run.sh [--port 5433] [--keep] [--schema-only]
#
#   --keep         leave the database in place afterwards
#   --schema-only  apply the chain and stop, without running the suites. This is
#                  what http.sh wants: a pristine database its own seed can build
#                  on, rather than one the suites have already put fixtures in.
#
# Requires postgresql-17 installed locally. Nothing here touches the hosted
# project; the database named below is dropped and rebuilt on every run.
set -euo pipefail

PORT=5433
KEEP=0
SUITES=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    --schema-only) SUITES=0; KEEP=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../migrations"
DB=vistrial_verify
PG_SHARE=$(pg_config --sharedir 2>/dev/null || echo /usr/share/postgresql/17)

psql_run() { sudo -u postgres psql -p "$PORT" -v ON_ERROR_STOP=1 -q "$@"; }

if ! sudo -u postgres psql -p "$PORT" -tAc 'select 1' >/dev/null 2>&1; then
  echo "No Postgres listening on port $PORT." >&2
  echo "Start one, for example:" >&2
  echo "  sudo -u postgres /usr/lib/postgresql/17/bin/pg_ctl -D /var/lib/postgresql/17/main \\" >&2
  echo "    -o '-c config_file=/etc/postgresql/17/main/postgresql.conf -p $PORT' start" >&2
  exit 1
fi

# pg_cron cannot be installed without shared_preload_libraries, and the chain
# schedules jobs. This records schedules and runs nothing, which is all the
# migrations need from it.
sudo cp "$HERE/local/pg_cron.control" "$PG_SHARE/extension/pg_cron.control"
sudo cp "$HERE/local/pg_cron--1.6.sql" "$PG_SHARE/extension/pg_cron--1.6.sql"

echo "Rebuilding $DB on port $PORT"
sudo -u postgres psql -p "$PORT" -q -v ON_ERROR_STOP=1 \
  -c "drop database if exists $DB with (force)" -c "create database $DB"

psql_run -d "$DB" -f "$HERE/local/shim.sql" >/dev/null

for file in "$MIGRATIONS"/*.sql; do
  name="$(basename "$file")"

  # The document generation subsystem is live on the hosted project but was never
  # exported to migrations/, and 20260726221532 policies it. Stand it up first so
  # the chain can reach the end. See local/document_stub.sql.
  if [[ "$name" == 20260726221532_* ]]; then
    psql_run -d "$DB" -f "$HERE/local/document_stub.sql" >/dev/null
    printf '  %-64s ok\n' '(stub) document subsystem'
  fi

  if psql_run -d "$DB" -f "$file" >/tmp/vistrial-verify.out 2>&1; then
    printf '  %-64s ok\n' "$name"
  else
    printf '  %-64s FAILED\n' "$name"
    cat /tmp/vistrial-verify.out
    exit 1
  fi
done

if [[ $SUITES -eq 1 ]]; then
  echo
  for suite in "$HERE"/suites/*.sql; do
    echo "== $(basename "$suite")"
    if ! psql_run -d "$DB" -f "$suite"; then
      echo "suite failed: $(basename "$suite")" >&2
      exit 1
    fi
  done
fi

if [[ $KEEP -eq 0 ]]; then
  sudo -u postgres psql -p "$PORT" -q -c "drop database if exists $DB with (force)"
else
  echo "Kept $DB for inspection."
fi
