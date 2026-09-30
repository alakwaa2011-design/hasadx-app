---
name: Guided Quran printed-page parity
description: Why guided memorization in the mobile Mushaf must keep the printed page as the source of truth.
---

Guided memorization should keep the learner's verse in its QCF Mushaf page and show only controls in the guided panel. Reading, partial hiding, and recitation comparison act on that printed verse; the ayah-end marker stays visible. If word data or the page font is unavailable, a whole-page image fallback cannot safely implement word hiding and must not expose the target verse during concealment.

**Why:** The separately rendered plain-text verse looked different from the Mushaf during reading and let the hiding step operate on different words than the learner actually saw on the page. Falling back to an unmasked page image would also defeat the hiding exercise.

**How to apply:** When adapting guided stages, preserve page typography, hide words at their printed positions, keep individual hints scoped to the current exercise, and fail visibly rather than displaying an unmasked fallback during hiding.