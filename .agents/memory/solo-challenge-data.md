---
name: Solo challenge (وميض فردي) data persistence
description: Where per-player results for the وميض فردي solo challenge are (and are NOT) stored
---

# Solo challenge data persistence

There are TWO separate "solo" systems — do not confuse them:

1. **وميض فردي solo challenge** (public, slug-based, anonymous players).
   - Routes: `public-content.ts` (`GET /solo-challenges/:slug`, `POST .../start`, `POST .../score`, `GET .../leaderboard`).
   - The ONLY persistence of per-player results is `solo_challenge_scores` (playerName, score, correctCount, timeTaken, playedAt).
   - `POST .../start` calls `createGame(..., "solo")` but the resulting in-memory game does **NOT** write to `game_history`. Confirmed in prod: zero `game_history` rows for solo-challenge play days.
   - **Why this matters:** if the score-write path has a bug (e.g. stores 0), the data is PERMANENTLY lost — there is no secondary source (no game_history, in-memory game is gone on restart). Cannot be reconstructed.

2. **Live solo game** (`gameMode='solo'` in `game_history`, 207+ rows in prod). This is a different feature — PIN-based live games. `socket-handlers.ts` `finishGame` writes `game_history.detailedResults` with per-player name/score/totalCorrect. This system DOES persist; the وميض فردي one does not.

**Known historical bug (fixed 2026-05-30):** frontend sent `points` but backend read `score` → all scores saved as 0; `correctCount` was never saved; `timeTaken` never sent/saved. Any solo-challenge play recorded before that fix has score=0/correctCount=0 and is unrecoverable.
