---
name: Quran ayah action ergonomics
description: Confirmed interaction model for ayah actions and recitation controls across phone and desktop.
---

Ayah-number tap opens the primary action surface, while long-pressing Quran text is an additional shortcut to the same actions. Long-press must never be the only discovery path. Copy, range copy, bookmark, playback, and tafsir remain together in a viewport-contained surface.

The current reciter name and repeat value stay directly visible and interactive in the audio controller on phone and desktop; they should not be buried at the end of a generic settings list.

**Why:** The user confirmed this model after off-screen copy and bookmark menus made common actions inaccessible on mobile.

**How to apply:** Preserve ordinary word taps, mobile swipe page-turning, and the unified visual language whenever changing Quran interaction controls. Cancel long-press on pointer movement, and keep all action surfaces within the viewport.