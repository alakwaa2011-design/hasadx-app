---
name: Quran compact toolbar alignment
description: Why Arabic mobile reader controls need two anchored groups rather than a reversed single row.
---

Keep the compact Arabic reader's settings and action controls anchored to the left, and its surah/page navigation anchored to the right. Do not move settings to the right just because the container uses RTL.

**Why:** The user explicitly rejected that direction. Reversing a single row without grouping also left the settings control floating near the middle on wider phone/tablet-sized viewports after the surah selector was capped. An absolutely positioned full-width header with both side insets additionally clipped the leftmost button.

**How to apply:** Treat actions and navigation as separate responsive groups. Verify the actual visual bounds at narrow and wide phone widths, including the left edge; a document with no horizontal overflow can still clip a control outside the viewport.