---
name: Quran safe-area testing
description: How to simulate device safe-area insets reliably in Quran reader browser tests.
---

Managed Chromium may not expose `Emulation.setSafeAreaInsets`, even when Playwright's protocol typings accept arbitrary CDP commands. Quran reader tests should install a persistent style element that sets the reader's safe-area CSS custom property from a Playwright init script before navigation.

**Why:** CDP safe-area emulation failed at runtime because the managed browser did not implement the command. Injecting after navigation raced with redirects, while setting the root element's inline style before navigation was later cleared during app initialization.

**How to apply:** For Quran viewport tests, use `page.addInitScript` to append a style element after the document head exists, with an `!important` CSS-variable override, before `page.goto`. Production must keep `env(safe-area-inset-*)` as the fallback.