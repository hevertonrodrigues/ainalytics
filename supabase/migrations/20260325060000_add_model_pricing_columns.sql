-- ============================================================
-- Add pricing columns to models table
-- ============================================================

ALTER TABLE models
  ADD COLUMN IF NOT EXISTS price_per_input_token  NUMERIC(20, 12) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_per_output_token NUMERIC(20, 12) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_updated_at     TIMESTAMPTZ DEFAULT now();

-- ── Seed pricing for known models ──────────────────────────
-- Prices in USD per token (as of March 2026)
-- IMPORTANT: Only update slugs that exist in the `models` table.

-- OpenAI
UPDATE models SET
  price_per_input_token  = 0.000003,
  price_per_output_token = 0.000012,
  pricing_updated_at     = now()
WHERE slug = 'gpt-4.1'
  AND platform_id = (SELECT id FROM platforms WHERE slug = 'openai');

UPDATE models SET
  price_per_input_token  = 0.0000004,
  price_per_output_token = 0.0000016,
  pricing_updated_at     = now()
WHERE slug = 'gpt-4.1-mini'
  AND platform_id = (SELECT id FROM platforms WHERE slug = 'openai');

UPDATE models SET
  price_per_input_token  = 0.000010,
  price_per_output_token = 0.000040,
  pricing_updated_at     = now()
WHERE slug = 'gpt-5.2-pro'
  AND platform_id = (SELECT id FROM platforms WHERE slug = 'openai');

-- Anthropic
UPDATE models SET
  price_per_input_token  = 0.000003,
  price_per_output_token = 0.000015,
  pricing_updated_at     = now()
WHERE slug = 'claude-sonnet-4-5-20250929'
  AND platform_id = (SELECT id FROM platforms WHERE slug = 'anthropic');

UPDATE models SET
  price_per_input_token  = 0.000015,
  price_per_output_token = 0.000075,
  pricing_updated_at     = now()
WHERE slug = 'claude-opus-4-6'
  AND platform_id = (SELECT id FROM platforms WHERE slug = 'anthropic');

UPDATE models SET
  price_per_input_token  = 0.0000008,
  price_per_output_token = 0.000004,
  pricing_updated_at     = now()
WHERE slug = 'claude-haiku-4-5-20251001'
  AND platform_id = (SELECT id FROM platforms WHERE slug = 'anthropic');

-- Gemini
UPDATE models SET
  price_per_input_token  = 0.00000125,
  price_per_output_token = 0.000005,
  pricing_updated_at     = now()
WHERE slug = 'gemini-2.5-pro'
  AND platform_id = (SELECT id FROM platforms WHERE slug = 'gemini');

UPDATE models SET
  price_per_input_token  = 0.00000015,
  price_per_output_token = 0.0000006,
  pricing_updated_at     = now()
WHERE slug = 'gemini-2.5-flash-lite'
  AND platform_id = (SELECT id FROM platforms WHERE slug = 'gemini');

-- Grok (xAI)
UPDATE models SET
  price_per_input_token  = 0.000003,
  price_per_output_token = 0.000015,
  pricing_updated_at     = now()
WHERE slug = 'grok-4'
  AND platform_id = (SELECT id FROM platforms WHERE slug = 'grok');

UPDATE models SET
  price_per_input_token  = 0.0000005,
  price_per_output_token = 0.000004,
  pricing_updated_at     = now()
WHERE slug = 'grok-4-1-fast'
  AND platform_id = (SELECT id FROM platforms WHERE slug = 'grok');

