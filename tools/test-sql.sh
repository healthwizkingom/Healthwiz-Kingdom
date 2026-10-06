#!/bin/sh
# Runs every supabase/migrations/*.sql file, twice (they must be safe to run again), against a throwaway local
# PostgreSQL database, then the behaviour checks in supabase/tests/rls_checks.sql.
# Needs psql/createdb/dropdb for a local PostgreSQL 15+ (e.g. `apt install postgresql`). Usage: sh tools/test-sql.sh
# PSQL can name another client command, for example PSQL="sudo -u postgres psql" (then also CREATEDB / DROPDB).
set -e
cd "$(dirname "$0")/.."
PSQL=${PSQL:-psql}; CREATEDB=${CREATEDB:-createdb}; DROPDB=${DROPDB:-dropdb}; DB=${DB:-hw_sql_test}
$DROPDB --if-exists "$DB" >/dev/null 2>&1 || true
$CREATEDB "$DB"
run() { $PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1" 2>&1 | grep -v NOTICE || true; }
run supabase/tests/supabase_shim.sql
for f in supabase/migrations/*.sql; do echo "migration $f"; run "$f"; done
for f in supabase/migrations/*.sql; do run "$f"; done
$PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/rls_checks.sql 2>&1 | grep -E "PASSED|ERROR|error" 
$DROPDB "$DB"
