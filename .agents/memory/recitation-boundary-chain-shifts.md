---
name: Recitation boundary chain shifts
description: How to detect silent one-ayah drift in chapter-level Quran audio boundaries.
---

A boundary list can have the canonical count and remain strictly increasing while still being semantically wrong: one extra silence edge may shift every following ayah until a later missing edge compensates for it.

**Why:** A whole-recitation audit found sub-second “ayahs” that exposed long chain shifts even though the manifest had the correct number of boundaries. Checking only counts, ordering, or chapter duration would have passed them.

**How to apply:** For imported chapter audio, combine semantic review of every surah opening (istiadhah/bismillah/first ayah) with a minimum-duration audit and per-surah realignment of every flagged region. Never repair this with a global delay.