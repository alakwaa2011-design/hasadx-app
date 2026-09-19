---
name: Quran page swipe capture
description: Non-obvious constraints for reliable touch page turns in the Madani page reader.
---

The page reader's swipe listener must attach after the asynchronous loading view is replaced by the real reader surface. Quran words and ayah markers are interactive elements but remain valid swipe origins; exclude only gestures that start outside the rendered Quran page.

**Why:** Attaching while the loading screen was rendered left no reader element to observe, and a broad interactive-element exclusion silently rejected every swipe that began on Quran text.

**How to apply:** When changing reader loading, rendering, or word interaction, preserve post-loading native capture and the distinction between Quran-page controls and toolbar/form controls. Verify both directions with real touch input and ensure the ending tap does not turn a second page.

WebKit E2E may render a page-image fallback when the remote QCF font cannot load, so swipe tests must use interactive word coordinates when available and a visible page-surface coordinate otherwise.

**Why:** The iPhone WebKit project can load the page image while the font-backed word buttons remain unavailable; requiring a button would skip the actual page-surface gesture coverage.

**How to apply:** Keep WebKit coverage independent of external font availability, while retaining the button-origin path for Chromium and font-ready WebKit runs.