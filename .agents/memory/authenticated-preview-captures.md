---
name: Authenticated preview captures
description: Capturing reliable screenshots of authenticated classroom pages with isolated browser fixtures.
---

Use an isolated E2E fixture rather than the generic preview screenshot for authenticated teacher pages. The generic preview browser does not inherit a teacher session.

**Why:** A visible DOM assertion can pass while an immediate full-page screenshot still catches the loading splash or an unpainted frame. Fixed full-screen overlays also cover only the viewport; a full-page capture exposes the underlying document below them. The E2E API's full development build can exceed its startup timeout on a busy workspace.

**How to apply:** Keep the fixture bound to the dedicated test database. For temporary screenshot runs, a recently built API bundle can be started directly under the same isolated test environment if the full development build stalls; never assume an old bundle is current after backend edits. Wait for painted content and inspect the resulting image rather than trusting a passed locator assertion or file existence. Use viewport captures for fixed live-board or modal overlays, and full-page captures for the normal document.