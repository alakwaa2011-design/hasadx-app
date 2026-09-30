---
name: Native Quran sync storage
description: Why Quran Foundation Content Sync data must use native documents rather than settings storage
---

Quran Foundation's Mushaf Content Sync snapshot is roughly 23 MB before local processing, and the Muyassar tafsir adds roughly 4.5 MB. Android AsyncStorage's usual database size limit is much smaller than the combined content, even if each individual value is split.

**Why:** The first implementation stored per-page JSON in settings storage, which would fail on Android despite passing TypeScript and web checks. Expo document files hold the content; a small manifest in AsyncStorage is the atomic generation/token commit. Incomplete generations must never be used after an interrupted download.

**How to apply:** When adding large Quran Content Sync resources, store their records in document files, write a new generation before switching the manifest, and only then retire the old generation. Do not equate a web preview or a passing typecheck with a native storage test.