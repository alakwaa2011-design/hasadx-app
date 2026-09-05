---
name: Concurrent Vite E2E reloads
description: Why isolated Playwright runs can navigate unexpectedly while the managed frontend preview is also running.
---

Do not run the homework app's managed Vite preview and its isolated Playwright Vite server concurrently from the same workspace.

**Why:** Both servers can touch the shared dependency-optimization cache. The test page then reconnects or fully reloads during assertions, producing misleading zero-element counts and destroyed execution contexts even when the tested UI is correct.

**How to apply:** Stop the managed frontend preview before database-isolated browser tests, run the targeted suite, then restart the managed workflow afterward.