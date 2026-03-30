-- ============================================================
-- Migration: Add subscription plan limit columns
-- ============================================================

-- 1. Add limit columns to subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_prompts INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_models INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS refresh_frequency TEXT
  CHECK (refresh_frequency IN ('daily', 'weekly', 'monthly'));

-- 2. Add max_models to plans.settings JSONB
UPDATE plans SET settings = jsonb_set(settings, '{max_models}', '1')
  WHERE name = 'Starter';
UPDATE plans SET settings = jsonb_set(settings, '{max_models}', '2')
  WHERE name = 'Growth';
UPDATE plans SET settings = jsonb_set(settings, '{max_models}', '4')
  WHERE name = 'Business';
-- Custom plan: NULL = unlimited, no max_models key needed

-- 3. Backfill existing active/trialing subscriptions from their plan
UPDATE subscriptions s
SET
  max_prompts = (p.settings->>'max_prompts')::INTEGER,
  max_models = (p.settings->>'max_models')::INTEGER,
  refresh_frequency = p.settings->>'refresh_rate'
FROM plans p
WHERE s.plan_id = p.id
  AND s.status IN ('active', 'trialing');

-- 4. Helper RPC: get tenant subscription limits + current usage
CREATE OR REPLACE FUNCTION public.get_tenant_subscription_limits(p_tenant_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  max_prompts INTEGER,
  max_models INTEGER,
  refresh_frequency TEXT,
  current_prompt_count BIGINT,
  current_model_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    s.id AS subscription_id,
    s.max_prompts,
    s.max_models,
    s.refresh_frequency,
    (SELECT COUNT(*) FROM prompts pr WHERE pr.tenant_id = p_tenant_id AND pr.is_active = true) AS current_prompt_count,
    (SELECT COUNT(*) FROM tenant_platform_models tpm WHERE tpm.tenant_id = p_tenant_id AND tpm.is_active = true) AS current_model_count
  FROM subscriptions s
  WHERE s.tenant_id = p_tenant_id
    AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;
