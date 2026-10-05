---
name: Live presentation verification
description: Evidence required before claiming that a live presentation activity works.
---

Static inspection of a saved activity, submission handler, and display renderer is not proof that real participants can see live results.

**Why:** A first-slide word cloud looked complete in the code, but the user's real two-participant trial showed no words. Session lifecycle state kept the projector on its waiting screen despite an opened activity.

**How to apply:** Verify the whole path using separate student contexts, the teacher control preview, and the projector. Include opening the first activity without navigating slides, repeated-word aggregation, and a late-joining or reloaded projector. Do not tell the user the live flow was tested if only the code was inspected.

The user considers reports and session saving a critical presentation feature: «لأنها أهم ميزة».

**Why:** The user reported real participants alongside zero statistics and an incorrect “everyone fully participated” message.

**How to apply:** Treat changes to this feature as a critical journey. Verification must include actual participation, ending the session, reloading its saved report, and checking exported statistics; distinguish joined students from students who answered.
