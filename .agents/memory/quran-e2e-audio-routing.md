---
name: Quran E2E audio routing
description: Service Worker isolation needed for Playwright timing and audio mocks in authenticated Quran reader sessions
---

Playwright Quran reader contexts that mock timing/audio requests should block Service Workers.

**Why:** Without Service Worker isolation, the browser can issue direct audio requests that appear in page request logs but bypass page-level route handlers, leaving deterministic timing fixtures unused.

**How to apply:** Create the authenticated reader BrowserContext with `serviceWorkers: "block"` before installing Quran audio routes; keep guest/catalog checks separate when they need the normal browser behavior.