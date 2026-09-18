---
name: Quran partial hiding
description: Expected concealment behavior for the guided memorization partial-hide stage.
---

In a guided memorization session targeting one ayah, partial hiding conceals alternating words inside that ayah while keeping the ayah marker visible. Multi-ayah progressive sessions may continue showing the current ayah and concealing later ayahs.

**Why:** Reusing progressive range behavior for a single-ayah session treated the only target as the current ayah and revealed it completely, making the “partial hide” stage do the opposite of its label.

**How to apply:** Pass word position through the Madani renderer concealment check. For a single-ayah active range, conceal a deterministic subset of word glyphs only; do not conceal end markers. Keep range progression behavior separate.