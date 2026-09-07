---
name: Playwright WebKit on NixOS
description: Environment constraints for running Playwright WebKit alongside Replit's managed Chromium fallback.
---

Apply any managed Chromium `executablePath` only to Chromium projects, never in the shared Playwright `use` block. On Replit, launch WebKit through a dedicated wrapper that preserves its bundle library paths and appends the Nix runtime path plus GCC's `libatomic`.

**Why:** A shared executable path silently makes a project named WebKit launch Chromium. Playwright's downloaded launcher replaces `LD_LIBRARY_PATH`, hiding Replit's Nix libraries; headless WebKit also emits a harmless audio-device error that the Vite runtime overlay can turn into a page-blocking modal.

**How to apply:** Keep WebKit projects free of Chromium launch options, provision its GTK/WPE media libraries in Nix, and disable the Vite runtime-error overlay only for isolated E2E servers. Validate both browser startup and the targeted WebKit project.