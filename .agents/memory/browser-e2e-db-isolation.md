---
name: Browser E2E database isolation
description: Browser tests that seed data must run the frontend and API against the same dedicated test database.
---

Run browser E2E fixtures only through the isolated API and Vite servers configured for the test database; never point a fixture-writing browser test at the shared application server.

**Why:** Fixture setup and the browser-facing API must see the same records, while deleting test data from a shared application database is unsafe even with unique identifiers.

**How to apply:** Require a non-empty `TEST_DATABASE_URL` that differs from `DATABASE_URL`, then pass that test URL to both the Playwright workers and the API server launched for the suite.

For browser-only visual checks with mocked API responses, block service workers and install API interception on the browser context before creating the page.

**Why:** Page-level interception alone appeared to match a mocked game request, yet the app still received a real unauthorized response. A fresh context with service workers blocked and context-level routes produced the intended isolated preview.

**How to apply:** Use `browser.newContext({ serviceWorkers: "block" })` and `context.route(...)` for fixture-only screenshots; intercept all API calls and do not seed the shared database.