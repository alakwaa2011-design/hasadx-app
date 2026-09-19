---
name: Mobile viewport geometry
description: Reliable viewport-bound assertions for Playwright tests using emulated mobile devices.
---

For mobile geometry checks, compare `boundingBox()` coordinates with the page's live `window.innerWidth` and `window.innerHeight`, and separately assert the live width is within the intended mobile limit.

**Why:** A device profile can retain mobile screen and viewport metrics that differ from a narrower size requested at the spec level. Hardcoded geometry limits can then fail even when the element is fully visible in the emulated browser.

**How to apply:** Read the live CSS viewport in the page before checking whether controls are on-screen. Keep an explicit upper-bound assertion so the test still proves it ran at a mobile width.

For aspect-ratio geometry, avoid division inside CSS `calc()` when the result must be reliable in the managed Chromium run. Use a precomputed decimal multiplier and assert the rendered ratio from `getBoundingClientRect()`.

**Why:** A `calc(100dvh * width / height)` expression fell back to content-driven width in the mobile browser even though the stylesheet parsed, so bounds-only checks missed a stretched Mushaf page.

**How to apply:** Use `calc(100dvh * <precomputed-ratio>)`, set `min-width: 0` on content-sized flex/grid descendants, and verify ratio plus child containment/non-overlap.