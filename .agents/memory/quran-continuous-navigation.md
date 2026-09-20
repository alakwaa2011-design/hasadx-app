---
name: Quran continuous navigation
description: Preventing page cascades and URL drift in the continuously scrolling Mushaf.
---

Manual page jumps in continuous mode must suspend scroll-driven page observation, replace the rendered page window, reset the reader scroll position after rendering, and only then resume observation. Continuous mode should use scrolling rather than footer next/previous controls.

**Why:** Browser scroll anchoring retained the old bottom position while the rendered window changed. This repeatedly triggered load-more and advanced many pages from one navigation action, desynchronizing the URL, selector, and visible page.

**How to apply:** Treat continuous scrolling and paged navigation as distinct interaction models. Whenever continuous content is replaced programmatically, fence scroll handlers until the new window is mounted at scrollTop zero.