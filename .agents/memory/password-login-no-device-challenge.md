---
name: Password login has no device challenge
description: Product decision that classroom device changes must not add verification friction.
---

A teacher with valid credentials must be able to sign in from any device using email/password, or use Google directly, without a device-verification code. Device records may remain for login alerts and session management, but they must never gate login and must not expire into a new challenge.

**Why:** Teachers may enter ten or more classrooms/devices for the first time, so per-device verification creates unacceptable classroom friction.

**How to apply:** Keep initial account activation separate from login. Do not add trusted-device cookies, device OTP challenges, or fingerprint-based login gates to password or Google authentication.