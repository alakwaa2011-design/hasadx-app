-- Presentations 2B: Live MVP — sessions + responses.
-- Idempotent. Adds two new tables; touches no existing tables.

CREATE TABLE IF NOT EXISTS presentation_sessions (
  id SERIAL PRIMARY KEY,
  presentation_id INTEGER NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  pin VARCHAR(6) NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby',
  current_slide_index INTEGER NOT NULL DEFAULT 0,
  active_element_id TEXT,
  reveal_distribution BOOLEAN NOT NULL DEFAULT FALSE,
  reveal_answer BOOLEAN NOT NULL DEFAULT FALSE,
  target_class_id INTEGER REFERENCES teacher_classes(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'guest',
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS presentation_sessions_pres_idx
  ON presentation_sessions(presentation_id);
CREATE INDEX IF NOT EXISTS presentation_sessions_teacher_idx
  ON presentation_sessions(teacher_id);
-- Active-PIN uniqueness: only one non-ended session can hold a given PIN.
CREATE UNIQUE INDEX IF NOT EXISTS presentation_sessions_active_pin_unique
  ON presentation_sessions(pin) WHERE status <> 'ended';

CREATE TABLE IF NOT EXISTS presentation_responses (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES presentation_sessions(id) ON DELETE CASCADE,
  slide_index INTEGER NOT NULL,
  element_id TEXT NOT NULL,
  student_key VARCHAR(40) NOT NULL,
  student_name TEXT NOT NULL,
  answer_index INTEGER,
  answer_text TEXT,
  is_correct BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS presentation_responses_session_idx
  ON presentation_responses(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS presentation_responses_unique_answer
  ON presentation_responses(session_id, element_id, student_key);
