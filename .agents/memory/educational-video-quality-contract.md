---
name: Educational video quality contract
description: True generated motion and teacher acceptance boundaries for phase-one educational videos
---

Educational video scenes must use generated video with motion inside the scene, not still images disguised by zoom/pan. Do not silently substitute a still when video generation fails.

**Why:** the user explicitly chose generated-video motion after reviewing the still-image pipeline's limitations.

**How to apply:** integrate a runtime video-generation provider, preserve explicit failure states, and disclose provider costs before generating paid trials.

Phase-one acceptance is the user's manual judgment of a new video, not successful MP4 encoding or automated task approval. Repair the existing pipeline before adding OCR, advanced controls, or interactive questions.

**Why:** the user rejected the previous output quality despite technical completion.

**How to apply:** require time-budgeted scenes, complete uncut narration with a safe tail, scene-aligned visuals and short terms, and licensed consistent Arabic typography; leave the result ready for user review without starting phase two.

For fal queue tracking, trust the attached connector contract over generic API assumptions: submit to the full model identifier, but track results/status/cancellation under its base application identifier (the first two path segments).

**Why:** a review incorrectly recommended retaining the model subpath in tracking URLs. The connector documents that this produces empty 405 responses; following that recommendation would break work after a paid submission.

**How to apply:** verify against the provider/connector contract before changing queue path normalization, and never use a paid render merely to probe endpoint shapes.