---
name: Presentation visual contract
description: Rules connecting AI outlines, real-image search, and deterministic visual fallbacks.
---

Automatic web-image lookup is opt-in: only an explicit `imagePlan` for a photo or illustration may search, and every searchable plan must retain a deterministic educational fallback.

**Why:** Generic decorative images made decks inconsistent, while a failed lookup previously left a text-only result. The product must not generate AI images by default or rely on an upstream image service for a usable teaching slide.

**How to apply:** Preserve legacy outlines by treating an absent plan as no search. When adding or editing outline paths, normalize an omitted fallback to an educational visual and reject placeholders or an actionable image search with no fallback. Keep retries within the existing outline request so they cannot create a second credit hold.

When comparing an initial outline with its one corrective retry, always choose a non-fatal retry over a fatal initial result; compare feedback counts only when both candidates are complete.

On mobile previews, an outline request can be abandoned around 80 seconds. A second LLM call is therefore only justified for a fatal outline, never for non-fatal normalization feedback. Preserve numbered teaching steps rather than dropping them merely because they lack a source field.