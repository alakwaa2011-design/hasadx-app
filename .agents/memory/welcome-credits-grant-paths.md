---
name: Welcome credits grant paths
description: Every session-establishing auth route must call the shared welcome-grant helper
---
Welcome credits (source='free', reference_id='welcome_credits') are granted by a shared fire-and-forget helper in the auth routes file, called after session establishment in ALL login-like routes: password login, OTP verify, email-link verify, and Google login.

**Why:** The grant originally lived only in password login; teachers whose first session came via OTP/email-link/Google never received credits (silent, per-user permanent loss until backfilled).

**How to apply:** Any NEW route that sets `req.session.teacherId` for a teacher's first session must call the same helper — never inline a new grant block. Idempotency lives in CreditService.grantWelcomeCredits (tx + account lock + any-free-batch guard); no DB unique constraint exists, so never bypass the service. Route-level race tests: unverified accounts can't password-login (403 with pending OTP), so race two logins of a pre-verified teacher instead.
