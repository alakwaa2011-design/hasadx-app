---
name: Date-only OpenAPI fields
description: Keep local calendar dates stable between generated clients and PostgreSQL date columns.
---

OpenAPI `format: date` fields are generated as JavaScript `Date` values by the current client generator. For dates that represent a local calendar day rather than an instant, define them as strings with an explicit `YYYY-MM-DD` pattern.

**Why:** Serializing a generated `Date` adds a timezone-bearing timestamp, which can fail strict server validation or shift the displayed day for teachers.

**How to apply:** Use a string pattern in the OpenAPI contract and validate the same pattern at the route boundary; keep the database column as `DATE`.