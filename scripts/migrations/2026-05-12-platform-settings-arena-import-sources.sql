ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS arena_import_sources JSONB NOT NULL
  DEFAULT '{"manual":true,"ai":true,"homework":true,"file":true}'::jsonb;

UPDATE platform_settings
  SET arena_import_sources = arena_import_sources
    || '{"homework":true,"file":true}'::jsonb
  WHERE (arena_import_sources->>'homework')::boolean IS DISTINCT FROM TRUE
     OR (arena_import_sources->>'file')::boolean IS DISTINCT FROM TRUE;
