---
name: Runtime schema migrations required
description: Any new table/column must be added to runSchemaMigrations in the api-server entrypoint, not just Drizzle schema files.
---
Rule: whenever a Drizzle schema file gains a table or column, add a matching idempotent SQL block (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS + indexes/FKs) to `runSchemaMigrations` in the api-server entrypoint.

**Why:** existing/production databases only get schema updates through these runtime migrations; Drizzle schema alone leaves prod failing with "column/table does not exist". A completion review rejected a feature for exactly this gap.

**How to apply:** kicks in on any additive schema change; verify after restart that migration INFO lines appear in the api-server log and the affected endpoints return non-500.
