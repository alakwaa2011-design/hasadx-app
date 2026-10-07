---
name: Modal control reachability
description: Avoid false browser-test failures when a confirmation cancellation leaves its parent menu open.
---

Do not force-click a card's underlying menu trigger while a modal is still open. Canceling a destructive confirmation can return to its parent dialog instead of closing the entire dialog.

**Why:** During collaboration-board testing, a forced click bypassed Playwright's overlay checks but hit the backdrop, closing the dialog. Waiting for a delete control afterward looked like a product failure and blocked unrelated verification.

**How to apply:** Assert the current dialog state after cancel. Continue within that dialog, or close it explicitly before clicking the visible card trigger normally. Keep independent settings and timer checks separate so one bad locator does not leave them untested.
