---
name: AI question extraction — equivalent-format normalization
description: Models emit equivalent but differently-keyed question JSON; sanitize must normalize, never invent answers.
---

Claude Sonnet reliably returns `question` instead of `prompt` as the question-text key (verified live, 2/2 runs), while gpt-4o-mini and gpt-5 return `prompt`+`options`+`correctIndex` as asked. Any strict sanitizer keyed on `prompt` silently drops ALL Sonnet questions → "تنسيق غير صالح من المولّد" 500.

**Rule:** normalize equivalent formats before final validation — prompt|question|text keys; options/choices arrays or objects or flat optionA..D; correctAnswer letter A–D or exact-unique full-text match → correctIndex. NEVER default to the first option, never floor fractional indices (require Number.isInteger), and match answer text against FULL trimmed option text (not the 300-char truncation) rejecting ambiguous duplicates.

**How to apply:** `sanitizeGeneratedQuestions` in the worksheets routes is the place; unit tests live in sanitize-extracted-questions.test.ts. Zero surviving questions must refund credits without capture.
