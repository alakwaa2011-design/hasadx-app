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

Printing from the creator must isolate the actual paper from the editor and neutralize fixed, scrolling, or transformed preview ancestors. Correct A4 articles alone do not make a modal safe to print.

**Why:** The original creator overlay contained two distinct question pages but Chromium produced three physical PDF pages, included editor controls, and repeated the first question. The saved print route did not reproduce that failure.

**How to apply:** Verify both creator-preview and saved-page export paths, including a scrolled preview. Assert distinct question markers and DOM-to-physical-page parity; test two and three question pages with answer keys disabled, then verify answer-key pagination separately.

Do not solve print isolation by temporarily moving a live React-owned paper node to a different parent.

**Why:** A fragment-owned paper moved outside its original parent produced React `NotFoundError` during unmount. Checking that the former parent is still connected does not establish that the component still owns the node.

**How to apply:** Prefer print-media-only ancestor isolation or an independent snapshot. Keep preparation bounded and cancel stale exports when the original paper disconnects; verify close/navigation and retry, not only successful printing.

When the complete first-page identity header and one question each fit A4 but cannot fit together, retain a real header-only first page.

**Why:** The playful theme exposed an uncounted native header page. Shrinking the fixture title, removing identity fields, or shortening the selected response area hid the mismatch instead of preserving the teacher's content.

**How to apply:** Count that header page in the preview and PDF. Do not repeatedly move a question that also overflows a continuation page; reject that unsupported layout clearly unless proper question continuation is implemented.