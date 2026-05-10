#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Apply idempotent SQL migrations BEFORE `drizzle-kit push` so column
# renames don't get treated as drop+add (which would lose data and
# prompt for input under a closed stdin). Each file in
# `scripts/migrations/` must be safe to re-run.
if [ -d scripts/migrations ]; then
  for f in scripts/migrations/*.sql; do
    [ -e "$f" ] || continue
    echo "Applying $f"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
  done
fi

pnpm --filter db push
