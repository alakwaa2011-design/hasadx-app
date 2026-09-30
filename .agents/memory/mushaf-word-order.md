---
name: Mushaf word order
description: Ordering QCF glyph records from Quran Foundation Content Sync snapshots
---

The official `mushafs:1` snapshot has some physical lines where `position_in_line` repeats or skips after a verse transition. Sorting by it can reorder glyphs even though all words and line numbers are present.

**Why:** In a live snapshot, one line carried an end-of-previous-verse glyph with a repeated position, while the QCF page API retained the proper order. The unique `position_in_page` matched the canonical API word sequence.

**How to apply:** Group by page and line, then sort within each line by `position_in_page`. Validate complete unique page positions before accepting a snapshot; do not assume line positions form `1..N`.