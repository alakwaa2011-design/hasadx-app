---
name: Activity library responsive controls
description: The responsive mobile library uses the same state-owning filter logic as the desktop marketplace.
---

The Activity Library marketplace is a presentation layer. Its parent owns the search, subject, grade, sorting, and data-filtering state; responsive controls must always route through those callbacks rather than construct a second mobile filter pipeline.

**Why:** Separate mobile query or filtering logic can drift from the visibility, ownership, and sort rules already enforced by the parent view.

**How to apply:** Keep desktop and mobile inputs bound to the same props. A mobile-only type control may update the existing local display tab, but must retain the established tab/presentation routing.