-- Add self-paced mode support to presentation sessions.
ALTER TABLE presentation_sessions
  ADD COLUMN IF NOT EXISTS session_mode TEXT NOT NULL DEFAULT 'teacher';
