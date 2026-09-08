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

Narrated illustrations do not satisfy a requested classroom dialogue with an on-screen teacher and students.

**Why:** the owner rejected an expensive completed video because it only had voiceover, not a speaking teacher and responding students. Successful timing and encoding did not address that mismatch.

**How to apply:** distinguish narration from character dialogue before choosing the production pipeline. When dialogue is requested, require visible speakers, distinct role-appropriate voices and speech aligned to the speaking character. Disclose the cost and validate a short representative exchange before proposing a full-length production.

For fal queue tracking, trust the attached connector contract over generic API assumptions: submit to the full model identifier, but track results/status/cancellation under its base application identifier (the first two path segments).

**Why:** a review incorrectly recommended retaining the model subpath in tracking URLs. The connector documents that this produces empty 405 responses; following that recommendation would break work after a paid submission.

**How to apply:** verify against the provider/connector contract before changing queue path normalization, and never use a paid render merely to probe endpoint shapes.

Treat narration timing as a whole-lesson allocation problem, not an isolated retry count. Never lengthen an already-complete short narration merely to fill a scene.

**Why:** per-scene word-rate estimates and a few isolated rewrites still caused reported failures on short lessons. Repeated shortening can also lose meaning when an overloaded scene could share its content with neighbouring scenes.

**How to apply:** preserve the original lesson as the factual source, align visual prompts with moved content, learn capacity from measured speech, and validate every final recording before any paid motion request. The selected duration takes priority over optional detail: the owner explicitly wants automatic selection of explanation depth, not manual script shortening. Keep essential ideas and accurate quotations, not every source sentence.

Estimated words-per-second are initial planning guidance, not grounds to reject an unmeasured script. After a measured overrun, enforce meaningful compression before paying to speak a replacement; actual WAV duration remains the final authority.

**Why:** strict initial estimates rejected plausible Arabic sentences before measurement, while purely advisory rewrites later expanded already-recorded narration. Live checks also showed a minimally reasoning model gaming word-count patterns by welding Arabic words together; passing a JSON schema is not evidence of natural or shorter speech.

**How to apply:** measure first, then derive compression from observed speech. Constrain genuinely new wording by meaningful length as well as word count, preserve normal Arabic spacing and complete thoughts, and use sufficient model reasoning. Reuse unchanged measured audio and freeze fitting scenes when only another scene is too long; do not reject a partial repair merely because cached narration exceeded its old slot. Report specific failures without logging private lesson content.

Keep AI video production administrator-only unless the owner explicitly asks to reopen it to teachers; this does not restrict the separate interactive-video lesson tool.

**Why:** the owner explicitly restricted this generator. Fixing its generation quality or completing a phase is not permission to expand access again.

**How to apply:** preserve the access restriction when changing discovery, navigation, production routes, or generated-media serving.