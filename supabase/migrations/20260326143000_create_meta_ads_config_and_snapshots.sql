-- ============================================================
-- Meta Ads Integration — Admin-only tables for tracking
-- paid media costs from Meta (Facebook/Instagram) Ads API
-- ============================================================

-- ============================================================
-- Table: meta_ads_config
-- Stores Meta API credentials and settings (admin-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ads_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  api_version TEXT NOT NULL DEFAULT 'v21.0',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'error', 'pending')),
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active config at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_ads_config_active
  ON meta_ads_config(is_active) WHERE is_active = true;

-- Enable RLS (admin-only via service_role)
ALTER TABLE meta_ads_config ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated — only service_role (edge functions) can access

-- Updated_at trigger
CREATE TRIGGER set_meta_ads_config_updated_at
  BEFORE UPDATE ON meta_ads_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Table: meta_ads_snapshots
-- Daily cached snapshots of Meta Ads performance data
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ads_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id TEXT NOT NULL,
  date DATE NOT NULL,
  level TEXT NOT NULL DEFAULT 'account'
    CHECK (level IN ('account', 'campaign', 'adset')),
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  cpc NUMERIC,
  cpm NUMERIC,
  ctr NUMERIC,
  conversions INTEGER NOT NULL DEFAULT 0,
  cost_per_conversion NUMERIC,
  actions_json JSONB DEFAULT '[]'::jsonb,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one snapshot per account/date/level/campaign/adset
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_ads_snapshots_unique
  ON meta_ads_snapshots(ad_account_id, date, level, COALESCE(campaign_id, ''), COALESCE(adset_id, ''));

-- Date-based queries are the primary access pattern
CREATE INDEX IF NOT EXISTS idx_meta_ads_snapshots_date
  ON meta_ads_snapshots(date DESC);

CREATE INDEX IF NOT EXISTS idx_meta_ads_snapshots_account_date
  ON meta_ads_snapshots(ad_account_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_meta_ads_snapshots_level
  ON meta_ads_snapshots(level, date DESC);

-- Enable RLS (admin-only via service_role)
ALTER TABLE meta_ads_snapshots ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated — only service_role (edge functions) can access

-- ============================================================
-- RPC: get_meta_ads_overview
-- Aggregated KPIs for a given date range
-- ============================================================
CREATE OR REPLACE FUNCTION get_meta_ads_overview(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_spend', COALESCE(SUM(spend), 0),
    'total_impressions', COALESCE(SUM(impressions), 0),
    'total_clicks', COALESCE(SUM(clicks), 0),
    'avg_cpc', CASE WHEN SUM(clicks) > 0 THEN ROUND(SUM(spend) / SUM(clicks), 4) ELSE 0 END,
    'avg_cpm', CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(spend) / SUM(impressions) * 1000, 4) ELSE 0 END,
    'avg_ctr', CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(clicks)::NUMERIC / SUM(impressions) * 100, 4) ELSE 0 END,
    'total_conversions', COALESCE(SUM(conversions), 0),
    'avg_cost_per_conversion', CASE WHEN SUM(conversions) > 0 THEN ROUND(SUM(spend) / SUM(conversions), 2) ELSE 0 END,
    'currency', COALESCE(MAX(currency), 'USD'),
    'days_count', COUNT(DISTINCT date)
  ) INTO result
  FROM meta_ads_snapshots
  WHERE level = 'account'
    AND date >= p_start_date
    AND date <= p_end_date;

  RETURN result;
END;
$$;

-- ============================================================
-- RPC: get_meta_ads_daily
-- Daily spend breakdown for charting
-- ============================================================
CREATE OR REPLACE FUNCTION get_meta_ads_daily(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY day)
  INTO result
  FROM (
    SELECT
      date AS day,
      COALESCE(SUM(spend), 0) AS spend,
      COALESCE(SUM(impressions), 0) AS impressions,
      COALESCE(SUM(clicks), 0) AS clicks,
      COALESCE(SUM(conversions), 0) AS conversions
    FROM meta_ads_snapshots
    WHERE level = 'account'
      AND date >= p_start_date
      AND date <= p_end_date
    GROUP BY date
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================================
-- RPC: get_meta_ads_campaigns
-- Campaign-level breakdown
-- ============================================================
CREATE OR REPLACE FUNCTION get_meta_ads_campaigns(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY total_spend DESC)
  INTO result
  FROM (
    SELECT
      campaign_id,
      campaign_name,
      COALESCE(SUM(spend), 0) AS total_spend,
      COALESCE(SUM(impressions), 0) AS total_impressions,
      COALESCE(SUM(clicks), 0) AS total_clicks,
      CASE WHEN SUM(clicks) > 0 THEN ROUND(SUM(spend) / SUM(clicks), 4) ELSE 0 END AS avg_cpc,
      CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(clicks)::NUMERIC / SUM(impressions) * 100, 4) ELSE 0 END AS avg_ctr,
      COALESCE(SUM(conversions), 0) AS total_conversions,
      CASE WHEN SUM(conversions) > 0 THEN ROUND(SUM(spend) / SUM(conversions), 2) ELSE 0 END AS cost_per_conversion
    FROM meta_ads_snapshots
    WHERE level = 'campaign'
      AND date >= p_start_date
      AND date <= p_end_date
    GROUP BY campaign_id, campaign_name
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================================
-- RPC: get_meta_ads_roi
-- Cross-reference ad spend with subscription revenue
-- ============================================================
CREATE OR REPLACE FUNCTION get_meta_ads_roi(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  v_total_spend NUMERIC;
  v_new_subscriptions INTEGER;
  v_new_revenue NUMERIC;
  v_total_active_mrr NUMERIC;
BEGIN
  -- Total ad spend in period
  SELECT COALESCE(SUM(spend), 0) INTO v_total_spend
  FROM meta_ads_snapshots
  WHERE level = 'account'
    AND date >= p_start_date
    AND date <= p_end_date;

  -- New paying subscriptions created in period
  SELECT
    COUNT(*),
    COALESCE(SUM(
      CASE
        WHEN billing_interval = 'monthly' THEN paid_amount
        WHEN billing_interval = 'yearly' THEN paid_amount / 12
        ELSE 0
      END
    ), 0)
  INTO v_new_subscriptions, v_new_revenue
  FROM subscriptions
  WHERE status IN ('active', 'trialing')
    AND created_at >= p_start_date::TIMESTAMPTZ
    AND created_at < (p_end_date + 1)::TIMESTAMPTZ;

  -- Total active MRR (for LTV calculation)
  SELECT COALESCE(SUM(
    CASE
      WHEN billing_interval = 'monthly' THEN paid_amount
      WHEN billing_interval = 'yearly' THEN paid_amount / 12
      ELSE 0
    END
  ), 0) INTO v_total_active_mrr
  FROM subscriptions
  WHERE status IN ('active', 'trialing');

  SELECT json_build_object(
    'total_ad_spend', v_total_spend,
    'new_subscriptions', v_new_subscriptions,
    'new_mrr', v_new_revenue,
    'cac', CASE WHEN v_new_subscriptions > 0 THEN ROUND(v_total_spend / v_new_subscriptions, 2) ELSE 0 END,
    'roas', CASE WHEN v_total_spend > 0 THEN ROUND(v_new_revenue / v_total_spend, 4) ELSE 0 END,
    'roi_pct', CASE WHEN v_total_spend > 0 THEN ROUND((v_new_revenue - v_total_spend) / v_total_spend * 100, 2) ELSE 0 END,
    'total_active_mrr', v_total_active_mrr,
    'active_sub_count', (SELECT COUNT(*) FROM subscriptions WHERE status IN ('active', 'trialing')),
    'avg_revenue_per_sub', CASE
      WHEN (SELECT COUNT(*) FROM subscriptions WHERE status IN ('active', 'trialing')) > 0
      THEN ROUND(v_total_active_mrr / (SELECT COUNT(*) FROM subscriptions WHERE status IN ('active', 'trialing')), 2)
      ELSE 0
    END,
    'ltv_estimate', CASE
      WHEN (SELECT COUNT(*) FROM subscriptions WHERE status IN ('active', 'trialing')) > 0
      THEN ROUND(v_total_active_mrr / (SELECT COUNT(*) FROM subscriptions WHERE status IN ('active', 'trialing')) * 12, 2)
      ELSE 0
    END,
    'ltv_cac_ratio', CASE
      WHEN v_new_subscriptions > 0 AND v_total_spend > 0
      THEN ROUND(
        (v_total_active_mrr / NULLIF((SELECT COUNT(*) FROM subscriptions WHERE status IN ('active', 'trialing')), 0) * 12)
        / (v_total_spend / v_new_subscriptions),
        2
      )
      ELSE 0
    END,
    'payback_months', CASE
      WHEN v_new_subscriptions > 0 AND v_new_revenue > 0
      THEN ROUND(
        (v_total_spend / v_new_subscriptions) / (v_new_revenue / v_new_subscriptions),
        1
      )
      ELSE 0
    END
  ) INTO result;

  RETURN result;
END;
$$;
