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

The Arabic Quran Center must never expose raw English enum values. A student's daily task is presented as one focused card containing memorization and review sections.

**Why:** Teachers need an immediately understandable Quran workflow without technical labels or separate cards that make one daily task look fragmented.

**How to apply:** Map every mode and status at the display boundary, format dates with the Arabic locale, and keep memorization and review together in assignment creation and profile views.

Names extracted from a roster image require teacher review before students are created.

**Why:** Vision extraction can misread a student's name, and silently creating the wrong roster entry would contaminate attendance and Quran history.

**How to apply:** Return extracted image names as a preview, place them in an editable bulk-name list, and create students only after the teacher confirms.

Circle-wide Quran assignments use one server transaction and a stable request identity across retries.

**Why:** A network retry must not create duplicate memorization and review wards, and a failed member insert must not leave only part of the circle assigned.

**How to apply:** Submit both ranges in one circle-level request, enforce request identity at the database boundary, and create all member wards inside one transaction.

Quran memorization and review assignments are lists of canonical ranges, not one range per mode; a range may represent an entire surah.

**Why:** Real circle plans often span several surahs or mix complete surahs with partial ranges.

**How to apply:** Let teachers add and remove segments, derive full-surah bounds from the trusted surah catalog, and preserve every segment through assignment and daily recitation.