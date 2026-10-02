---
name: Service-worker route interception
description: Why simulated network failures can silently miss app requests in browser tests.
---

Block service workers in browser contexts that simulate HTTP failures with Playwright route handlers.

**Why:** An authenticated directory error test sent its request successfully to the server while even a catch-all `page.route` handler was never invoked. The app's service worker owned the fetch; disabling it restored interception.

**How to apply:** Use `test.use({ serviceWorkers: "block" })` for tests that depend on interception. Do not disable service workers in tests whose purpose is to verify offline or service-worker behavior.