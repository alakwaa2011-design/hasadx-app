CREATE TABLE IF NOT EXISTS quran_independent_positions (
  id SERIAL PRIMARY KEY,
  student_account_id INTEGER NOT NULL REFERENCES student_accounts(id) ON DELETE CASCADE,
  text_surah_number INTEGER,
  text_ayah INTEGER,
  page_number INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP INDEX IF EXISTS quran_independent_positions_student_idx;
ALTER TABLE quran_independent_positions DROP COLUMN IF EXISTS student_id;
CREATE UNIQUE INDEX IF NOT EXISTS quran_independent_positions_account_uq
  ON quran_independent_positions(student_account_id);

CREATE TABLE IF NOT EXISTS quran_independent_sessions (
  id SERIAL PRIMARY KEY,
  student_account_id INTEGER NOT NULL REFERENCES student_accounts(id) ON DELETE CASCADE,
  practiced_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP INDEX IF EXISTS quran_independent_sessions_student_date_idx;
ALTER TABLE quran_independent_sessions DROP COLUMN IF EXISTS student_id;
CREATE UNIQUE INDEX IF NOT EXISTS quran_independent_sessions_account_date_uq
  ON quran_independent_sessions(student_account_id, practiced_date);