---
name: Worksheet design theme system
description: Architecture of the 7-template worksheet design system — how themes are defined, applied, and auto-selected.
---

## Rule
Each AI-generated worksheet picks a distinct visual theme; themes never repeat consecutively unless no alternative matches the subject.

**Why:** Teachers wanted every worksheet to look handcrafted, not templated. Seven genuinely different designs (header layouts, page frames, typography, question styles) make this possible without manual effort.

## Architecture

### Files
- `artifacts/homework-app/src/pages/teacher/worksheet-themes.tsx` — all theme definitions, header renderers, `selectTheme()`, `getLastTheme()`/`setLastTheme()`
- `worksheet-print.tsx` — imports themes, applies `ws-theme-{id}` class, injects `<ThemeStyles>` after base `<PrintStyles>`, switches header via `<ThemedHeader>`
- `worksheet-create.tsx` — calls `selectTheme()` after AI generation and file extraction, stores result in `settings.template`

### Theme IDs
`geometric` | `arabic_ink` | `modern_band` | `exam_paper` | `kids_play` | `science_lab` | `editorial`

### CSS application
Each theme CSS uses `.ws-theme-{id}.ws-page { ... }` and `.ws-theme-{id} .ws-* { ... }` overrides.
`ws-band-top` and `ws-play-banner` use `margin: -18mm -18mm 5mm` to break out of ws-content's 18mm padding and span full page width.

### Header layout types
`classic` (default 3-col) | `tabular` (geometric/exam) | `arabesque` (arabic_ink) | `band` (modern_band) | `playful` (kids_play) | `clipboard` (science_lab) | `masthead` (editorial)

### Selection priority
1. Kindergarten/Grade 1-2 → always `kids_play`
2. Subject keyword match → mapped theme (see subjectMap in selectTheme)
3. High school grade → `exam_paper` / `editorial` / `modern_band`
4. General → cycles through `[geometric, modern_band, editorial, exam_paper, science_lab]` using questionCount as seed

### Consecutive repeat prevention
`localStorage("ws_last_theme")` stores the last used theme; `selectTheme()` always picks an alternative when the natural match equals the last theme.

**How to apply:** When adding new subjects or grade patterns, add them to the `subjectMap` array in `selectTheme()` in worksheet-themes.tsx.

**Print pagination (A4) hard rule:** any .ws-page taller than 297mm by even a fraction of a px splits into page+sliver in print/PDF ("repeated pages"). Three causes fixed: (1) themed page borders add to the 297mm content — subtract via `--ws-frame` var; (2) the hidden measurement div must carry the `ws-theme-*` class or questions are measured with default (smaller) styles; (3) keep SAFETY margins in the packer and a ~10px print-only slack on .ws-content min-height. Verify prints with headless chromium (playwright is in node_modules; login via ctx.request.post then page.pdf) — counting `/Type /Page` in the PDF catches slivers instantly.
