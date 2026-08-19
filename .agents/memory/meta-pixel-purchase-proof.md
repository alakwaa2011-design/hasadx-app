---
name: Meta Pixel purchase proof
description: Browser conversion tracking must only emit Purchase after a unique server-confirmed payment status.
---

`Purchase` is safe for one-time credit packages only when the browser polls the server-owned purchase intent and receives `paymentStatus === "completed"`. Subscription return URLs and balance changes alone are not unique payment proof, so they must not emit Purchase.

**Why:** A subscription can already be active and a balance can change for reasons unrelated to the current checkout; treating either as payment confirmation overcounts conversions.

**How to apply:** Keep the Pixel browser-only, use a server-generated intent as the dedupe marker, and add subscription Purchase only after an endpoint exposes an equivalent unique, server-confirmed transaction result.