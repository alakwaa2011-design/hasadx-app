---
name: Student reward photo privacy
description: Privacy rule for teacher-uploaded student photos used in classroom rewards.
---

Teacher-uploaded roster photos must be treated as private media. Store them under a teacher-and-student-owned object prefix and display them only through an authenticated ownership check, not a generic object URL.

**Why:** Student photos identify minors and should not become accessible merely because someone obtains or guesses an object-storage path.

**How to apply:** Any reward-board, group, profile, report, or future student-facing response must return an owner-checked media route (or a short-lived authorized URL) for uploaded photos. Bundled illustrated avatars may remain public.