---
name: Native QCF color support
description: Device-rendering constraint for the official QCF V4 COLRv1 Tajweed fonts.
---

Successfully downloading and registering an official COLRv1 TrueType font is not evidence that the native text renderer actually displays its embedded Tajweed colors. Treat the colored display as unverified until it is viewed on the target Android and iPhone devices. If colors cannot be rendered, keep the readable QCF V2 page and explain the limitation rather than deriving colors from invented rule mappings.

**Why:** Expo font loading validates a file and registers a family; color-layer rendering depends independently on the operating system and React Native text engine.

**How to apply:** When changing or announcing mobile Tajweed, check several verses on actual devices (including offline reopening), compare them with the official V4 rendering, and report the result separately from TypeScript, network, and font-load checks.