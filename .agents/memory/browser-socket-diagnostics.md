---
name: Live socket browser diagnostics
description: Distinguishing reload transport noise from live activity persistence failures.
---

For live-presentation browser checks, assert actual participation acknowledgements, displayed cards, restored state, unhandled page errors and unexpected server failures; do not use an empty console-error list as the sole pass criterion.

**Why:** A complete moderation/reload/reopen journey succeeded while guest `/api/auth/me` probes returned expected 401s and stale Engine.IO polling requests returned `Session ID unknown` during teardown before fresh WebSocket connections opened. Blanket console assertions incorrectly classified that run as a feature failure.

**How to apply:** Correlate rejected contributions with their protocol replies and database writes. Keep guest contexts service-worker-free and avoid global spoofed `X-Forwarded-For` headers, which also accompany cross-origin requests and can cause unrelated CORS failures. Do not ignore an unknown-session error if participation or reconnection actually fails.
