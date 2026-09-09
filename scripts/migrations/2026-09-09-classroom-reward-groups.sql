CREATE TABLE IF NOT EXISTS classroom_reward_groups (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  teacher_class_id INTEGER NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE classroom_reward_groups ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE classroom_reward_groups ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_groups_class_name_uq
  ON classroom_reward_groups(teacher_id, teacher_class_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_groups_id_teacher_uq
  ON classroom_reward_groups(id, teacher_id);
CREATE INDEX IF NOT EXISTS classroom_reward_groups_class_idx
  ON classroom_reward_groups(teacher_id, teacher_class_id);
CREATE UNIQUE INDEX IF NOT EXISTS teacher_classes_id_teacher_reward_groups_uq
  ON teacher_classes(id, teacher_id);
CREATE UNIQUE INDEX IF NOT EXISTS students_id_teacher_reward_groups_uq
  ON students(id, teacher_id);

CREATE TABLE IF NOT EXISTS classroom_reward_group_members (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES classroom_reward_groups(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_group_members_group_student_uq
  ON classroom_reward_group_members(group_id, student_id);
CREATE INDEX IF NOT EXISTS classroom_reward_group_members_teacher_student_idx
  ON classroom_reward_group_members(teacher_id, student_id);

CREATE TABLE IF NOT EXISTS classroom_reward_group_score_receipts (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES classroom_reward_groups(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  points INTEGER NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_group_score_receipts_owner_request_uq
  ON classroom_reward_group_score_receipts(teacher_id, idempotency_key);
CREATE INDEX IF NOT EXISTS classroom_reward_group_score_receipts_group_idx
  ON classroom_reward_group_score_receipts(teacher_id, group_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classroom_reward_groups_class_owner_fk') THEN
    ALTER TABLE classroom_reward_groups
      ADD CONSTRAINT classroom_reward_groups_class_owner_fk
      FOREIGN KEY (teacher_class_id,teacher_id) REFERENCES teacher_classes(id,teacher_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classroom_reward_group_members_group_owner_fk') THEN
    ALTER TABLE classroom_reward_group_members
      ADD CONSTRAINT classroom_reward_group_members_group_owner_fk
      FOREIGN KEY (group_id,teacher_id) REFERENCES classroom_reward_groups(id,teacher_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classroom_reward_group_members_student_owner_fk') THEN
    ALTER TABLE classroom_reward_group_members
      ADD CONSTRAINT classroom_reward_group_members_student_owner_fk
      FOREIGN KEY (student_id,teacher_id) REFERENCES students(id,teacher_id) NOT VALID;
  END IF;
END $$;