-- Teacher-owned roster avatars are independent of linked student accounts.
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar TEXT;