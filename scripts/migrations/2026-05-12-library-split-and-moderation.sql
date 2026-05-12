-- Task #595: split shared content into Activities + Competitions libraries
-- and add admin moderation columns. Idempotent.

-- 1) Default-on sharing for new rows. Existing rows are NOT touched —
-- backfilling legacy content is handled by a separate seed script.
ALTER TABLE assignments     ALTER COLUMN is_shared          SET DEFAULT TRUE;
ALTER TABLE assignments     ALTER COLUMN is_share_approved  SET DEFAULT TRUE;
ALTER TABLE question_bank   ALTER COLUMN is_shared          SET DEFAULT TRUE;
ALTER TABLE video_lessons   ALTER COLUMN is_shared          SET DEFAULT TRUE;

-- 2) New contentKind discriminator on assignments.
--    'homework' → مكتبة الأنشطة, 'competition' → مكتبة المسابقات الجاهزة.
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS content_kind TEXT NOT NULL DEFAULT 'homework';
CREATE INDEX IF NOT EXISTS idx_assignments_content_kind
  ON assignments (content_kind);

-- 3) Admin moderation columns. hiddenByAdmin defaults to FALSE so the
--    hot read path (eq(hiddenByAdmin, false)) keeps matching every row
--    that hasn't been moderated.
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS hidden_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS hidden_by_id    INTEGER REFERENCES teachers(id),
  ADD COLUMN IF NOT EXISTS hide_reason     TEXT;

ALTER TABLE question_bank
  ADD COLUMN IF NOT EXISTS hidden_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS hidden_by_id    INTEGER REFERENCES teachers(id),
  ADD COLUMN IF NOT EXISTS hide_reason     TEXT;

ALTER TABLE video_lessons
  ADD COLUMN IF NOT EXISTS hidden_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS hidden_by_id    INTEGER REFERENCES teachers(id),
  ADD COLUMN IF NOT EXISTS hide_reason     TEXT;

-- 4) Partial indexes for the new "shared, not hidden" hot path.
CREATE INDEX IF NOT EXISTS idx_assignments_shared_visible
  ON assignments (created_at DESC)
  WHERE is_shared = TRUE AND hidden_by_admin = FALSE;
CREATE INDEX IF NOT EXISTS idx_question_bank_shared_visible
  ON question_bank (created_at DESC)
  WHERE is_shared = TRUE AND hidden_by_admin = FALSE;
CREATE INDEX IF NOT EXISTS idx_video_lessons_shared_visible
  ON video_lessons (created_at DESC)
  WHERE is_shared = TRUE AND hidden_by_admin = FALSE;
