---
name: Optional public Quran sync
description: Privacy and merge rules for synchronizing the anonymous Quran reader with an account.
---

The public Quran reader must remain fully usable with device-local state and no account. Account synchronization is an explicit per-device choice. Enabling it unions local and account bookmarks, keeps the local reading position as the user's current intent, and carries the local reciter preference into the account. Disabling it copies account state locally but does not delete account data.

**Why:** Requiring authentication would weaken the public reading experience, while replacing either state wholesale could silently lose bookmarks made on another device.

**How to apply:** Any future reader-state additions should have a local anonymous path, join the same opt-in sync boundary, and use non-destructive merge semantics. Do not connect this public state to teacher assignments or academic progress.