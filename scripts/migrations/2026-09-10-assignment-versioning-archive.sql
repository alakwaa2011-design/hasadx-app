BEGIN;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS version INTEGER,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

UPDATE assignments
SET updated_at = COALESCE(updated_at, created_at, NOW()),
    version = COALESCE(version, 1)
WHERE updated_at IS NULL OR version IS NULL;

ALTER TABLE assignments
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN version SET DEFAULT 1,
  ALTER COLUMN version SET NOT NULL;

CREATE INDEX IF NOT EXISTS assignments_teacher_archive_created_idx
  ON assignments (teacher_id, archived_at, created_at DESC);

COMMIT;