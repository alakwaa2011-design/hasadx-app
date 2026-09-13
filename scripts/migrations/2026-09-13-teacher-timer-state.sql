CREATE TABLE IF NOT EXISTS teacher_timer_states (
  teacher_id INTEGER PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'cancelled',
  run_id UUID,
  end_at TIMESTAMPTZ,
  remaining_ms INTEGER NOT NULL DEFAULT 0,
  task_name TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 0,
  client_handled_at TIMESTAMPTZ,
  notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_timer_states_status_ck
    CHECK (status IN ('running', 'paused', 'cancelled', 'completed'))
);

CREATE INDEX IF NOT EXISTS teacher_timer_states_due_idx
  ON teacher_timer_states(end_at)
  WHERE status = 'running' AND notification_id IS NULL;

ALTER TABLE teacher_timer_states ADD COLUMN IF NOT EXISTS run_id UUID;

CREATE TABLE IF NOT EXISTS teacher_timer_notifications (
  run_id UUID PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  notification_id INTEGER NOT NULL UNIQUE REFERENCES notifications(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);