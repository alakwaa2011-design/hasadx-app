---
name: Replit Build session recovery
description: Recovering a Replit project when Build and Agent disappear or the editor shows a crossed Wi‑Fi status.
---

When Replit's Build view appears to lack Agent, first check whether the conversation panel is merely hidden: the small toggle button at the top of the list reveals it. A crossed Wi‑Fi icon can indicate the editor lost its connection to Replit servers, but it is not proof of an app-code problem. Hard-refreshing or reopening the project in a fresh browser tab can restore the session; restarting compute and trying a private/different browser window are fallback steps.

**Why:** The app and its local workflows can remain healthy while the Agent panel is collapsed or the Replit editor session is disconnected, so code changes do not address the visible symptom.

**How to apply:** Verify the app/workflows separately, then check the small conversation-list toggle before recovering the browser/editor session or changing project code. Avoid repeatedly clicking Build while the session is frozen.