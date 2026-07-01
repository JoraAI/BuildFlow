#!/usr/bin/env bash
# Reset isolated test DB and run backend integration tests.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash scripts/ensure-test-db.sh

echo "Resetting test database (migrate + seed)..."
export DATABASE_URL="postgresql://buildflow:buildflow@localhost:5432/buildflow_test?schema=public"
pnpm --filter @buildflow/backend exec prisma migrate reset --force

echo "Running backend tests..."
pnpm --filter @buildflow/backend test
