---
name: Safe in-app back navigation
description: Rules for reliable back buttons across routed pages, direct links, and stateful multi-step flows.
---

Route-level back buttons must use the app-owned navigation stack and an explicit context-appropriate fallback. Never use the browser history length or direct browser back as the fallback decision.

**Why:** Browser history can contain external pages, redirects, or unrelated entries, and direct game links may have no valid parent page. This caused back buttons across games and public pages to leave the app or land on an invalid step.

**How to apply:** Use the shared smart-back hook for routed pages and preserve the complete path including query parameters. Keep back actions inside OTP, builders, dialogs, and other multi-step forms state-local so they do not unexpectedly leave the flow or discard drafts.