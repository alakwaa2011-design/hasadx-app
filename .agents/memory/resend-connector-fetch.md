---
name: Resend connector delivery
description: Why connected Resend sends use the connector proxy and must inspect send results
---

For connected Resend delivery, use the connector's authenticated proxy to POST to the provider rather than extracting `settings.api_key` from a connection listing. Preserve a directly configured production key as an alternative, not a dependency of the connector path.

**Why:** An earlier August 2026 workaround fetched connector settings unfiltered after a filtered query unexpectedly returned zero items. By September 2026 the added connection's SDK instructions explicitly used the proxy, while credential lookup returned no accessible key and production OTPs failed with `resend_not_configured`. A send-only connector key can still accept a controlled send even when listing domains returns `restricted_api_key`.

**How to apply:** For app sends, use the documented connector proxy; verify successful provider acceptance by the returned message id. A read-only domains check does not establish whether a send-only key works. A controlled `delivered@resend.dev` test confirms acceptance without sending to a real user, but does not prove production is running the updated code.

Resend delivery failures can resolve normally as `{ delivered: false, reason }` instead of rejecting the promise. A fire-and-forget call with only `.catch(...)` therefore misses quota and provider rejections and can report success to the user.

**Why:** A registration was accepted while Resend had exhausted its daily sending quota; the provider rejection was returned as data and never appeared in the OTP send failure log.

**How to apply:** Authentication and other user-critical email flows must await `sendEmail()`, inspect `delivered`, log only the safe reason, and return an actionable retry message instead of claiming the message was sent.

An `added` Resend integration in the workspace does not prove that the published app can send. A production `resend_not_configured` result from an older credential-reading implementation means that implementation never called Resend; it does not identify a provider rejection, API key, or provider account.

**Why:** In September 2026, production OTP and admin-digest attempts returned `resend_not_configured` while the workspace integration remained added. The credential lookup suppressed the specific failure, so the available logs could establish the failure boundary but not whether the runtime token, connector response, or key setting was missing.

**How to apply:** For production delivery investigations, separate workspace connection status, provider acceptance in development, and real production mailbox delivery. Do not promise live delivery until the new build is published and a production attempt confirms it.
