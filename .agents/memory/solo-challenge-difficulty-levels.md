---
name: Solo challenge difficulty and multi-level
description: How difficulty tagging, distribution-based picking, and multi-level mode work in وميض فردي حر
---

## Difficulty tagging
- `questions.difficulty` is integer: **1=easy, 2=medium, 3=hard**, null=untagged.
- Teachers tag each question via a 4-button row (—/سهل/متوسط/صعب) in `QuestionCard` edit mode.
- Colored badges show in view mode.

## Difficulty distribution on challenges
- `solo_challenges.difficulty_distribution` is JSONB column: `{ easy: N, medium: N, hard: N }`.
- Old `difficulty` TEXT + `difficultyAffectsPoints` BOOL columns remain in DB but are no longer written/read.
- When distribution is active, `questionsPerParticipant` is ignored; `distTotal` (sum of 3 buckets) becomes the per-player count.
- Server picks from buckets at `/start`; untagged questions fill bucket deficits (easy→medium→hard order draws from shared pool).

## Time counter widget
- Replaced the slider with +/− stepper (step 5s, min 5s, max 120s, default 20s).
- Quick-select pills: 5/10/15/20/30/45/60ث.
- Located in `SettingsPanel` inside both `solo-challenge-create.tsx` and `solo-challenge-manage.tsx`.

## Multi-level mode
- Uses `preserveOrder` in `createGame` and level-transition overlay in `play.tsx`.
- `pts: 100` for all questions (no difficulty-based points scaling).
- Time stepper and distribution section are both hidden when multi-level is active.

**Why:** difficulty = time preset was confusing; per-question tagging + bucket picking gives teachers real control over content quality.

**How to apply:** any change touching the distribution flow should check the `/start` handler in `solo-challenges.ts` (bucket picking logic) and both Settings panels (create + manage).
