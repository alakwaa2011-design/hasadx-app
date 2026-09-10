---
name: Assignment archive and edit concurrency
description: Durable product rules for concurrent assignment edits and archive restoration.
---

Assignment edits and state-changing actions must use an expected version and increment the version atomically. Destructive changes must preserve a pre-mutation revision so they can be reviewed or recovered. An archive restore returns the assignment to active lists but deliberately does not restore public sharing; the teacher must share it again. Restoring historical settings must never broaden the assignment's current access.

**Why:** Concurrent teacher sessions must not silently overwrite newer work, historical submissions need stable question context, and restoring old content should not unexpectedly republish or reopen it.

**How to apply:** Any new assignment mutation should participate in version conflict detection and revision history. Keep archived assignments out of discovery, launch, and submission paths; make restore private and access-non-broadening.