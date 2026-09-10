---
name: Solo challenge (وميض فردي) data persistence
description: Where per-player results for the وميض فردي solo challenge are (and are NOT) stored
---

# Solo challenge data persistence

There are TWO separate "solo" systems — do not confuse them:

1. **وميض فردي solo challenge** (public, slug-based, anonymous players).
   - Routes: `public-content.ts` (`GET /solo-challenges/:slug`, `POST .../start`, `POST .../score`, `GET .../leaderboard`).
   - Completed leaderboard results live in `solo_challenge_scores`; started attempts are persisted separately so the server can enforce the configured per-device attempt limit.
   - `POST .../start` calls `createGame(..., "solo")` but the resulting in-memory game does **NOT** write to `game_history`. Confirmed in prod: zero `game_history` rows for solo-challenge play days.
   - Results are accepted only when a persisted attempt identity matches the server-side game run; the server computes points, correctness, and time from game state rather than trusting browser values.
   - **Why this matters:** `game_history` remains unavailable as a recovery source. Attempt identities and unique result keys must stay aligned so retries are idempotent without permitting forged or excess attempts.
   - **How to apply:** any new self-challenge start/result flow must carry the same persistent device participant key and server-issued game-run proof. Never reintroduce client-authoritative score fields.
   - Class-restricted links use a challenge-scoped roster: expose minimized display names plus opaque signed selection tokens, then resolve the full teacher-owned student record server-side at start.
   - **Why:** students need to choose themselves without typing, but public challenge routes must not reveal database IDs or trust a browser-supplied name/class pairing.
   - **How to apply:** keep manual-name fallback available only after a permitted class is chosen; unrestricted challenges continue using direct name entry.

2. **Live solo game** (`gameMode='solo'` in `game_history`, 207+ rows in prod). This is a different feature — PIN-based live games. `socket-handlers.ts` `finishGame` writes `game_history.detailedResults` with per-player name/score/totalCorrect. This system DOES persist; the وميض فردي one does not.

**Known historical bug (fixed 2026-05-30):** frontend sent `points` but backend read `score` → all scores saved as 0; `correctCount` was never saved; `timeTaken` never sent/saved. Any solo-challenge play recorded before that fix has score=0/correctCount=0 and is unrecoverable.
