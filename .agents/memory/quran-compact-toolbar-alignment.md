---
name: Quran compact toolbar alignment
description: Why the Arabic compact reader toolbar uses anchored groups and adaptive control widths.
---

Keep the compact Arabic reader's settings and action controls anchored to the left, and its surah/page navigation anchored to the right. At medium widths, widen the existing controls enough to avoid a large empty middle; leave narrow phones compact. Do not move settings to the right just because the container uses RTL.

**Why:** The user explicitly rejected moving settings to the right, then pointed out that the edge-anchored version left too much empty space in the middle of a moderately wide browser. Reversing a single row without grouping had left settings floating near the middle. An absolutely positioned full-width header with both side insets additionally clipped the leftmost button.

**How to apply:** Treat actions and navigation as separate responsive groups. Inspect narrow phones and medium widths around 500–1000px: make the increased hit areas visually apparent on medium widths, but keep the menu near the left edge and selectors on the right. Check actual bounds; no document overflow does not prove the leftmost button is visible.