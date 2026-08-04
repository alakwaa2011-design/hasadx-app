---
name: API server slow build & restart
description: Why the api-server workflow can time out and how to restart it safely
---
The api-server bundles ~20 MB with esbuild before starting; under load this takes 2+ minutes. Use `workflow_timeout: 300` when restarting. If it still fails, run `PORT=... node dist/index.mjs` directly to distinguish a slow build from a real crash.
