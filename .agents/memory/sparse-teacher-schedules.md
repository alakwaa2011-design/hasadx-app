---
name: Sparse teacher schedules
description: How teacher schedule imports must treat gaps between lesson numbers.
---

Preserve non-contiguous lesson numbers exactly as they appear. A teacher may teach the first and third periods while the second is legitimately free.

**Why:** Filling or renumbering gaps changes the teacher's real timetable and can either block saving or persist the third period as the second.

**How to apply:** Image import, bulk editing, conflict targeting, labels, and save payloads must use each lesson's explicit number. Adding rows should select unused numbers rather than assuming array position equals lesson number.