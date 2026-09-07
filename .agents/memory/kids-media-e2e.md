---
name: Kids media browser checks
description: Browser coverage must validate rendered asset dimensions and real audio playback, not only catalog keys or file existence.
---

Kids media regression checks should enter through a real child session and daily-journey route, then assert image natural dimensions, audio readiness, and playback after a user gesture. Keep the fixture on the isolated test database and fail on unapproved-asset UI states or failed media requests.

**Why:** Catalog/file checks can pass while the browser still cannot resolve, decode, or play an asset.

**How to apply:** When adding or changing Kids catalog media, extend the isolated Playwright journey rather than relying only on registry or API tests. To exercise recovery UI, dispatch a DOM `Event("error")` from `evaluate`; Playwright's own `dispatchEvent("error")` is surfaced as a page runtime error, and network interception can be bypassed by a preloaded media request.