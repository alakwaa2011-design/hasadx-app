---
name: Workspace query context singletons
description: Why deduplicating React alone does not prevent missing-provider crashes in production workspace bundles.
---

Treat context-bearing libraries used by both an app and shared workspace hooks as singletons, independently of React itself. PNPM can install multiple physical copies of the same library version for different React peer versions; deduplicating React does not merge those libraries' context objects.

**Why:** A published frontend contained two TanStack Query contexts even though its provider correctly wrapped every route. The app's provider and shared generated hooks read different contexts, causing a site-wide `No QueryClient set` error.

**How to apply:** When debugging a missing-provider error with correct provider nesting, compare the app's and shared library's resolved package paths and inspect the production bundle, not only the development server. Preserve a single module instance for the provider and consumers.

HTTP 200, a removed splash, and nonempty React markup are not enough to establish healthy startup: a root error fallback meets all three conditions.

**Why:** Those checks reported the site as available while users saw its crash screen.

**How to apply:** Production smoke checks must reject the root error fallback and uncaught JavaScript errors, and verify meaningful page controls after asynchronous startup.

Release startup checks should use the final prerendered output and synthetic anonymous API responses, not authenticated production sessions.

**Why:** Static crawler content can disguise a failed React startup, while live accounts and automatic telemetry can turn a release check into unintended production reads or writes.

**How to apply:** Require React-only home/login controls after session resolution; intercept telemetry locally, block other mutations and WebSockets, and treat browser installation or launch failure as a failed gate. Backend availability and real authentication need separate isolated tests.