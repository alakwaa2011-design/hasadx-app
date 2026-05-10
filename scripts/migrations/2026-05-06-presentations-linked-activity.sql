-- Phase 2A — link a presentation to an existing teacher activity.
-- Adds the two columns referenced by `lib/db/src/schema/presentations.ts`
-- (`linkedActivityId` / `linkedActivityKind`) and the matching server
-- routes (`PATCH /api/presentations/:id/link-activity`,
-- `GET /api/presentations/:id/linked-activity`). Both columns are
-- nullable text so a deck without a link keeps NULLs; storing the id
-- as text mirrors the schema column type and lets us encode either an
-- assignment id or a future kind-specific identifier without altering
-- the column type. Idempotent — safe to re-run on environments where
-- the columns already exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'presentations' AND column_name = 'linked_activity_id'
  ) THEN
    EXECUTE 'ALTER TABLE presentations ADD COLUMN linked_activity_id text';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'presentations' AND column_name = 'linked_activity_kind'
  ) THEN
    EXECUTE 'ALTER TABLE presentations ADD COLUMN linked_activity_kind text';
  END IF;
END
$$;
