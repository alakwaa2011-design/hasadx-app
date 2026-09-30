---
name: Native QCF color support
description: Device-rendering constraint for the official QCF V4 COLRv1 Tajweed fonts.
---

Successfully downloading and registering an official COLRv1 TrueType font is not evidence that the native text renderer actually displays its embedded Tajweed colors. Treat the colored display as unverified until it is viewed on the target Android and iPhone devices. If colors cannot be rendered, keep the readable QCF V2 page and explain the limitation rather than deriving colors from invented rule mappings.

In night mode, COLRv1 can paint its default ink nearly black even when the surrounding text style specifies a light color. Fix contrast on the painted glyph only, preserving the original rule colors and avoiding changes to page backgrounds or day/warm appearances; computed text color alone is not proof that the rendered ink is legible.

**Why:** Expo font loading validates a file and registers a family; color-layer rendering depends independently on the operating system and React Native text engine. In the web preview the night-mode base ink remained black despite a light text color, making verses hard to read until the actual glyph painting was corrected.

**How to apply:** When changing or announcing mobile Tajweed, check several verses in all reader appearances on actual devices (including offline reopening), compare them with the official V4 rendering, and report the result separately from TypeScript, network, and font-load checks.