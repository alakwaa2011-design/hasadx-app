---
name: Quran Foundation environments
description: Environment pairing, payload integrity, and redirect constraints for Quran Foundation content and audio.
---

Quran Foundation prelive credentials and hosts are suitable only for connectivity checks and expose a two-surah sample catalog. The complete 114-surah catalog requires production credentials with both production OAuth and Content API hosts.

**Why:** a valid prelive token can make the integration appear healthy while silently returning an incomplete Quran catalog.

**How to apply:** never mix credentials or hosts between environments. Validate that production chapter data contains exactly 114 ordered chapters, and retain the bundled canonical catalog as the outage/incomplete-response fallback.

Authenticated OAuth and content requests must not follow redirects. Audio responses must match the requested verse key, and resolved audio URLs must use the exact trusted origin rather than only a matching hostname.

**Why:** Quran content requires stronger integrity checks than ordinary catalog data, and redirects on authenticated requests can move credentials or content trust outside the expected service boundary.

**How to apply:** compare every chapter's verse count with canonical counts, reject incomplete or mismatched verse sequences, validate the requested audio verse key, and preserve trusted bundled text/audio/page assets as automatic fallbacks.