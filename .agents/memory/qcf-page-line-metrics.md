---
name: QCF page line metrics
description: How to prevent QCF V2 Madani glyph clipping without breaking the canonical 15-line page geometry.
---

QCF page fonts have glyph bounds much taller than their apparent text size. Keep canonical Mushaf rows on a tight line-height and let glyph buttons and row containers overflow visibly; do not switch the page rows to a normal text line-height.

**Why:** Normal line-height made each row's intrinsic height follow the font's oversized metrics, pushing the final rows beyond the fixed paper and beneath the mobile audio dock. Relaxing only glyph overflow preserved diacritics while keeping all 15 rows inside the page.

**How to apply:** For QCF page renderers, preserve 15 flex rows, give rows `min-height: 0`, keep tight line-height, and use visible overflow on the row/glyph. Verify the final row's bounding box remains inside the page at a phone viewport.