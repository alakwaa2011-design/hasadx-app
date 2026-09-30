---
name: Expo Quran audio redirect
description: Why the web preview cannot play the public Quran word-audio redirect under the default security policy.
---

Expo's web preview and the project's API can have different origins, even when both are served in the same development workspace. For public Quran word **and verse** audio, the API responds with a redirect to the official recording host. A permissive CORS response is not enough if the redirect itself carries a `Cross-Origin-Resource-Policy: same-origin` header: Chromium blocks the media request before following it.

**Why:** In the Expo preview, the word-audio endpoint returned a valid 302 and the official MP3 returned 200, but the browser reported `net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` and the player surfaced “no supported source.” Later, verse recitation failed for the same reason, even though the playback dock appeared. The site reader worked because its audio request originated on the API's own domain.

**How to apply:** Permit cross-origin resource use on the **specific public, validated, allowlisted audio redirects**, not across the API. Verify both the redirect headers and media playback from the Expo preview origin. Keep session-gated recordings and private/user-uploaded routes under the stricter policy.