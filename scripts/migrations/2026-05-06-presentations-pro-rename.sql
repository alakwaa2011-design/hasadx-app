-- Idempotent rename: presentations V2 toggle → generic Pro tier (T413).
-- Safe to run on environments that already have the new column name
-- (uses information_schema guards so re-runs are no-ops). Must execute
-- BEFORE `drizzle-kit push` because push would otherwise see the
-- old → new rename as a drop+add and either prompt (and fail under
-- closed stdin) or silently destroy the existing per-teacher and
-- platform-wide flags.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teachers' AND column_name = 'presentations_v2_enabled'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teachers' AND column_name = 'presentations_pro_enabled'
  ) THEN
    EXECUTE 'ALTER TABLE teachers RENAME COLUMN presentations_v2_enabled TO presentations_pro_enabled';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_settings' AND column_name = 'presentations_v2_for_all'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_settings' AND column_name = 'presentations_pro_for_all'
  ) THEN
    EXECUTE 'ALTER TABLE platform_settings RENAME COLUMN presentations_v2_for_all TO presentations_pro_for_all';
  END IF;
END$$;
