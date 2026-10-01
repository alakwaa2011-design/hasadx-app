# Production frontend build gate

`pnpm --filter @workspace/homework-app run build` ends with
`test:smoke:built`. It launches **serve.mjs**, the production static server,
against the final `dist/public` output **after prerender**. A failed browser
launch, missing asset, root error fallback, application JS error, missing home
content, or missing login form makes the build exit nonzero. There is no
skip-on-error path and no Vite development server.

Commands:

- `pnpm --filter @workspace/homework-app run test:smoke:built`: repeat the gate
  on an existing build. It deliberately ignores `SMOKE_URL`.
- `pnpm --filter @workspace/homework-app run test:smoke:guards`: regression
  cases demonstrating that HTTP 200 with a broken UI fails the health check.
- `SMOKE_URL=https://your-published-origin pnpm --filter @workspace/homework-app run test:smoke`:
  optional remote check, not the build gate.

No database or API server is started. Fresh browser contexts use synthetic
anonymous API responses, consume page-view/heartbeat telemetry locally, block
other mutations and unconfigured reads, and block external HTTP and WebSocket
connections. No login is submitted. This checks bundle/provider/route startup,
not real authentication or backend availability. Service workers are blocked
so an old cached version cannot satisfy the gate.

The gate uses system Chromium when present, otherwise installs Playwright's
Chromium in clean builders. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an
existing browser. Browser security and Chromium sandbox remain enabled;
launch/install problems fail the build instead of disabling protections.

Uncaught JS errors and `console.error` calls fail. Browser network diagnostics
(such as the synthetic anonymous 401) are not JS exceptions; first-party script
and CSS request failures are checked separately. Only identifiable browser-tool
sources and the exact Google GSI localhost-origin rejection are exempt.
An equivalent Google error on a public origin or from an app asset still fails.
Screenshots and traces for failures are written to `test-results/production-smoke`.