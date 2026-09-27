---
name: Guided Quran plan opt-in
description: Separate ordinary guided memorization from explicitly chosen personal-plan practice.
---

Treat “memorize from the current ayah” and “My Plan” as distinct session origins even when a personal plan already exists. The ordinary path advances through ayahs without opening the plan, recording plan assessments, or showing routine progress notifications; the plan path retains its review schedule and completion feedback.

**Why:** A learner who chose the first option was redirected to “My Plan” after mastering one ayah despite never selecting it. Merely having a plan configured does not mean the learner opted into that workflow.

**How to apply:** Gate plan persistence, linking range, due review selection, completion prompts, and plan navigation on the session’s explicit origin. Check the behavior with an existing saved plan, not only with an empty one.