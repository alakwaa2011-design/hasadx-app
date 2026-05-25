---
name: Proxy path prefix collision
description: Short path prefixes in artifact.toml can silently break React app routes that share the same starting letter.
---

**Rule:** Never add a single-letter or short prefix to artifact.toml `paths` without first checking that NO existing React route starts with the same characters.

**Why:** The shared reverse proxy matches by prefix, not exact path. Adding `"/s"` to the API server routes ALL requests beginning with `/s` to the API server — including `/solo/:slug`, `/student/*`, `/solve/*`, which are React app routes. The React app returns 200 for those paths (SPA fallback) so the breakage is silent until a user hits one.

**How to apply:** Before adding any new path prefix to artifact.toml, run:
```
grep -h 'path="/' artifacts/homework-app/src/App.tsx | grep -oP '"/[a-zA-Z][^/"]*' | sort -u
```
and confirm the new prefix doesn't collide with any top-level route segment. Safe alternative: nest new API-only routes under the already-owned `/api` prefix (e.g. `/api/s/:shortSlug` instead of `/s/:shortSlug`).
