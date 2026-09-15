---
name: Direct play links architecture
description: Opaque public links for assignments, saved games, and classroom displays
---

## What it is
`/play/:token` — shareable URL that lets anyone open a supported game with no login and without exposing an internal activity or teacher ID.
Token is a 32-char random hex (not the assignmentId) to prevent enumeration.

## DB table: direct_play_links
- One stable row per (assignment_id, game_type, teacher_id) — idempotent creation
- UNIQUE index on (assignment_id, game_type, teacher_id) prevents duplicates
- Token is UNIQUE indexed for fast lookup

## Supported patterns
- **wameeth**: uses `createGame()` + `startGameFromRest()` — long-standing solo path, works perfectly
- **rocket_race**: uses `createRocketGameDirectly()` + `startRocketGameFromRest()` — headless exports added to rocket-handlers.ts
- **Saved classroom games**: load a sanitized persisted setup directly from the opaque token.
- **Saved live-room games**: each link opening creates a fresh in-memory room and returns an opaque host-control capability; the permanent link never depends on an old room.

**Why:** A permanent game link must survive server restarts and teacher-session closure while preserving the selected mode. Persist the source configuration, not the transient room.

**How to apply:** Derive public configuration from the current saved source, reject deleted/malformed sources uniformly, and keep room IDs and control capabilities out of the permanent URL.

## Rocket late-join pattern
The rocket game is created AND started (via `startRace(_rocketNs, game)`) BEFORE the player connects.
The player navigates to `/game/rocket/play/:pin?name=...` and emits `rocket:join`.
The join handler already handles `state === "racing"` (late-join path, lines 616–643 in rocket-handlers.ts):
it sends `rocket:race-start` directly to the joining socket with remaining time.
This works cleanly — no modification to the join handler was needed.

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
