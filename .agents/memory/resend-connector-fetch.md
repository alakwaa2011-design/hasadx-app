---
name: Resend connector credential fetch
description: How to correctly fetch Resend connector credentials from the Replit connectors API
---

The connectors API endpoint `GET /api/v2/connection?include_secrets=true&connector_names=resend` returns **0 items** even when the Resend connection exists. The `connector_names` filter silently excludes it.

**Why:** Observed Aug 2026 — filtered query returned empty while the unfiltered `?include_secrets=true` query returned the connection (with `settings.api_key` and `settings.from_email`). This silently broke all OTP/verification emails ("resend_not_configured").

**How to apply:** In `email.ts` (api-server), fetch connections WITHOUT the `connector_names` filter and match client-side by `connector_name === "resend"` or id prefix `conn_resend_`. Never re-add the server-side filter. The connector's `settings.from_email` (noreply@hasaadx.com, verified domain) is the preferred sender; the API key is send-only (cannot list domains).

Resend delivery failures can resolve normally as `{ delivered: false, reason }` instead of rejecting the promise. A fire-and-forget call with only `.catch(...)` therefore misses quota and provider rejections and can report success to the user.

**Why:** A registration was accepted while Resend had exhausted its daily sending quota; the provider rejection was returned as data and never appeared in the OTP send failure log.

**How to apply:** Authentication and other user-critical email flows must await `sendEmail()`, inspect `delivered`, log only the safe reason, and return an actionable retry message instead of claiming the message was sent.

An `added` Resend integration in the workspace does not prove that the published app can resolve its credentials. A production `resend_not_configured` result means the application never called Resend; it does not identify a provider rejection, API key, or provider account. The integration's restricted send-only key also cannot list domains for confirmation.

**Why:** In September 2026, production OTP and admin-digest attempts returned `resend_not_configured` while the workspace integration remained added. The credential lookup suppressed the specific failure, so the available logs could establish the failure boundary but not whether the runtime token, connector response, or key setting was missing.

**How to apply:** For production delivery investigations, separate workspace connection status from runtime credential resolution. Do not attribute a failed send to Resend, a dashboard account, or a domain until production logs show the request reached the provider; add safe diagnostics if the exact connector failure branch must be established.
