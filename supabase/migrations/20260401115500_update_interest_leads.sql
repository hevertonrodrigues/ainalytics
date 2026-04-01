-- ============================================================
-- Migration: Add website and opt_in columns to interest_leads
-- Supports Ebook Landing Page lead capture
-- ============================================================

ALTER TABLE interest_leads 
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS opt_in BOOLEAN DEFAULT false;
