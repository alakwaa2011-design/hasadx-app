---
name: PostgreSQL parameter inference
description: Why nullable raw SQL predicates need explicit types and real database regression coverage
---

Each Drizzle SQL interpolation becomes a separate PostgreSQL parameter, even when the same JavaScript value appears elsewhere in the query. A standalone nullable parameter used only with `IS NULL` needs an explicit cast matching its domain; a neighbouring column comparison does not supply its type.

**Why:** video lease recovery failed at PostgreSQL statement preparation despite passing mock-based recovery tests. PostgreSQL must infer every parameter type before evaluating either branch, so a non-null lease does not avoid the error.

**How to apply:** keep lease ownership and expiry predicates unchanged when correcting type inference. Exercise both null and populated parameters against real PostgreSQL in the isolated integration suite; a test filename containing “integration” does not prove it bypasses the default database mock.