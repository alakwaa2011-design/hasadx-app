---
name: Canonical domain redirect (hasaadx.com)
description: How the hasadx.com → hasaadx.com 301 works and the prod serving switch it required
---
Canonical domain is https://hasaadx.com; legacy hasadx.com + www.hasadx.com get a 301 preserving path+query.

**Why:** Replit deployments have no platform-level host redirect; the homework-app was served `static` in prod, so no code could see the Host header. Production serving was switched to the repo's own node server.

**How to apply:**
- Page routes: `artifacts/homework-app/serve.mjs` (compiled from `serve.ts`) checks x-forwarded-host/host at the top. **serve.mjs is generated — after editing serve.ts, recompile** (`npx tsc serve.ts --target es2022 --module es2022 --moduleResolution bundler --outDir /tmp/... && cp`). Prod run command is `node serve.mjs` (no tsx — tsx was undeclared and unsafe in pruned prod installs).
- API routes: early middleware in `artifacts/api-server/src/app.ts` before compression/helmet/cors, using `req.hostname` (trust proxy=1).
- artifact.toml prod changed from `serve = "static"` to `run = pnpm run serve`; edits must go through verifyAndReplaceArtifactToml.
- Never redirect hasaadx.com itself; Lemon Squeezy webhook stays at https://hasaadx.com/api/webhooks/lemonsqueezy.
