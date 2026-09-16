---
name: Quran Foundation environments
description: Environment pairing and catalog completeness constraints for the Quran Foundation Content API.
---

Quran Foundation prelive credentials and hosts are suitable only for connectivity checks and expose a two-surah sample catalog. The complete 114-surah catalog requires production credentials with both production OAuth and Content API hosts.

**Why:** a valid prelive token can make the integration appear healthy while silently returning an incomplete Quran catalog.

**How to apply:** never mix credentials or hosts between environments. Validate that production chapter data contains exactly 114 ordered chapters, and retain the bundled canonical catalog as the outage/incomplete-response fallback.