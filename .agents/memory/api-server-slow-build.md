---
name: API server slow build & restart
description: Why the api-server workflow can time out and how to restart it safely
---
The api-server dev workflow runs a full esbuild bundle (~20MB output) before starting. Under machine load (several vite servers running) the build can take 2+ minutes, so `WorkflowsRestart` with the default timeout fails with "didn't open port 8080" even though nothing is broken.

**Why:** The workflow command is `build && start`; the port only opens after the whole bundle finishes. The server itself binds within ~2s once started.

**How to apply:** Restart this workflow with `workflow_timeout: 300`. If it still fails, run the dist manually with `PORT=... node dist/index.mjs` to distinguish build slowness from a real startup crash — don't assume the code is broken.
