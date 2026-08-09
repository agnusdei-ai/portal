#!/usr/bin/env bash
# Builds a migrated test database. Point TEST_DATABASE_URL at it to run
# tests/db.test.mjs, which exercises the schema rather than reading it.
set -euo pipefail
DB="${1:-portal_test}"
dropdb --if-exists "$DB"
createdb "$DB"
for f in tests/fixtures/platform.sql supabase/migrations/*.sql; do
  psql -q -d "$DB" -v ON_ERROR_STOP=1 --single-transaction -f "$f"
done
echo "ready: $DB"
