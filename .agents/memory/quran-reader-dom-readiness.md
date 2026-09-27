---
name: Quran reader DOM readiness
description: Prevents race conditions when testing Quran reader controls before its local chapter and page data has loaded.
---

Quran reader tests should wait for a loaded reader element such as the page selector before asserting toolbar controls. The initial loading screen is expected while local Quran JSON modules resolve.

**Why:** The reader loads chapter, page, verse, and part data asynchronously; immediate header assertions can inspect only the loading screen and fail intermittently.

**How to apply:** In component tests that mount the shared Quran reader, await a stable loaded-state selector before checking the header or interacting with page-layout controls.