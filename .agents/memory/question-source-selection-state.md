---
name: Question source selection state
description: Prevent stale assignment questions when a teacher changes the selected activity in a game setup flow.
---

When a source picker loads an assignment asynchronously, treat the loaded question payload as valid only when it is explicitly bound to the currently selected assignment ID. Clear any previous payload before requesting a new selection, and disable continuation until that same selection has completed successfully.

**Why:** A failed request for a second assignment can otherwise leave the first assignment's questions in memory while the UI appears to select the second one, causing a game to start with the wrong content.

**How to apply:** Use this invariant in any async activity/assignment picker that lets a teacher switch choices before continuing, including future shared setup flows.