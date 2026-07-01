#!/usr/bin/env bash
# Ensure buildflow_test database exists (local Docker Postgres).
set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGUSER="${PGUSER:-buildflow}"
PGPASSWORD="${PGPASSWORD:-buildflow}"
export PGPASSWORD

exists=$(psql -h "$PGHOST" -U "$PGUSER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname = 'buildflow_test'" 2>/dev/null || echo "")

if [ "$exists" != "1" ]; then
  echo "Creating database buildflow_test..."
  psql -h "$PGHOST" -U "$PGUSER" -d postgres -c "CREATE DATABASE buildflow_test;"
else
  echo "Database buildflow_test already exists."
fi
