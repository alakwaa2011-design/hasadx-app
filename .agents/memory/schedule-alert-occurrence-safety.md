---
name: Schedule alert occurrence safety
description: Rules for reliable server-side alerts generated from recurring teacher timetables.
---

Schedule alerts must be generated from the schedule and notification preferences re-read under database locks. Schedule edits or deletions must invalidate pending alert records and mutate the schedule in the same transaction. Each schedule occurrence and alert kind may create only one notification.

**Why:** A worker can otherwise validate old lesson data between cleanup and an edit, sending a stale alert while also preventing the corrected alert through an idempotency key.

**How to apply:** Persist the teacher’s IANA timezone and selected start/end lead times on the server. Lock both the schedule and preference rows while creating an occurrence alert, and lock the schedule row before cleanup and mutation in edit/delete paths.