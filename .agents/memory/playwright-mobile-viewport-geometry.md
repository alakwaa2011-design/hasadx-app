---
name: Mobile viewport geometry
description: Reliable viewport-bound assertions for Playwright tests using emulated mobile devices.
---

For mobile geometry checks, compare `boundingBox()` coordinates with the page's live `window.innerWidth` and `window.innerHeight`, and separately assert the live width is within the intended mobile limit.

**Why:** A device profile can retain mobile screen and viewport metrics that differ from a narrower size requested at the spec level. Hardcoded geometry limits can then fail even when the element is fully visible in the emulated browser.

**How to apply:** Read the live CSS viewport in the page before checking whether controls are on-screen. Keep an explicit upper-bound assertion so the test still proves it ran at a mobile width.