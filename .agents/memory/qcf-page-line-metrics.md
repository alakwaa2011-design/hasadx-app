---
name: QCF page line metrics
description: How to prevent QCF V2 Madani glyph clipping without breaking the canonical 15-line page geometry.
---

QCF page fonts have glyph bounds much taller than their apparent text size. Keep canonical Mushaf rows on a tight line-height and let glyph buttons and row containers overflow visibly; do not switch the page rows to a normal text line-height.

**Why:** Normal line-height made each row's intrinsic height follow the font's oversized metrics, pushing the final rows beyond the fixed paper and beneath the mobile audio dock. Relaxing only glyph overflow preserved diacritics while keeping all 15 rows inside the page.

**How to apply:** For QCF page renderers, preserve 15 flex rows, give rows `min-height: 0`, keep tight line-height, and use visible overflow on the row/glyph. Verify the final row's bounding box remains inside the page at a phone viewport.

For portrait paged reading, an extended paper needs a **definite height**, not only `min-height`, because the inner `height: 100%` flex column can still size against the width-derived aspect-ratio height. The paper then looks tall but its 15 lines cluster at the top, leaving a misleading empty bottom.

**Why:** Measuring only the paper's bottom incorrectly passed while the final text row was hundreds of pixels above the safe bottom edge.

**How to apply:** Measure first and last text rows as well as the paper; subtract the actual toolbar reserve and device bottom padding from the reader viewport. Never compress below the natural width-derived page height on short screens—allow vertical scrolling instead.

On taller portrait phones, percentage `padding-top` and `padding-bottom` resolve against the **page width**, not its stretched height. The default page insets can leave a large empty band even after the paper and flex rows fill their available height. Use tighter insets only for portrait paged reading; leave continuous and landscape page geometry unchanged.

**Why:** A test that permitted the last row to sit 170px above the viewport bottom passed while users still saw substantial empty space.

**How to apply:** Assert both the first text row's distance below the toolbar and the last text row's distance above the protected bottom edge on the affected page, not just that the paper fits the viewport.