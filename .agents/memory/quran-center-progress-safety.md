---
name: Quran Center progress safety
description: Durable integrity rules for Quran wards, recitations, and student progress.
---

Quran circles, profiles, wards, and recitations are owned by the teacher and must always be checked against that teacher's existing roster.

**Why:** Quran records contain sensitive student performance data, and linking by student ID alone could expose or mutate another teacher's records.

**How to apply:** Derive teacher identity from the session and scope every circle, student, ward, and recitation lookup before reads or mutations.

Only a completed recitation advances the Quran profile. Progress is monotonic, so recording an older ward cannot move the current position or cumulative counts backward.

**Why:** Teachers may assess old review material after newer memorization, and review outcomes such as needs-review are not evidence of new mastery.

**How to apply:** Serialize profile advancement per student, compare canonical surah/ayah positions, and handle surah boundaries explicitly.

One ward may have only one recitation record per teacher and calendar date, with deterministic upsert behavior and an explicit marker showing whether profile progress was already applied.

**Why:** Retries, double taps, and edits to today's assessment must not double-count memorized or mastered ayahs.

**How to apply:** Keep the database uniqueness constraint and transactional progress-applied fence aligned with every recitation write path.

Quran text must come from a reviewed canonical source and must never be generated or rewritten by AI.

**Why:** A transcription or normalization error in Quran text is unacceptable.

**How to apply:** Metadata-only features may use a fixed reviewed surah catalog; adding verse text or Mushaf pages requires a versioned trusted dataset, licensing review, and golden integrity tests.