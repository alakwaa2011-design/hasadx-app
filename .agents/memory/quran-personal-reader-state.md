---
name: Personal Quran reader state
description: Account bookmarks and last-read position are private reading aids, separate from assigned wards and measured Quran progress.
---

Personal bookmarks and last-read position belong only to the currently authenticated teacher or
student account. They do not count as recitation, completion, memorization progress, or evidence for
an assigned ward.

**Why:** A user may browse or mark any verse without completing assigned work. Mixing browsing state
with progress would advance records without evidence and could expose one account's private reading
history through a teacher-student relationship.

**How to apply:** Keep personal reader state behind current-session ownership. Do not write it while
running an assigned ward or independent-practice flow, both of which retain their own persistence.
Explicit navigation always beats delayed restoration. Use compare-and-swap revisions for last-read
writes so an old tab cannot silently replace a newer saved position.