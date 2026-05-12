ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS arena_import_sources JSONB NOT NULL
  DEFAULT '{"manual":true,"ai":true,"homework":false,"file":false}'::jsonb;
