---
name: Configured admin promotion
description: Ensures configured administrator emails receive admin status even when their development account is created after startup.
---

Promote allowlisted administrator emails during login and authenticated session refresh, in addition to the startup database seed.

**Why:** A fresh preview account can be created after the server's one-time startup seed, leaving a known administrator logged in as a normal teacher and causing admin APIs to return 403.

**How to apply:** Keep the email allowlist centralized and normalized. Repair the persisted teacher role on password login, Google login, and `/auth/me`; admin API guards should continue checking the database flag rather than trusting client state.