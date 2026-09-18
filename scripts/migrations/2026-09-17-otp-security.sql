-- Phase-one OTP security fields. OTP values are stored as keyed hashes by the
-- application; these fields support bounded verification attempts.
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS otp_locked_until TIMESTAMP;