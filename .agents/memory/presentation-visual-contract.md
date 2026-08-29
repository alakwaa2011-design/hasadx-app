---
name: Presentation visual contract
description: Rules connecting AI outlines, real-image search, and deterministic visual fallbacks.
---

Automatic web-image lookup is opt-in: only an explicit `imagePlan` for a photo or illustration may search, and every searchable plan must retain fallback metadata.

**Why:** Generic decorative images and synthetic side panels made decks inconsistent and consumed reading space. The product must not generate AI images by default or rely on an upstream image service for a usable teaching slide.

**How to apply:** Preserve legacy outlines by treating an absent plan as no search and no invented visual. Only native semantic layouts (steps, comparison, timeline, formula, activity) may advertise local fallbacks; ordinary content expands text instead of drawing generic boxes, nodes, or icons. Keep fallback metadata on searched images for resilience, but do not turn it into decorative side art.

When comparing an initial outline with its one corrective retry, always choose a non-fatal retry over a fatal initial result; compare feedback counts only when both candidates are complete.

On mobile previews, an outline request can be abandoned around 80 seconds. A second LLM call is therefore only justified for a fatal outline, never for non-fatal normalization feedback. Preserve numbered teaching steps rather than dropping them merely because they lack a source field.

Keep `gameQuestions` lightweight in outline generation: one assessment slide with at most three questions. Large per-slide question banks can exhaust the provider output budget before the required deck JSON closes, which surfaces as an incomplete outline.

Outline density limits are soft data-preservation targets, but balanced/detailed full lessons must reject shallow explain/example/practice slides. **Why:** preserving one useful point is right for exceptional slide types, but accepting one-line teaching slides recreated unusable decorated summaries.

Full-lesson depth contract: every outline slide carries a pedagogical role, and a normal lesson of 8+ slides must cover explanation + example/practice + assessment with no single role dominating. **Why:** teachers received decorated summaries (two definitions and a recap) that could not carry a real lesson. **How to apply:** these violations are fatal ONLY for plain explain lessons — quick recaps, contests, and educational strategies (SCAMPER, six hats…) legitimately concentrate one role, so the same findings stay advisory there or valid decks 422. Normal-lesson defaults are 10–12 slides; a client-inferred count must never exceed the free-plan slide cap or teachers hit LIMIT_EXCEEDED. Fuller decks need a bigger model output budget or JSON truncates mid-object.

Game question MCQs arrive with `prompt` or `question` keys interchangeably — normalize both. A quiz's validated `gameQuestions` are usable slide content even when `talkingPoints` is empty; do not reject that outline as incomplete.

Imported-file decks must pass their expected slide count, interaction minimum, and post-materialization validity checks before they are saved. **Why:** preserving an AI/schema failure as a one-slide “successful import” misleads teachers and recreates the original broken experience. **How to apply:** tolerate and normalize non-semantic visual vocabulary from the model, retry a fatally incomplete outline once, then return an honest quality failure without creating a presentation if the complete lesson still cannot be built. Scanned files with no extractable text may use a clearly labelled basic preservation path.

Quick generation is a short teachable lesson, not a recap: it must include explanation, a worked example, guided practice with an answer, and assessment even when an educational strategy is selected. Balanced slides may carry up to five complete explanatory points. **Why:** short headline-only cards looked decorative but were unusable for classroom explanation. **How to apply:** enforce these roles in guardrails, keep examples/answers inside talking points, invalidate the outline cache when this contract changes, and verify five-point Arabic layouts remain inside the 16:9 canvas.

Image provenance controls presentation placement: teacher-uploaded pages, screenshots, and diagrams must remain complete in a framed `contain` side treatment, while optional web photos may use `cover`. Full-bleed backgrounds are limited to concise hero statements. **Why:** cropping source material or layering detailed imagery behind Arabic explanation destroys instructional clarity. **How to apply:** pass source provenance through materialization, place inline images above atmosphere layers but below content, and let a real image replace decorative icons rather than compete with them.

Presentation image search must identify its Wikimedia client and reject scanned documents, book pages, and blank templates from both URLs and titles before ranking candidates. **Why:** anonymous requests can receive HTML 429 responses, while Commons often ranks OCR book pages above educational diagrams. **How to apply:** keep one shared quality/ranking policy across automatic generation and the editor picker; verify important topic queries against the live provider, not mocks alone.

MCQ activity slides in generated presentations use a 6–7 question set; the prompt-version cache key must change whenever that contract changes. **Why:** a prior 1–3 rule and cached outlines made new activities appear truncated at three questions. **How to apply:** keep the count aligned in the general outline prompt, strategy guidance, single-slide prompt, and cache version; open activities remain question-free.