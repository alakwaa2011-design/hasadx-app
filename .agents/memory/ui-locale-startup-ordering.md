---
name: UI locale startup ordering
description: Prevents startup crashes and first-request language mismatches in the bilingual web app.
---

The locale provider must wrap any root-level error boundary that consumes locale state. API request locale decoration must be available synchronously when the locale module loads, rather than installed in a passive React effect.

**Why:** A root error boundary outside the provider crashes while trying to render a localized failure state. Descendant page effects can dispatch their first API request before the provider's passive effect installs a fetch interceptor, causing the server to use the browser/default language instead of the selected app locale.

**How to apply:** Keep global locale-dependent wrappers under `I18nProvider`. For app-wide request metadata, use a synchronous, idempotent initialization that reads the persisted locale at request time; do not rely on a provider `useEffect` for first-load correctness.