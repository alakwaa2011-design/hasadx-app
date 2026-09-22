---
name: Quran specialized bookmarks
description: Category and compatibility rules for Quran reader bookmarks.
---

Each ayah may have one bookmark whose category is one of: stopped here, needs review, similar ayah, repeated mistake, or ask teacher. Choosing another category updates the existing bookmark rather than creating a duplicate.

**Why:** A single bookmark per ayah keeps navigation and sync deterministic, while category metadata captures the learner’s purpose. Existing server and local bookmarks predate categories and must remain usable.

**How to apply:** Normalize missing or unknown categories to “stopped here” at reader-state boundaries. Preserve category during local/account sync, and keep the owner-plus-ayah uniqueness rule unchanged.