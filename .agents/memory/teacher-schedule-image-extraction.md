---
name: Teacher schedule image extraction
description: Timetable image import preserves each source cell's position, order, and weekday-specific times instead of inferring a shared schedule.
---

The image-import contract is position-first and day-specific: a lesson or non-lesson label gets the numbered column and times aligned with its exact weekday cell. `breakAfterLesson: 0` is reserved for a genuinely unnumbered “Other periods” column, not uncertainty. Never normalize different weekdays into one bell schedule.

**Why:** Moving a visible label or copying one day's times into another changes the teacher’s actual timetable and is worse than asking for review.

**How to apply:** Keep source order and per-day times through server parsing and client draft normalization. Vision prompts must cross-check both grid coordinates, preserve exact titles/times, and mark ambiguity as low confidence with a warning rather than guessing.