---
name: drizzle-kit push hangs on interactive prompt
description: drizzle-kit push/push-force can hang on an interactive TUI prompt (e.g. constraint name drift) with no way to answer via piped stdin; psql fallback for simple additive changes.
---

`pnpm --filter @workspace/db run push` (or `push-force`) can hang indefinitely when drizzle-kit
detects an ambiguous schema change (e.g. a unique constraint name that drifted from its
auto-generated name) and prompts an interactive yes/no/rename choice. This TUI prompt cannot be
answered through piped/non-interactive stdin, so the command just hangs.

**Why:** drizzle-kit's interactive resolver assumes a real TTY; in the agent shell there is none,
so the process blocks forever waiting for input that will never arrive.

**How to apply:** For simple, purely-additive schema changes (e.g. adding one nullable/defaulted
column), apply the column directly via `psql "$DATABASE_URL" -c "ALTER TABLE ... ADD COLUMN IF NOT
EXISTS ...;"` as a fallback, then verify with `\d <table>`. Don't try to resolve the interactive
prompt via stdin tricks. This is a workaround for one column, not a substitute for drizzle-kit —
prefer it to unblock, not as a permanent migration strategy. After any schema.ts change (via either
path), still run `pnpm run typecheck:libs` before typechecking dependent artifacts, or they'll show
stale "property does not exist" errors against the old generated types.
