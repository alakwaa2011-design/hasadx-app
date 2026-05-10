-- AI Presentation Builder Phase 1A (#457) — dedicated outline-attempt
-- counter. Used to gate /presentations/ai/outline daily limits per
-- teacher independently of chat traffic. Bumped per non-cached attempt.
ALTER TABLE ai_usage_daily
  ADD COLUMN IF NOT EXISTS outline_count INTEGER NOT NULL DEFAULT 0;
