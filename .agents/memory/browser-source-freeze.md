---
name: Freeze source before draft-persistence browser tests
description: Distinguish development hot-reload resets from actual draft-loss defects.
---

Freeze all source edits, including imported renderer and export modules, before testing unsaved drafts and save/discard/reload behavior.

**Why:** Worksheet testing observed Vite updates, an incompatible mixed helper/component export, and a connection restart alongside draft resets. A fresh session with stable source completed real persistence and discard checks without those resets. A hot-reload observation alone does not establish an application data-loss defect.

**How to apply:** Capture hot-reload frames, navigation events, and the exact authentication endpoint/status when a draft unexpectedly clears. Repeat the narrow failing journey in a fresh context after all source writers finish. Do not attribute the reset to authentication or silently change state-management code without that evidence.

An execution-notebook reset can coincide with a development-container restart and stopped app services; a subsequent HTTP 502 alone is not evidence of an application defect.

**Why:** Browser verification lost its notebook while both development services stopped. Restoring the managed services allowed the remaining checks to run with unchanged application source.

**How to apply:** Check service status and preview availability before retrying. Restore only the relevant stopped services, then continue the uncovered checks with the same tester rather than repeating successful journeys.