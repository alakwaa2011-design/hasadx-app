-- Persisted inline hasad-game quiz runs for live presentation sessions.
-- One row per (run, student); a "run" is identified by the
-- (session_id, element_id, finished_at) tuple. Inserted when the
-- teacher reaches the end of an inline quiz so leaderboards survive
-- restarts and can be reviewed later. Idempotent.

CREATE TABLE IF NOT EXISTS presentation_inline_quiz_runs (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES presentation_sessions(id) ON DELETE CASCADE,
  element_id TEXT NOT NULL,
  total_questions INTEGER NOT NULL,
  student_key VARCHAR(40) NOT NULL,
  student_name TEXT NOT NULL,
  class_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  correct INTEGER NOT NULL,
  answered INTEGER NOT NULL,
  finished_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS presentation_inline_quiz_runs_session_idx
  ON presentation_inline_quiz_runs(session_id);

CREATE INDEX IF NOT EXISTS presentation_inline_quiz_runs_run_idx
  ON presentation_inline_quiz_runs(session_id, element_id, finished_at);
