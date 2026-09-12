---
name: Teacher schedule image extraction
description: The timetable image importer must preserve visible cell positions and source order instead of inferring placement from time.
---

The image-import contract is position-first: a lesson or non-lesson label gets the numbered column aligned with its source cell. `breakAfterLesson: 0` is reserved for a genuinely unnumbered “Other periods” column, not uncertainty.

**Why:** Moving SNACK, PD, or another visible label into “Other periods” changes the teacher’s timetable and is worse than asking for review.

**How to apply:** Keep source order through server parsing and client draft normalization. Strengthen vision prompts to map horizontal cell alignment to the visible header, preserve exact titles, and mark ambiguity as low confidence with a warning rather than guessing.