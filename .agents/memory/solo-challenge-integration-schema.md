---
name: Solo challenge integration schema
description: Integration suites may run against a legacy test database schema while the API runtime applies newer solo-challenge migrations.
---

Direct PostgreSQL integration tests for solo challenges must verify or apply the runtime-only columns and attempts table before exercising result persistence.

**Why:** The test database can lag behind the application schema, causing misleading failures before the behavior under test is reached.

**How to apply:** Keep the setup additive and scoped to the test database; use the API runtime migration as the source of truth and avoid production schema changes from the test itself.