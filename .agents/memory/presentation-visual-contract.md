---
name: Presentation visual contract
description: Rules connecting AI outlines, real-image search, and deterministic visual fallbacks.
---

Automatic web-image lookup is opt-in: only an explicit `imagePlan` for a photo or illustration may search, and every searchable plan must retain a deterministic educational fallback.

**Why:** Generic decorative images made decks inconsistent, while a failed lookup previously left a text-only result. The product must not generate AI images by default or rely on an upstream image service for a usable teaching slide.

**How to apply:** Preserve legacy outlines by treating an absent plan as no search. When adding or editing outline paths, normalize an omitted fallback to an educational visual and reject placeholders or an actionable image search with no fallback. Keep retries within the existing outline request so they cannot create a second credit hold.

When comparing an initial outline with its one corrective retry, always choose a non-fatal retry over a fatal initial result; compare feedback counts only when both candidates are complete.

On mobile previews, an outline request can be abandoned around 80 seconds. A second LLM call is therefore only justified for a fatal outline, never for non-fatal normalization feedback. Preserve numbered teaching steps rather than dropping them merely because they lack a source field.

Keep `gameQuestions` lightweight in outline generation: one assessment slide with at most three questions. Large per-slide question banks can exhaust the provider output budget before the required deck JSON closes, which surfaces as an incomplete outline.

Outline density limits are soft quality targets, not data-loss rules. Preserve useful longer points and sparse-but-meaningful slides; reject only empty or placeholder content. **Why:** a complete nine-slide response was previously rejected solely for having two or one useful points on two slides.

Full-lesson depth contract: every outline slide carries a pedagogical role, and a normal lesson of 8+ slides must cover explanation + example/practice + assessment with no single role dominating. **Why:** teachers received decorated summaries (two definitions and a recap) that could not carry a real lesson. **How to apply:** these violations are fatal ONLY for plain explain lessons — quick recaps, contests, and educational strategies (SCAMPER, six hats…) legitimately concentrate one role, so the same findings stay advisory there or valid decks 422. Normal-lesson defaults are 10–12 slides; a client-inferred count must never exceed the free-plan slide cap or teachers hit LIMIT_EXCEEDED. Fuller decks need a bigger model output budget or JSON truncates mid-object.

Game question MCQs arrive with `prompt` or `question` keys interchangeably — normalize both in the sanitizer or complete question sets are silently dropped.

Imported-file decks must pass their expected slide count, interaction minimum, and post-materialization validity checks before they are saved. **Why:** preserving an AI/schema failure as a one-slide “successful import” misleads teachers and recreates the original broken experience. **How to apply:** tolerate and normalize non-semantic visual vocabulary from the model, retry a fatally incomplete outline once, then return an honest quality failure without creating a presentation if the complete lesson still cannot be built. Scanned files with no extractable text may use a clearly labelled basic preservation path.