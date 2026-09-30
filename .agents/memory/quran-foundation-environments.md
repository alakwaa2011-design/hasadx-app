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

Word-level meaning must use the documented `words[].translation` contract; Quran Foundation currently identifies that field as English. Arabic tafsir is a separate resource and must not be scraped as if its HTML spans were word definitions.

**Why:** tafsir markup is presentation content, not a stable word-gloss schema; inferring definitions from nearby spans can silently attach the wrong explanation to a selected word.

**How to apply:** attribute the word translation and tafsir separately with their real language/resource metadata, return no word meaning when the documented translation is absent, and never synthesize or extract a gloss from tafsir HTML.

Word timing comes from chapter-recitation timestamps, not the ayah-by-ayah audio response. The chapter-reciter catalog currently returns its array under `reciters`, may represent style as `{name}`, and uses a distinct ID namespace.

**Why:** assuming an `chapter_reciters` envelope or interchangeable IDs passed mocked tests but failed against the live API. Exact synchronization also requires playing the chapter recording that produced the timestamps.

**How to apply:** verify reciter identity before mapping catalogs, request `chapter_recitations/{chapterReciterId}/{chapter}?segments=true`, normalize each verse window, and allowlist the returned chapter-audio origin (currently `download.quranicaudio.com`).

The ayah-recitation and chapter-reciter catalogs use different ID namespaces and partially different reader sets. Chapter-only readers need stable public IDs derived from their source IDs; verify those by exact catalog membership, not cross-language display-name equality.

**Why:** Arabic localization made valid Maher al-Muaiqly metadata fail an English-name identity comparison. Also, chapter audio cannot safely replace per-ayah fallback audio because it would start at the beginning of the surah when timing is unavailable.

**How to apply:** keep strict identity checks for legacy native mappings, use synchronized chapter audio for chapter-only readers, and reject their unsynchronized fallback rather than playing the wrong ayah.

Chapter-recitation segment arrays are not uniformly one clean triplet per word. Teaching recordings may include marker arrays, malformed triplets, repeated word-position cycles, or exact ayah bounds with no word segments.

**Why:** Minshawi Kids Repeat contains teacher and child passes with repeated positions; rejecting duplicates broke valid playback. Some ayahs have usable bounds but no word-level data.

**How to apply:** keep valid triplets in chronological order, discard invalid entries, allow repeated positions and empty segment lists, and always use official ayah start/end bounds for playback.

Reader-picker labels must reflect explicit provider metadata rather than inferred recording behavior. In particular, `Muallim` does not establish that children repeat after the reciter; only an explicit `Kids repeat` recording should be presented as child-repeat teaching audio.

**Why:** the live Husary `Muallim` recording does not contain the child-response behavior users expect from the Arabic “المعلّم” label, while the Minshawi `Kids repeat` recording does.

**How to apply:** hide unstyled duplicate catalog records, exclude `Muallim` from the child-repeat category, preserve explicit Murattal/Mujawwad choices, and label `Kids repeat` as child repetition.

For a user-initiated tap on one Quran word, prefer Quran Foundation's dedicated `words[].audio_url` WBW file over slicing chapter-recitation timestamps.

**Why:** chapter timing segments are incomplete or multi-pass for some recordings, while the dedicated WBW asset identifies one exact word and can begin through a same-origin redirect within the original tap gesture.

**How to apply:** select the requested `words[]` record by its position, then validate that its audio path remains under `wbw/` and matches the requested surah/ayah. Do not require the filename suffix to equal the word position: pause markers can create gaps. Redirect only to the allowlisted Quran CDN, and play it in a secondary audio element that never mutates ayah-player state.

Offline storage of Quran Foundation API content follows its current Developer Terms: ordinarily no more than one week, except content the Content Sync API explicitly supports when changes are applied at least every seven days. Font files and Mushaf images may be bundled as integrated app assets with an active developer account and QF credit, but the sync snapshots do not include those binaries. Audio resource metadata being syncable is not proof that every underlying reciter recording is licensed for permanent third-party downloading.

**Why:** The developer terms distinguish in-app display from separately distributed content packages, impose a cache lifetime, and still require source-specific permissions. A streaming URL or a public download button on another site does not by itself authorize our app's permanent offline audio library.

**How to apply:** Before adding offline tafsir, interactive page metadata, or reciter audio, verify the exact resource is sync-eligible, implement token-based sync and changes within seven days, confirm each recording's own usage rights, and avoid offering QF data as a standalone downloadable product.