CREATE TABLE IF NOT EXISTS quran_guided_memorization (
  id SERIAL PRIMARY KEY,
  student_account_id INTEGER NOT NULL REFERENCES student_accounts(id) ON DELETE CASCADE,
  surah_number INTEGER NOT NULL,
  ayah_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'learning' CHECK (status IN ('needs_review','learning','memorized')),
  interval_days INTEGER NOT NULL DEFAULT 2 CHECK (interval_days > 0 AND interval_days <= 90),
  next_review_date DATE NOT NULL,
  last_assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quran_guided_memorization_account_ayah_uq UNIQUE (student_account_id, surah_number, ayah_number)
);
CREATE INDEX IF NOT EXISTS quran_guided_memorization_due_idx
  ON quran_guided_memorization(student_account_id, next_review_date);
CREATE TABLE IF NOT EXISTS quran_guided_memorization_assessment_receipts (
  id SERIAL PRIMARY KEY,
  student_account_id INTEGER NOT NULL REFERENCES student_accounts(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  memorization_item_id INTEGER NOT NULL REFERENCES quran_guided_memorization(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quran_guided_memorization_receipts_owner_request_uq UNIQUE (student_account_id, request_id)
);
CREATE INDEX IF NOT EXISTS quran_guided_memorization_receipts_item_idx
  ON quran_guided_memorization_assessment_receipts(memorization_item_id);
CREATE TABLE IF NOT EXISTS quran_guided_memorization_assessment_history (
  id SERIAL PRIMARY KEY,
  student_account_id INTEGER NOT NULL REFERENCES student_accounts(id) ON DELETE CASCADE,
  memorization_item_id INTEGER NOT NULL REFERENCES quran_guided_memorization(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  status TEXT NOT NULL,
  interval_days INTEGER NOT NULL,
  next_review_date DATE NOT NULL,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quran_guided_memorization_history_owner_request_uq UNIQUE (student_account_id, request_id)
);
CREATE INDEX IF NOT EXISTS quran_guided_memorization_history_item_idx
  ON quran_guided_memorization_assessment_history(memorization_item_id, assessed_at);
CREATE INDEX IF NOT EXISTS quran_guided_memorization_history_owner_date_idx
  ON quran_guided_memorization_assessment_history(student_account_id, assessed_at);

INSERT INTO quran_guided_memorization_assessment_history (
  student_account_id, memorization_item_id, request_id, passed, status,
  interval_days, next_review_date, assessed_at
)
SELECT
  g.student_account_id,
  g.id,
  'backfill:' || g.id::text,
  g.status <> 'needs_review',
  g.status,
  g.interval_days,
  g.next_review_date,
  COALESCE(g.last_assessed_at, g.updated_at, g.created_at)
FROM quran_guided_memorization g
WHERE NOT EXISTS (
  SELECT 1
  FROM quran_guided_memorization_assessment_history h
  WHERE h.memorization_item_id = g.id
)
ON CONFLICT (student_account_id, request_id) DO NOTHING;