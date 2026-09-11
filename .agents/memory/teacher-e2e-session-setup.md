---
name: Teacher E2E session setup
description: How browser fixtures establish an authenticated teacher session after the registration flow changed.
---

Teacher browser fixtures should create a dedicated teacher in the isolated test database with a short-lived OTP, then call `/api/auth/verify-otp` and attach the returned session cookie. Do not rely on the public registration response to auto-login the teacher.

**Why:** The registration endpoint intentionally returns a pending-verification response and no session cookie, so helpers that assume registration auto-login fail before the browser reaches the page under test.

**How to apply:** For new authenticated teacher E2E specs, follow the direct fixture plus OTP verification pattern used by the class-management browser coverage; keep the fixture database isolated and clean up the teacher afterward.