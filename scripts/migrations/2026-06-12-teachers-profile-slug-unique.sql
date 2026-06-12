DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teachers_profile_slug_unique'
      AND conrelid = 'teachers'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'teachers_profile_slug_key'
        AND conrelid = 'teachers'::regclass
    ) THEN
      ALTER TABLE teachers RENAME CONSTRAINT teachers_profile_slug_key TO teachers_profile_slug_unique;
    ELSE
      ALTER TABLE teachers ADD CONSTRAINT teachers_profile_slug_unique UNIQUE (profile_slug);
    END IF;
  END IF;
END$$;
