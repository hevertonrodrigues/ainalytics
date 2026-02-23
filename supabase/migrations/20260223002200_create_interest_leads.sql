-- ============================================================
-- Migration: Create interest_leads table (public, no tenant_id)
-- Stores leads from the "Let's Talk" custom plan form
-- ============================================================

CREATE TABLE IF NOT EXISTS interest_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  language TEXT,
  screen_resolution TEXT,
  timezone TEXT,
  page_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS enabled — no policies for authenticated users
-- All access is via service_role through the Edge Function
ALTER TABLE interest_leads ENABLE ROW LEVEL SECURITY;

-- Index on email for quick lookups
CREATE INDEX IF NOT EXISTS idx_interest_leads_email
  ON interest_leads(email);

-- Index on created_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_interest_leads_created_at
  ON interest_leads(created_at DESC);
