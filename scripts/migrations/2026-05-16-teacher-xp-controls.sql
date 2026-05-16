ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS teacher_xp_rewards_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE teacher_stats
  ADD COLUMN IF NOT EXISTS display_level_override INTEGER;
