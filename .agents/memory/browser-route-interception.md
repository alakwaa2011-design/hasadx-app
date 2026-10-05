---
name: Service-worker route interception
description: Why mocked API responses and simulated failures can silently miss app requests in browser tests.
---

Block service workers in browser contexts that mock API responses or simulate HTTP failures with Playwright route handlers.

**Why:** An authenticated directory error test sent its request successfully to the server while even a catch-all `page.route` handler was never invoked. The app's service worker owned the fetch; disabling it restored interception.

**How to apply:** Use `test.use({ serviceWorkers: "block" })` or `browser.newContext({ serviceWorkers: "block" })` before loading the app when checks depend on interception. This also applies to fixture-backed layout screenshots: unmatched handlers can otherwise produce misleading missing-session or missing-deck errors. Do not disable service workers in tests whose purpose is to verify offline or service-worker behavior.