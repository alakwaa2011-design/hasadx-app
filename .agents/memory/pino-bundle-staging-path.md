---
name: Pino bundle staging path
description: Why staging an API bundle in a temporary directory breaks development logging after promotion
---

Pino's esbuild plugin embeds the configured output directory as an absolute path for its worker files. A bundle built directly into a temporary directory and then moved may start in production mode but fail in development mode when its logging worker exits.

**Why:** The production smoke check does not use the development logging transport, so it cannot catch a worker path that becomes stale after promotion.

**How to apply:** When building a candidate bundle, configure esbuild's output directory as the final runtime location and stage the emitted bytes separately before promotion. Verify the development-mode process after changing this build flow.