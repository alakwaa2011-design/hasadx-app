-- Remove redundant composite ownership constraints created in development.
-- The canonical relationships already use each parent table's primary key:
--   classroom_reward_groups.teacher_class_id -> teacher_classes.id
--   classroom_reward_group_members.group_id  -> classroom_reward_groups.id
--   classroom_reward_group_members.student_id -> students.id
-- Teacher ownership remains a separate column and is validated by API queries.
-- No rows or tables are modified by this corrective migration.

ALTER TABLE IF EXISTS classroom_reward_group_members
  DROP CONSTRAINT IF EXISTS classroom_reward_group_members_group_owner_fk,
  DROP CONSTRAINT IF EXISTS classroom_reward_group_members_student_owner_fk;

ALTER TABLE IF EXISTS classroom_reward_groups
  DROP CONSTRAINT IF EXISTS classroom_reward_groups_class_owner_fk;

DROP INDEX IF EXISTS classroom_reward_groups_id_teacher_uq;
DROP INDEX IF EXISTS teacher_classes_id_teacher_reward_groups_uq;
DROP INDEX IF EXISTS students_id_teacher_reward_groups_uq;