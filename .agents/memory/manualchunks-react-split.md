---
name: manualChunks React split breaks production
description: Hand-splitting react/react-dom into a separate vendor chunk caused a blank production site
---

Rule: never use Rollup/Vite `manualChunks` to split react/react-dom away from other vendor code in this monorepo's web apps. Let Rollup decide chunking.

**Why:** Production-only failure — `Cannot set properties of undefined (setting 'Children')` thrown at module init, React never mounts, site is a permanently blank page. Dev server is unaffected (no chunking), so it only appears after deploy. Splitting by `id.includes(...)` puts interdependent vendor modules in different chunks with a circular init order.

**How to apply:** If a build suddenly shows a blank page in production but works in dev, probe with headless chromium (nix chromium binary + workspace playwright, executablePath override) to capture `pageerror` — console-less white pages almost always have a JS init error. Check vite.config for manualChunks first.
