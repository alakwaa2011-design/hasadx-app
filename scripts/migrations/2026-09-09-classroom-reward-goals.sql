CREATE TABLE IF NOT EXISTS classroom_reward_goals (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  teacher_class_id INTEGER NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  skill TEXT NOT NULL DEFAULT 'هدف أكاديمي',
  target_points INTEGER NOT NULL CHECK (target_points > 0),
  reward_type_id INTEGER REFERENCES classroom_reward_types(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE classroom_reward_goals ADD COLUMN IF NOT EXISTS skill TEXT;
ALTER TABLE classroom_reward_goals ADD COLUMN IF NOT EXISTS reward_type_id INTEGER REFERENCES classroom_reward_types(id) ON DELETE SET NULL;
ALTER TABLE classroom_reward_goals ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE classroom_reward_goals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
UPDATE classroom_reward_goals
SET skill=COALESCE(NULLIF(skill,''),title), is_active=(status='active')
WHERE skill IS NULL OR skill='' OR is_active<>(status='active');
ALTER TABLE classroom_reward_goals ALTER COLUMN skill SET DEFAULT 'هدف أكاديمي';
ALTER TABLE classroom_reward_goals ALTER COLUMN skill SET NOT NULL;

CREATE INDEX IF NOT EXISTS classroom_reward_goals_class_idx
  ON classroom_reward_goals(teacher_id,teacher_class_id,is_active);
CREATE INDEX IF NOT EXISTS classroom_reward_goals_student_idx
  ON classroom_reward_goals(teacher_id,student_id,is_active);
CREATE INDEX IF NOT EXISTS classroom_reward_goals_owner_status_idx
  ON classroom_reward_goals(teacher_id,status);