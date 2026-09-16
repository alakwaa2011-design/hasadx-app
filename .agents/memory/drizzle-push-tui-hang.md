---
name: drizzle-kit push hangs on interactive prompt
description: drizzle-kit push/push-force can stop on an interactive rename prompt; apply only the verified additive DDL through the development database tool.
---

`pnpm --filter @workspace/db run push` (or `push-force`) can stop when drizzle-kit guesses that a
new table or constraint may be a rename of an unrelated existing object. `--force` does not answer
this rename question in the non-interactive agent shell.

**Why:** drizzle-kit's interactive resolver assumes a real TTY; in the agent shell there is none,
so the process blocks forever waiting for input that will never arrive.

**How to apply:** Never accept an ambiguous rename guess. For a verified, purely additive change,
apply only the explicit `CREATE ... IF NOT EXISTS` or `ALTER ... ADD ...` statements through the
development database tool, then query `information_schema` or `pg_catalog` to confirm the result.
Keep the Drizzle schema as the deployment source of truth. After a schema change, run
`pnpm run typecheck:libs` before dependent artifact checks so generated declarations are current.
