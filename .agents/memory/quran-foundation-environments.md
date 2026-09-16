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

The page reader's primary Madani Mushaf is Quran Foundation Mushaf ID 1 (QCF V2): fetch words by page, group them by the provided line number, and load the matching page-specific QCF font. Existing page images are fallback only.

**Why:** connecting official verse text and audio does not replace the visual Mushaf; continuing to show the old page images caused the product to look unchanged.

**How to apply:** label the surface as Madani Mushaf QCF V2, preserve all physical line positions, and verify normal rendering contains QCF glyphs rather than the fallback image.