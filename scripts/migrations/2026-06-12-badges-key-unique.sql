DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'badges_key_unique'
      AND conrelid = 'badges'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'badges_key_key'
        AND conrelid = 'badges'::regclass
    ) THEN
      ALTER TABLE badges RENAME CONSTRAINT badges_key_key TO badges_key_unique;
    ELSE
      ALTER TABLE badges ADD CONSTRAINT badges_key_unique UNIQUE (key);
    END IF;
  END IF;
END$$;
