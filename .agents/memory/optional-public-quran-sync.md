---
name: Optional public Quran sync
description: Privacy and merge rules for synchronizing the anonymous Quran reader with an account.
---

The public Quran reader must remain fully usable with device-local state and no account. Account synchronization is an explicit per-device choice. Enabling it unions local and account bookmarks, keeps a genuinely local reading position as the user's current intent, and carries the local reciter preference into the account. A fresh device's automatically rendered page 1 is not user intent and must not overwrite the account position. Disabling sync copies account state locally but does not delete account data. A failed authenticated state request, including an expired session, must switch the page back to local mode.

**Why:** Requiring authentication would weaken the public reading experience, while replacing either state wholesale could silently lose bookmarks. A fresh device can otherwise treat its automatically rendered default as user intent and overwrite a real account position.

Self-assessed personal memorization is not teacher-verified mastery, and must not silently inherit reader-position sync or be presented as cross-device state without a designed merge.

**Why:** Reader-position sync does not establish a trustworthy merge of personal practice histories. Quietly reusing that channel could lose assessments, promise continuity that does not exist, or blur self-assessment with academic progress.

**How to apply:** Any future reader-state additions should have a local anonymous path. If personal practice eventually gains optional account sync, design a separate non-destructive merge of assessments and resumable sessions before promising it in the UI. Distinguish an untouched default from an intentional local update, and fall back locally on authentication loss. Do not connect this public state to teacher assignments or academic progress.