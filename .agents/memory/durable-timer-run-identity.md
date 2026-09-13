---
name: Durable timer run identity
description: Consistency rules for countdowns that can finish while the app is closed or open in several tabs.
---

Every scheduled countdown must have an immutable run identity. Server mutations use optimistic versions, expiry creates at most one notification per run, and local sound/push deduplication is keyed by that same run.

**Why:** Browser tabs, delayed restores, cancellation requests, and background workers can race. Teacher-level state alone cannot distinguish an old completion from a newly started countdown.

**How to apply:** Preserve and validate the run identity through persistence, worker claims, push payloads, cancellation retries, and atomic cross-tab foreground sound claims.