---
name: Drizzle correlated subquery qualification
description: Correlated SQL subqueries need explicit table qualification when built with Drizzle sql templates.
---

Do not interpolate a Drizzle table column directly inside a correlated `sql`` ` subquery when the outer table must be qualified; `${assignmentsTable.id}` can render as `"id"` instead of `"assignments"."id"`. Use an explicit stable qualifier or a deliberate SQL alias, and inspect `toSQL()` for correlated queries.

**Why:** A duplicate-cleanup count once compared `submissions.assignment_id` with the submission row's unqualified `id`, so used assignments appeared unused and could be offered for archival.

**How to apply:** For every correlated count or existence check, verify the generated SQL and add an integration assertion with a related child row, not only an empty-parent case.