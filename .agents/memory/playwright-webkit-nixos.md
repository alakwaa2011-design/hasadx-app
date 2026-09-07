---
name: Playwright WebKit on NixOS
description: Environment constraints for running Playwright WebKit alongside Replit's managed Chromium fallback.
---

Apply any managed Chromium `executablePath` only to Chromium projects, never in the shared Playwright `use` block.

**Why:** A shared executable path silently makes a project named WebKit launch Chromium. Playwright's downloaded WebKit binary also targets Ubuntu libraries and does not run on the default Replit NixOS environment without a compatible library set.

**How to apply:** Keep WebKit projects free of Chromium launch options. Expect them to run in a compatible CI image, or explicitly provision a Replit-compatible WebKit runtime before requiring local execution.