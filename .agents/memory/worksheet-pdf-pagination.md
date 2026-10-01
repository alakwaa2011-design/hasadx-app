---
name: Worksheet PDF pagination
description: Why worksheet print pagination needs a final rendered-height guard in addition to hidden measurement.
---

Worksheet and answer-key pagination must keep the final rendered A4 overflow guard; hidden item measurements alone are not reliable enough.

**Why:** Theme selectors, loaded fonts, section headings, continuation headers, and the final footer can make visible pages taller than their hidden estimates. Chromium then fragments one intended page into multiple PDF pages, previously causing repeated first-page content or a footer-only page.

**How to apply:** When changing worksheet themes, typography, headers, footers, question layouts, or answer rows, preserve measured pagination plus the final rendered-height guard for both worksheet and answer-key pages. Verify total DOM pages equal generated A4 PDF pages, including a deliberately long answer key.

Phone fitting must remain a screen-only presentation of an unchanged A4 layout. Pagination checks must use unscaled dimensions, and image-based exports must disable preview scaling.

**Why:** A fixed-width sheet or an off-screen measurement surface can widen the phone document and make Safari shrink the whole interface. Conversely, using the fitted page's visual height for pagination hides real A4 overflow.

**How to apply:** Keep measurement surfaces out of the document's scrolling bounds. Fit only the paper, not the controls, and confirm that resizing does not change page count or reduce export resolution.