---
name: Freeze source before draft-persistence browser tests
description: Distinguish development hot-reload resets from actual draft-loss defects.
---

Freeze all source edits, including imported renderer and export modules, before testing unsaved drafts and save/discard/reload behavior.

**Why:** Worksheet testing observed Vite updates, an incompatible mixed helper/component export, and a connection restart alongside draft resets. A fresh session with stable source completed real persistence and discard checks without those resets. A hot-reload observation alone does not establish an application data-loss defect.

**How to apply:** Capture hot-reload frames, navigation events, and the exact authentication endpoint/status when a draft unexpectedly clears. Repeat the narrow failing journey in a fresh context after all source writers finish. Do not attribute the reset to authentication or silently change state-management code without that evidence.