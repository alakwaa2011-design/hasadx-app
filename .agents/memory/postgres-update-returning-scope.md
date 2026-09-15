---
name: PostgreSQL UPDATE RETURNING scope
description: Prevent invalid atomic-update SQL when returning a decision derived from an UPDATE FROM source.
---

In PostgreSQL, an `UPDATE ... FROM ... RETURNING` clause must derive its output from the updated target row; do not reference a CTE or source-table alias from `FROM` inside `RETURNING`.

**Why:** Database execution rejects source aliases in this scope even though SQL-tag mocks and TypeScript accept the query, which can turn a protection check into a runtime 500.

**How to apply:** For atomic counters and rate limits, persist enough state on the target row to derive `allowed` and retry timing from that row in `RETURNING`. Cover the query with real PostgreSQL when changing its shape.