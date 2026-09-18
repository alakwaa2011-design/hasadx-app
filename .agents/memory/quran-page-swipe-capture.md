---
name: Quran page swipe capture
description: Non-obvious constraints for reliable touch page turns in the Madani page reader.
---

The page reader's swipe listener must attach after the asynchronous loading view is replaced by the real reader surface. Quran words and ayah markers are interactive elements but remain valid swipe origins; exclude only gestures that start outside the rendered Quran page.

**Why:** Attaching while the loading screen was rendered left no reader element to observe, and a broad interactive-element exclusion silently rejected every swipe that began on Quran text.

**How to apply:** When changing reader loading, rendering, or word interaction, preserve post-loading native capture and the distinction between Quran-page controls and toolbar/form controls. Verify both directions with real touch input and ensure the ending tap does not turn a second page.