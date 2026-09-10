ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS extra_attempts INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assignments_extra_attempts_range'
  ) THEN
    ALTER TABLE assignments
      ADD CONSTRAINT assignments_extra_attempts_range CHECK (extra_attempts BETWEEN 0 AND 1);
  END IF;
END $$;