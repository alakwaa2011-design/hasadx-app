---
name: Drizzle sql template array params
description: Passing a JS array into drizzle sql`` spreads it into a tuple ($1,$2), breaking ANY(::int[]) and VALUES.
---
Rule: never interpolate a JS array directly in drizzle sql`` — it renders as ($1, $2, ...), so `= ANY(${ids}::int[])` fails with 42846/42809.
**Why:** hit this in the welcome-credits backfill; error surfaces only at runtime against a real DB.
**How to apply:** use `IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})` or multi-row `VALUES ${sql.join(ids.map(id => sql`(${id}::int)`), sql`, `)}`.
