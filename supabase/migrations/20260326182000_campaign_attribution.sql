-- ============================================================
-- Migration: Meta Ads Phase 2 - Campaign Enrichment & Attribution
-- ============================================================

-- 1. Add richer campaign metadata to meta_ads_snapshots
ALTER TABLE meta_ads_snapshots
  ADD COLUMN IF NOT EXISTS campaign_objective TEXT,
  ADD COLUMN IF NOT EXISTS campaign_status TEXT,
  ADD COLUMN IF NOT EXISTS campaign_daily_budget NUMERIC,
  ADD COLUMN IF NOT EXISTS campaign_lifetime_budget NUMERIC;


-- 2. Create lead_attribution table
CREATE TABLE IF NOT EXISTS lead_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core UTM parameters
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  
  -- Matched Meta campaign identifier (if provided or extractable)
  meta_campaign_id TEXT,
  
  -- Session data
  landing_page TEXT,
  referrer TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast joining and filtering
CREATE INDEX IF NOT EXISTS idx_lead_attribution_tenant ON lead_attribution(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_attribution_utm_campaign ON lead_attribution(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_lead_attribution_meta_campaign ON lead_attribution(meta_campaign_id);

-- Enable RLS
ALTER TABLE lead_attribution ENABLE ROW LEVEL SECURITY;

-- 3. Update the handle_new_user trigger to save UTM data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant_name TEXT;
  v_full_name TEXT;
  v_phone TEXT;
  v_main_domain TEXT;
  v_code TEXT;
  v_base_slug TEXT;
  v_final_slug TEXT;
  v_suffix INTEGER;
  v_slug_exists BOOLEAN;
  
  -- UTM specific variables
  v_utm_source TEXT;
  v_utm_medium TEXT;
  v_utm_campaign TEXT;
  v_utm_term TEXT;
  v_utm_content TEXT;
  v_landing_page TEXT;
  v_referrer TEXT;
BEGIN
  -- Extract metadata from the new user
  v_tenant_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'tenant_name'), '');
  v_full_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');
  v_phone := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');
  v_main_domain := NULLIF(TRIM(NEW.raw_user_meta_data->>'main_domain'), '');
  v_code := NULLIF(TRIM(NEW.raw_user_meta_data->>'code'), '');
  
  -- Extract UTM data
  v_utm_source := NULLIF(TRIM(NEW.raw_user_meta_data->>'utm_source'), '');
  v_utm_medium := NULLIF(TRIM(NEW.raw_user_meta_data->>'utm_medium'), '');
  v_utm_campaign := NULLIF(TRIM(NEW.raw_user_meta_data->>'utm_campaign'), '');
  v_utm_term := NULLIF(TRIM(NEW.raw_user_meta_data->>'utm_term'), '');
  v_utm_content := NULLIF(TRIM(NEW.raw_user_meta_data->>'utm_content'), '');
  v_landing_page := NULLIF(TRIM(NEW.raw_user_meta_data->>'landing_page'), '');
  v_referrer := NULLIF(TRIM(NEW.raw_user_meta_data->>'referrer'), '');

  -- Generate random 3-word name if tenant_name is missing
  IF v_tenant_name IS NULL THEN
    v_tenant_name := public.generate_random_words();
  END IF;

  -- Default to 'User' if full_name is missing
  IF v_full_name IS NULL THEN
    v_full_name := 'User';
  END IF;

  -- 1. Generate tenant slug
  v_base_slug := TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(v_tenant_name), '[^a-z0-9]+', '-', 'g'));
  IF v_base_slug = '' THEN
    v_base_slug := 'tenant';
  END IF;

  v_final_slug := v_base_slug;

  -- Loop to find a unique slug
  LOOP
    SELECT EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_final_slug) INTO v_slug_exists;
    IF NOT v_slug_exists THEN
      EXIT; -- Found a unique slug
    END IF;
    
    -- If it exists, append a random 4-digit suffix and try again
    v_suffix := floor(random() * 9000 + 1000)::INT;
    v_final_slug := v_base_slug || '-' || v_suffix;
  END LOOP;

  -- 2. Create the tenant
  INSERT INTO public.tenants (name, slug, main_domain, code)
  VALUES (v_tenant_name, v_final_slug, v_main_domain, v_code)
  RETURNING id INTO v_tenant_id;

  -- 3. Create the profile
  INSERT INTO public.profiles (user_id, tenant_id, full_name, email, phone, locale)
  VALUES (
    NEW.id,
    v_tenant_id,
    v_full_name,
    NEW.email,
    v_phone,
    'en' -- Default locale
  );

  -- 4. Create the tenant_users record (owner role)
  INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active)
  VALUES (v_tenant_id, NEW.id, 'owner', true);

  -- 5. Track attribution if any UTM parameter exists
  IF v_utm_source IS NOT NULL OR v_utm_medium IS NOT NULL OR v_utm_campaign IS NOT NULL THEN
    INSERT INTO public.lead_attribution (
      tenant_id, user_id, 
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      landing_page, referrer
    ) VALUES (
      v_tenant_id, NEW.id,
      v_utm_source, v_utm_medium, v_utm_campaign, v_utm_term, v_utm_content,
      v_landing_page, v_referrer
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user trigger failed: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


