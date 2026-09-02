---
name: Question images across games
description: Cross-game contract for preserving, resolving, and visibly failing question images.
---

Every question transformation must preserve `imageUrl`, including assignment imports, AI/manual editors, saved games, newly created assignments, and socket/session payloads.

**Why:** Several games supported image rendering but silently replaced `imageUrl` with null during conversion, while other screens rendered internal object-storage paths as raw browser URLs. Images therefore disappeared even though they had been saved correctly.

**How to apply:** Treat `imageUrl` as part of the shared question contract. Resolve relative and legacy object-storage URLs only when rendering, and show a clear message when an external source blocks direct display instead of hiding the broken image.