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

For authenticated flows that need real records, prefer seeding the isolated database over page-level API interception; the proxied Vite request can still receive the backend response even when a page route appears configured.

**Why:** An admin student-preview test initially received an empty public-assignment response despite a matching page route, while a real assignment fixture exercised the same authenticated API path reliably.

**How to apply:** Use browser routing only for deliberately mocked, service-worker-safe checks; use isolated DB fixtures for role/session and persistence assertions.

An isolated test database can still be unusable when its schema predates the checked-in Drizzle schema; fixture inserts then fail before the browser flow starts.

**Why:** E2E failures from missing columns can look like a product regression even though the app and test code never reach the route under test.

**How to apply:** When E2E setup fails on a missing relation or column, report the stale test schema separately and do not alter product code or point fixtures at the shared database to bypass it.

Keep the isolated browser-test Vite server's dependency cache separate from the managed preview server.

**Why:** Concurrent servers using the same optimized-dependency cache can invalidate each other's module URLs and return `504 Outdated Optimize Dep`. The app's chunk-error screen then says a new update is available even though the failure is a cache collision, not a platform notice.

**How to apply:** Use a distinct test-only Vite cache directory. When an isolated browser run shows the update screen, inspect module network failures before attributing it to Replit or altering application behavior.

A successful shell request to an isolated localhost server does not prove that the testing browser can reach that server.

**Why:** The fixture API and Vite returned successful shell health checks, but the testing browser could not connect to the unrouted fixture port and never rendered the application.

**How to apply:** Verify browser reachability before creating authenticated fixtures. Use a browser-accessible routed test surface; report connection failures as infrastructure blockers rather than product failures or passing UI checks.