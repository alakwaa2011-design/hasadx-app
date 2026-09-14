---
name: Teacher schedule image extraction
description: Timetable image import preserves each source cell's position, order, and weekday-specific times instead of inferring a shared schedule.
---

The image-import contract is position-first and day-specific: a lesson or non-lesson label gets the numbered column and times aligned with its exact weekday cell. A drawn cell spanning multiple numbered slots becomes one entry per covered slot with that slot's own time; never collapse a double period. Preserve location and every remaining visible line as notes. `breakAfterLesson: 0` is reserved for a genuinely unnumbered “Other periods” column, not uncertainty. Never normalize different weekdays into one bell schedule.

**Why:** Moving a visible label or copying one day's times into another changes the teacher’s actual timetable and is worse than asking for review.

**How to apply:** Keep source order, per-day times, locations, and notes through server parsing, client draft normalization, review, and bulk save. Vision prompts must cross-check both grid coordinates, expand merged slots, preserve exact details, and reject ambiguous alignment rather than guessing.