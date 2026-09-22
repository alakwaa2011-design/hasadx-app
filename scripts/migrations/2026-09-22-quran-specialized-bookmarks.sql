ALTER TABLE quran_bookmarks
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'stopped_here';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quran_bookmarks_category_valid'
  ) THEN
    ALTER TABLE quran_bookmarks
      ADD CONSTRAINT quran_bookmarks_category_valid
      CHECK (category IN (
        'stopped_here',
        'review',
        'similar',
        'repeated_mistake',
        'ask_teacher'
      ));
  END IF;
END
$$;