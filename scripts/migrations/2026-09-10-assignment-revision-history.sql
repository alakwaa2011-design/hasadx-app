BEGIN;
CREATE TABLE IF NOT EXISTS assignment_revisions (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  source_version INTEGER NOT NULL,
  settings JSONB NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS assignment_revisions_assignment_created_idx
  ON assignment_revisions (assignment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS assignment_revisions_teacher_idx
  ON assignment_revisions (teacher_id);
COMMIT;