---
name: TTS audio cache financial invariants
description: Per-teacher persistent TTS cache — capture gate, lease fencing, compensation rules
---

Rule set for the teacher TTS cache (tts_audio_cache + lib/tts-cache):
- Serve only after CONFIRMED capture: `CreditService.capture` returns `{ captured }`; a zero-row capture means the hold was refunded/expired by recovery — re-read `getHoldStatus` and never serve unless it is `completed`.
- `credit_request_id` is the generation lease token: every row mutation (storage_key write, markReady, markFailed) is fenced by `AND credit_request_id = ...`; takeover rewrites it, invalidating stale workers.
- Compensation (`CreditService.compensateCapturedHold`, atomic completed→refunded claim, tx type `compensation`) runs ONLY on definitive storage absence (`exists() === false` or download 404). Missing storage_key ≠ missing file → indeterminate, stay pending.
- Transient storage/DB errors during recovery: zero financial actions, row stays pending, re-checked lazily on next request.
- Cache hit = no hold, no charge. Cleanup is opportunistic via single-row `tts_cache_state` 24h claim (autoscale-safe, no setInterval).

**Why:** architect review found serving-uncharged-audio and double-charge races when capture success was assumed and ownership wasn't fenced.
**How to apply:** any new cached-paid-artifact flow must copy this pattern: pre-generated idempotency key stored in the pending row, captured-flag gate, lease fencing, definitive-absence-only compensation.
