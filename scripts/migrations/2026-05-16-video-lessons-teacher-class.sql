-- Link interactive video lessons to teacher-defined classes (teacher_classes).
ALTER TABLE video_lessons
  ADD COLUMN IF NOT EXISTS teacher_class_id INTEGER REFERENCES teacher_classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS video_lessons_teacher_class_id_idx ON video_lessons(teacher_class_id);
