---
name: Trusted-device login verification
description: Security contract for one-time verification on a teacher's browser.
---

After a correct password, an untrusted browser must complete a short-lived login OTP challenge. Successful verification issues a long-lived, HttpOnly, SameSite cookie backed by only a server-side token hash. Normal logout and session expiry do not revoke that browser trust.

**Why:** A normal login session is intentionally short-lived and cannot represent “this browser was confirmed.” Fingerprints based on IP and user agent are useful for alerts but are not authentication credentials.

**How to apply:** Keep account-verification OTP state separate from login-challenge state. Never accept a login OTP unless the same server session first passed the password check. Revoke trusted tokens after password changes, password resets, explicit device revocation, or comparable suspicious events.