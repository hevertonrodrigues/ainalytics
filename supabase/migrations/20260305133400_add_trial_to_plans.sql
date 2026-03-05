-- Add trial column to plans table
-- Represents the number of free trial days (0 = no trial, max 90)
ALTER TABLE plans
  ADD COLUMN trial NUMERIC NOT NULL DEFAULT 0
  CONSTRAINT plans_trial_range CHECK (trial >= 0 AND trial <= 90);
