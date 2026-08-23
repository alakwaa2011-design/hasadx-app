---
name: Replit Build session recovery
description: Recovering a Replit project when Build and Agent disappear or the editor shows a crossed Wi‑Fi status.
---

When Replit's Build view freezes and Agent is absent, treat it first as an editor-session/WebSocket problem rather than an application-code problem. A crossed Wi‑Fi icon indicates the editor lost its connection to Replit servers. Hard-refreshing or reopening the project in a fresh browser tab can restore the Agent panel; restarting compute and trying a private/different browser window are fallback steps.

**Why:** The app and its local workflows can remain healthy while the Replit editor session is disconnected, so code changes do not address the visible freeze.

**How to apply:** Verify the app/workflows separately, then recover the browser/editor session before changing project code. Avoid repeatedly clicking Build while the session is frozen.