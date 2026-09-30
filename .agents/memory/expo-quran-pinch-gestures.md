---
name: Expo Quran pinch gestures
description: Browser and gesture constraints for native-style two-finger zoom in the Expo reader.
---

An Expo page gesture that uses PanResponder for two-finger zoom must also disable the browser's native touch action on the page surface in the web preview. Keep one-finger swipes for page turns only at the natural zoom level; a pinch or drag must never turn the page on release. Zoom applies to one page and resets after changing pages or rotating.

**Why:** In a mobile Chromium preview, PanResponder received pinch updates but Chromium simultaneously zoomed the entire browser viewport. This made later controls difficult to hit and made the page transform appear much smaller than the user's gesture. Once browser touch action was disabled, the viewport stayed at scale 1 and the page alone responded.

**How to apply:** When modifying Expo Quran gestures, check a real two-point browser touch sequence: the browser visual viewport remains unchanged, the page transform grows, dragging pans it, reset returns it to size, and unzoomed one-finger swipes and word taps still work. Browser simulation does not replace a final check on a physical phone.