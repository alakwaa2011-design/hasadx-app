DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'xp_rules_action_key_unique'
      AND conrelid = 'xp_rules'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'xp_rules_action_key_key'
        AND conrelid = 'xp_rules'::regclass
    ) THEN
      ALTER TABLE xp_rules RENAME CONSTRAINT xp_rules_action_key_key TO xp_rules_action_key_unique;
    ELSE
      ALTER TABLE xp_rules ADD CONSTRAINT xp_rules_action_key_unique UNIQUE (action_key);
    END IF;
  END IF;
END$$;
