---
name: Browser test database schema lag
description: Browser fixtures may run against a dedicated database whose schema is older than the current Drizzle definitions.
---

When a Playwright fixture fails during a Drizzle insert with a missing column, verify the dedicated test database schema before changing application code. Prefer fixture data that uses tables available in that database, or add the required test-database migration through the project’s normal migration path.

**Why:** The isolated browser database can lag behind the current application schema; an otherwise valid fixture then fails before the browser reaches the behavior under test.

**How to apply:** Keep targeted UI regressions independent of unrelated stale tables when possible, and treat schema errors during fixture setup separately from product failures.