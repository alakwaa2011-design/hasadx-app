---
name: Meta Pixel bootstrap
description: Meta Pixel bootstrap must delegate through callMethod after fbevents.js loads.
---

Use the official function-style `fbq` bootstrap: queue `arguments` only before the library is ready, then call `fbq.callMethod.apply(fbq, args)`.

**Why:** A queue-only wrapper leaves valid events stranded after `fbevents.js` loads, so no measurement request is sent.

**How to apply:** Do not replace the bootstrap with an arrow-function queue helper. In automated browser checks, Meta's bot-blocking plugin can suppress `tr`; validate with a normal browser fingerprint as well.