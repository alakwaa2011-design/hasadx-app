-- Presentations 2B: identify class students by stable ID instead of by name.
-- Adds presentation_responses.class_student_id (nullable, references the roster
-- row the joiner picked) so the results endpoint can classify class vs guest
-- by ID. Existing rows remain NULL and fall back to name matching server-side.
-- Idempotent.

ALTER TABLE presentation_responses
  ADD COLUMN IF NOT EXISTS class_student_id INTEGER
  REFERENCES students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS presentation_responses_class_student_idx
  ON presentation_responses(class_student_id);
