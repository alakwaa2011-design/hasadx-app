---
name: Playwright WebKit on NixOS
description: Environment constraints for running Playwright WebKit alongside Replit's managed Chromium fallback.
---

Apply any managed Chromium `executablePath` only to Chromium projects, never in the shared Playwright `use` block. On Replit, launch WebKit through a dedicated wrapper that preserves its bundle library paths and appends the Nix runtime path plus GCC's `libatomic`. Headless WPE can still crash the page when real media playback starts, even with uncompressed WAV; treat that as a host limitation and run media assertions in CI or on a device-capable host.

**Why:** A shared executable path silently makes a project named WebKit launch Chromium. Playwright's downloaded launcher replaces `LD_LIBRARY_PATH`, hiding Replit's Nix libraries; headless WebKit also has incomplete audio-device support that may emit an overlay error or terminate the page when playback starts.

**How to apply:** Keep WebKit projects free of Chromium launch options, provision its GTK/WPE media libraries in Nix, and disable the Vite runtime-error overlay only for isolated E2E servers. Validate browser startup locally; if real audio crashes WPE, preserve the WebKit test and use CI or physical-device execution for its media verdict.

WebKit synthetic touch events dispatched from page JavaScript do not generate native compatibility clicks or browser scrolling. A manually dispatched click is only a check of app-side suppression, not proof of the browser's native gesture behavior; never fabricate one for a toolbar swipe and interpret it as Safari's behavior.

**Why:** A swipe test counted a fabricated toolbar click as a browser regression even though the gesture had not generated that click.

**How to apply:** Use synthetic events to exercise the touch-handler branches, and reserve real iPhone testing for native scrolling/click behavior.