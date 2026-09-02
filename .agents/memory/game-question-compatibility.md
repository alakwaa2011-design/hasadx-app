---
name: Game question compatibility
description: Shared compatibility rules for importing and replaying question types across games.
---

Button-based games must accept multiple-choice questions with two, three, or four nonempty options, and must normalize true/false into two explicit options.

**Why:** Several import and saved-game paths required all four A–D values even though their runtime renderers already iterate over a variable options array. This silently excluded valid two-option, three-option, and true/false questions.

**How to apply:** Normalize source questions before game-specific setup. Remove empty MCQ options while remapping the correct answer to its new index. Only enable fill-blank/open answers in games with a real text-answer renderer; never fabricate distractors.