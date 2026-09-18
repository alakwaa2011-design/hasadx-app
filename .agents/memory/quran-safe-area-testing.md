---
name: Quran safe-area testing
description: How to simulate device safe-area insets reliably in Quran reader browser tests.
---

Managed Chromium may not expose `Emulation.setSafeAreaInsets`, even when Playwright's protocol typings accept arbitrary CDP commands. Quran reader tests should set the reader's safe-area CSS custom property with a Playwright init script before navigation.

**Why:** CDP safe-area emulation failed at runtime because the managed browser did not implement the command, and injecting a style after navigation raced with the Quran route's internal redirect.

**How to apply:** For Quran viewport tests, install the CSS-variable override through `page.addInitScript` before `page.goto`. Production must keep `env(safe-area-inset-*)` as the variable's fallback.