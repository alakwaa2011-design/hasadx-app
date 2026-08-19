---
name: Direct play links architecture
description: Token-based solo play links for teachers — design decisions and supported game types
---

## What it is
`/play/:token` — shareable URL that lets anyone play a solo game with no login, PIN, or teacher present.
Token is a 32-char random hex (not the assignmentId) to prevent enumeration.

## DB table: direct_play_links
- One stable row per (assignment_id, game_type, teacher_id) — idempotent creation
- UNIQUE index on (assignment_id, game_type, teacher_id) prevents duplicates
- Token is UNIQUE indexed for fast lookup

## Supported game types
- **wameeth**: uses `createGame()` + `startGameFromRest()` — long-standing solo path, works perfectly
- **rocket_race**: uses `createRocketGameDirectly()` + `startRocketGameFromRest()` — headless exports added to rocket-handlers.ts

## Rocket late-join pattern
The rocket game is created AND started (via `startRace(_rocketNs, game)`) BEFORE the player connects.
The player navigates to `/game/rocket/play/:pin?name=...` and emits `rocket:join`.
The join handler already handles `state === "racing"` (late-join path, lines 616–643 in rocket-handlers.ts):
it sends `rocket:race-start` directly to the joining socket with remaining time.
This works cleanly — no modification to the join handler was needed.

## Unsupported game types (documented reasons)
- **tug_of_war**: inherently 2-team game; one player = meaningless rope
- **escape_room**: join flow requires separate socket handshake, not URL params
- **million / wheel / hack**: require live teacher interaction

## _rocketNs module-level variable
`_rocketNs` is set inside `setupRocketSocket` when the server starts.
`startRocketGameFromRest` checks `if (!_rocketNs) return error` — safe guard.

**Why:** Needed to call `startRace(rocketNs, game)` from a REST context without a socket.

**How to apply:** If adding other REST-initiated game types in the future, follow the same pattern:
store the namespace at module level, export a headless create + a headless start function.

## Rate limiting
`POST /api/play/:token/start` — in-memory IP bucket: 20 starts/IP/minute.
No external npm dependency; Map cleaned every 5 minutes.

## Frontend UI
- `DirectPlayLinkButton` in dashboard.tsx now takes `gameType` prop
- Two buttons shown side by side: one for wameeth, one for rocket_race
- Clicking calls `POST /api/assignments/:id/play-links` to get/create the token, then copies URL to clipboard
- State machine: idle → loading → copied (2.5s) → idle
