CREATE TABLE IF NOT EXISTS classroom_reward_goals (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  teacher_class_id INTEGER NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  target_points INTEGER NOT NULL CHECK (target_points > 0),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS classroom_reward_goals_owner_class_idx ON classroom_reward_goals(teacher_id,teacher_class_id);
CREATE INDEX IF NOT EXISTS classroom_reward_goals_owner_status_idx ON classroom_reward_goals(teacher_id,status);
CREATE TABLE IF NOT EXISTS classroom_reward_batch_reversals (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  batch_id INTEGER NOT NULL REFERENCES classroom_reward_batches(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_batch_reversals_owner_key_uq ON classroom_reward_batch_reversals(teacher_id,idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_batch_reversals_owner_batch_uq ON classroom_reward_batch_reversals(teacher_id,batch_id);