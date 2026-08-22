---
name: Nested page landmarks
description: How to inspect visual section order when the layout shell and a page both render main landmarks.
---

When diagnosing public-page visual order, inspect the page-local content landmark rather than assuming the first `<main>` is the section container.

**Why:** The layout shell and homepage each render a main landmark. A direct-child DOM check on the outer landmark sees only the inner content container and footer, which can falsely suggest that section ordering styles have no effect.

**How to apply:** For visual-order tests, first identify the landmark that directly contains the content sections, then sort those children by their layout position or computed `order`.