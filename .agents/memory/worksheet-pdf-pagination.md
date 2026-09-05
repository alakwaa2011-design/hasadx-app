---
name: Worksheet PDF pagination
description: Why worksheet print pagination needs a final rendered-height guard in addition to hidden measurement.
---

Worksheet and answer-key pagination must keep the final rendered A4 overflow guard; hidden item measurements alone are not reliable enough.

**Why:** Theme selectors, loaded fonts, section headings, continuation headers, and the final footer can make visible pages taller than their hidden estimates. Chromium then fragments one intended page into multiple PDF pages, previously causing repeated first-page content or a footer-only page.

**How to apply:** When changing worksheet themes, typography, headers, footers, question layouts, or answer rows, preserve measured pagination plus the final rendered-height guard for both worksheet and answer-key pages. Verify total DOM pages equal generated A4 PDF pages, including a deliberately long answer key.