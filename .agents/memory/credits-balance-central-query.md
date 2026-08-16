---
name: Central credits balance query
description: How the frontend keeps نقاط حصاد in sync after AI operations
---
The teacher's credits balance has ONE frontend source of truth: the react-query key `CREDITS_BALANCE_QUERY_KEY` (["credits-chip-balance"]) exported from `components/credits-chip.tsx` alongside `useCreditsBalance()` (full /api/credits/me shape) and `useRefreshCreditsBalance()` (invalidates the key).

**Rule:** every UI path that calls a credit-charged AI endpoint must call `useRefreshCreditsBalance()`'s callback in its `finally` (or mutation `onSettled`) — success AND failure, because refunds change the balance too. Never compute a deduction client-side; never keep a separate local balance state.

**Why:** the credits page and the activity creator each used to hold private balance copies (local useState / manual subtraction), so balances went stale or diverged after AI generate/extract until reload.

**How to apply:** when adding any new AI tool page, wire the refresh in the settle path; when showing a balance, read `useCreditsBalance()` — tool-price endpoints supply cost/creditsEnabled only.
