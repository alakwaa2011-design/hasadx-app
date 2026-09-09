---
name: RTL numeric UI assertions
description: Stable browser assertions for localized numbers and directional symbols in Arabic interfaces.
---

Avoid exact full-string text selectors that combine localized numbers, arrows, and RTL content. Locate the semantic row by its stable label or entity name, then assert each formatted value within that row.

**Why:** Browser accessibility text and bidirectional rendering can reorder or annotate mixed numeric and directional content even when the visible UI is correct, causing exact-text selectors to miss it.

**How to apply:** In Arabic Playwright tests, scope to the relevant row/card first and compare separately formatted values plus status copy. Keep geometry assertions independent from text ordering.