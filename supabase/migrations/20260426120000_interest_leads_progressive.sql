-- ============================================================
-- Migration: Support progressive lead capture on interest_leads
-- The /start QuickStart landing collects website → email → contact
-- info across multiple steps, so name/email must be nullable until
-- the final step. Adds job_role column for the final form.
-- ============================================================

ALTER TABLE interest_leads
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS job_role TEXT;
