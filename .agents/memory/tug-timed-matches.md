---
name: Tug timed matches
description: Defines the distinct finish semantics and timing authority for Tug of War modes.
---

Tug of War has two explicit end modes. Question mode preserves the existing finite-question finish behavior. Time mode uses one shared match clock for both teams, repeats the available questions cyclically, and ends both teams together only when the shared duration expires.

**Why:** A teacher-selected duration must remain meaningful even when the question set is short, and separate client timers can drift or finish teams at different moments.

**How to apply:** Keep the server authoritative for device games and the shared reducer clock authoritative for board games. Pause/resume must pause the match clock, replay must create a fresh duration, and question-level timers remain separate from the match duration. The server deadline is intentionally absent until the first question starts; guards before that point must distinguish “not initialized” from “expired.”