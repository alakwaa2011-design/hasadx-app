---
name: Express route shadowing from duplicate path handlers across routers
description: How a duplicate/legacy route handler in an earlier-mounted router can silently shadow a newer, actively-maintained handler for the same path in this codebase.
---

`routes/index.ts` mounts sub-routers in a fixed order (`router.use(...)` calls). If two different route files define a handler for the exact same path (e.g. `GET /solo-challenges/:slug`, `POST /solo-challenges/:slug/start`), the one mounted first wins — Express never reaches the second, later one. TypeScript/build tooling does not flag this; it silently "just works" for the old behavior.

**Why:** `public-content.ts` had legacy solo-challenge routes (GET `/solo-challenges/:slug`, POST `/solo-challenges/:slug/start`, `/score`, `/leaderboard`) that predated a rewrite of the same routes in `solo-challenges.ts` (which added standalone challenges, per-participant randomized question subsets, etc). `public-content.ts` is mounted before `solo-challenges.ts` in `routes/index.ts`, so every request kept hitting the old, feature-incomplete handlers — the new code was completely dead and untestable via HTTP even though it typechecked and looked correct.

**How to apply:** When adding/modifying a route in one router file, grep the whole `artifacts/api-server/src/routes/` directory for the same path string before assuming your change takes effect. If a duplicate exists in an earlier-mounted router, delete the stale duplicate rather than leaving both — don't just add a comment, since dead code like this is easy to miss again later. Confirm the true behavior with a live `curl` through the proxy (not just typecheck), especially for public/unauthenticated endpoints.
