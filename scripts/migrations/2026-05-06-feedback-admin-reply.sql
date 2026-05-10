-- Add admin reply columns to feedback table (idempotent)
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_response text;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS responded_at timestamp;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS responded_by integer;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS response_email_status varchar(20);
