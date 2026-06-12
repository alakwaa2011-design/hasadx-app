DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'online_sessions_session_id_unique'
      AND conrelid = 'online_sessions'::regclass
  ) THEN
    ALTER TABLE online_sessions ADD CONSTRAINT online_sessions_session_id_unique UNIQUE (session_id);
  END IF;
END$$;
