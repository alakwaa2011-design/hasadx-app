---
name: checkCredits fail-closed policy
description: Unexpected credit-verification errors block the request with 503, never fall through to the AI provider.
---
Rule: any unexpected error in `checkCredits` (settings read, unlimited lookup, hold) returns 503 `CREDITS_CHECK_UNAVAILABLE` with the Arabic "تعذر التحقق من رصيد نقاط حصاد حالياً" message — the request must NOT reach a paid AI provider. Insufficient balance stays a distinct 402 `INSUFFICIENT_CREDITS`.

**Why:** user explicitly rejected fail-open ("لا أقبله") — a DB hiccup must not give away free paid-provider usage, and verification failure must never be shown as "insufficient credits".

**How to apply:** never reintroduce `next()` in the middleware catch. Edge: a DB error in the replay-snapshot lookup after an existing hold can leave a pending hold; the 60s stale-hold sweeper refunds it — acceptable.

Also: guest AI routes (quick-challenge guest-ai-generate, million-game, wheel, public-content) are DELIBERATELY uncharged (guests have no accounts); they're controlled by IP rate limits + admin guest limit (0 disables). Don't add checkCredits to them without a product decision.
