---
name: Resend connector credential fetch
description: How to correctly fetch Resend connector credentials from the Replit connectors API
---

The connectors API endpoint `GET /api/v2/connection?include_secrets=true&connector_names=resend` returns **0 items** even when the Resend connection exists. The `connector_names` filter silently excludes it.

**Why:** Observed Aug 2026 — filtered query returned empty while the unfiltered `?include_secrets=true` query returned the connection (with `settings.api_key` and `settings.from_email`). This silently broke all OTP/verification emails ("resend_not_configured").

**How to apply:** In `email.ts` (api-server), fetch connections WITHOUT the `connector_names` filter and match client-side by `connector_name === "resend"` or id prefix `conn_resend_`. Never re-add the server-side filter. The connector's `settings.from_email` (noreply@hasaadx.com, verified domain) is the preferred sender; the API key is send-only (cannot list domains).
