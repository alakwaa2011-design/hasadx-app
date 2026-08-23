---
name: Playwright cache fallback
description: How to run a browser check after the workspace Playwright browser cache has been removed.
---

After cleaning `.cache/ms-playwright`, the Playwright package may still be installed but its expected browser executable is absent. For a one-off browser verification, launch Playwright with the Nix-managed Chromium executable explicitly rather than re-downloading a browser cache.

**Why:** Cache cleanup intentionally removes the versioned Playwright download, while Replit's environment may already have a usable Chromium binary outside that cache.

**How to apply:** Confirm the installed browser executable exists, pass it through Playwright's `executablePath`, and keep the workaround limited to local tests. Do not hardcode it into application code.