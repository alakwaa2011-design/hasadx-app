---
name: Quran page swipe capture
description: Non-obvious constraints for reliable touch page turns in the Madani page reader.
---

The page reader's swipe listener must attach after the asynchronous loading view is replaced by the real reader surface. Quran words, ayah markers, and the paged shell's surrounding paper area are valid swipe origins; exclude only toolbar/form controls.

**Why:** Attaching while the loading screen was rendered left no reader element to observe, and a broad interactive-element exclusion silently rejected every swipe that began on Quran text.

**How to apply:** When changing reader loading, rendering, or word interaction, preserve post-loading pointer capture and the distinction between Quran-page controls and toolbar/form controls. Pointer capture can fail in embedded browsers, so dragging must still work through bubbling events. Verify both directions and ensure the ending tap does not turn a second page. Remove arrival-animation classes on animation end so fill-mode does not leave a persistent transform.

WebKit E2E may render a page-image fallback when the remote QCF font cannot load, so swipe tests must use interactive word coordinates when available and a visible page-surface coordinate otherwise.

**Why:** The iPhone WebKit project can load the page image while the font-backed word buttons remain unavailable; requiring a button would skip the actual page-surface gesture coverage.

**How to apply:** Keep WebKit coverage independent of external font availability, while retaining the button-origin path for Chromium and font-ready WebKit runs.

In browser gesture checks, dismiss the first-visit Quran tutorial before starting a touch on page text, even if the page is reported visible.

**Why:** A visible page can be underneath the tutorial. Coordinate-based touch input hits the overlay instead, so a swipe appears broken without ever reaching the reader.

**How to apply:** Close the tutorial before measuring word/page touch coordinates; distinguish a gesture failure from an overlay intercept when investigating a failed mobile test.