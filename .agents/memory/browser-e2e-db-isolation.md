---
name: Browser E2E database isolation
description: Browser tests that seed data must run the frontend and API against the same dedicated test database.
---

Run browser E2E fixtures only through the isolated API and Vite servers configured for the test database; never point a fixture-writing browser test at the shared application server.

**Why:** Fixture setup and the browser-facing API must see the same records, while deleting test data from a shared application database is unsafe even with unique identifiers.

**How to apply:** Require a non-empty `TEST_DATABASE_URL` that differs from `DATABASE_URL`, then pass that test URL to both the Playwright workers and the API server launched for the suite.