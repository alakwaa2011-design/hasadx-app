---
name: Kids reward eligibility
description: Atomic eligibility rules that prevent repeated assignments or overlapping sessions from duplicating Kids progress and stars.
---

Kids completion must revalidate and consume either an unfinished teacher assignment or the current unfinished daily-adventure slot inside the same transaction that completes the session and grants its reward. Allow at most one active session per child and activity.

**Why:** Per-session idempotency does not prevent distinct sessions from completing the same assignment or daily slot and granting duplicate stars.

**How to apply:** Any new Kids activity entry point may authorize starting a session, but completion remains the source of truth. Lock eligibility, consume it, insert the unique reward grant, and only then increment stars.