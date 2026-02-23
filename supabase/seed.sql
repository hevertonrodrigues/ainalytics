-- ============================================================
-- Seed: platforms + models (global, idempotent via ON CONFLICT)
-- ============================================================

-- ── Platforms ───────────────────────────────────────────────

INSERT INTO platforms (slug, name, is_active) VALUES
  ('openai',     'OpenAI',        true),
  ('anthropic',  'Anthropic',     true),
  ('gemini',     'Gemini',        true),
  ('grok',       'Grok (xAI)',    true),
  ('perplexity', 'Perplexity',    true)
ON CONFLICT (slug) DO NOTHING;

-- ── Models ──────────────────────────────────────────────────

-- OpenAI
INSERT INTO models (platform_id, slug, name, is_default, is_active) VALUES
  ((SELECT id FROM platforms WHERE slug = 'openai'), 'gpt-5.2',      'GPT-5.2',      true,  true),
  ((SELECT id FROM platforms WHERE slug = 'openai'), 'gpt-5.2-mini', 'GPT-5.2 Mini', false, true),
  ((SELECT id FROM platforms WHERE slug = 'openai'), 'gpt-5.2-pro',  'GPT-5.2 Pro',  false, true),
  ((SELECT id FROM platforms WHERE slug = 'openai'), 'gpt-5-pro',    'GPT-5 Pro',    false, true),
  ((SELECT id FROM platforms WHERE slug = 'openai'), 'gpt-4.1',      'GPT-4.1',      false, true),
  ((SELECT id FROM platforms WHERE slug = 'openai'), 'gpt-4.1-mini', 'GPT-4.1 Mini', false, true),
  ((SELECT id FROM platforms WHERE slug = 'openai'), 'gpt-4.1-nano', 'GPT-4.1 Nano', false, true),
  ((SELECT id FROM platforms WHERE slug = 'openai'), 'o3',           'O3',            false, true),
  ((SELECT id FROM platforms WHERE slug = 'openai'), 'o4-mini',      'O4 Mini',       false, true)
ON CONFLICT (platform_id, slug) DO NOTHING;

-- Anthropic
INSERT INTO models (platform_id, slug, name, is_default, is_active) VALUES
  ((SELECT id FROM platforms WHERE slug = 'anthropic'), 'claude-sonnet-4-6',           'Claude Sonnet 4.6',  true,  true),
  ((SELECT id FROM platforms WHERE slug = 'anthropic'), 'claude-sonnet-4-5-20250929',  'Claude Sonnet 4.5',  false, true),
  ((SELECT id FROM platforms WHERE slug = 'anthropic'), 'claude-opus-4-6',             'Claude Opus 4.6',    false, true),
  ((SELECT id FROM platforms WHERE slug = 'anthropic'), 'claude-haiku-4-5-20251001',   'Claude Haiku 4.5',   false, true)
ON CONFLICT (platform_id, slug) DO NOTHING;

-- Gemini
INSERT INTO models (platform_id, slug, name, is_default, is_active) VALUES
  ((SELECT id FROM platforms WHERE slug = 'gemini'), 'gemini-3.1-pro',         'Gemini 3.1 Pro',         true,  true),
  ((SELECT id FROM platforms WHERE slug = 'gemini'), 'gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview', false, true),
  ((SELECT id FROM platforms WHERE slug = 'gemini'), 'gemini-3-flash',         'Gemini 3 Flash',         false, true),
  ((SELECT id FROM platforms WHERE slug = 'gemini'), 'gemini-2.5-pro',         'Gemini 2.5 Pro',         false, true),
  ((SELECT id FROM platforms WHERE slug = 'gemini'), 'gemini-2.5-flash',       'Gemini 2.5 Flash',       false, true),
  ((SELECT id FROM platforms WHERE slug = 'gemini'), 'gemini-2.5-flash-lite',  'Gemini 2.5 Flash-Lite',  false, true)
ON CONFLICT (platform_id, slug) DO NOTHING;

-- Grok (xAI)
INSERT INTO models (platform_id, slug, name, is_default, is_active) VALUES
  ((SELECT id FROM platforms WHERE slug = 'grok'), 'grok-4-1-fast-reasoning',      'Grok 4.1 Fast Reasoning',      true,  true),
  ((SELECT id FROM platforms WHERE slug = 'grok'), 'grok-4-1-fast-non-reasoning',  'Grok 4.1 Fast Non-Reasoning',  false, true),
  ((SELECT id FROM platforms WHERE slug = 'grok'), 'grok-4-fast-non-reasoning',    'Grok 4 Fast Non-Reasoning',    false, true),
  ((SELECT id FROM platforms WHERE slug = 'grok'), 'grok-3',                       'Grok 3',                       false, true),
  ((SELECT id FROM platforms WHERE slug = 'grok'), 'grok-3-mini',                  'Grok 3 Mini',                  false, true)
ON CONFLICT (platform_id, slug) DO NOTHING;

-- Perplexity
INSERT INTO models (platform_id, slug, name, is_default, is_active) VALUES
  ((SELECT id FROM platforms WHERE slug = 'perplexity'), 'llama-3.1-sonar-large-online', 'Sonar Large Online',  true,  true),
  ((SELECT id FROM platforms WHERE slug = 'perplexity'), 'llama-3.1-sonar-small-online', 'Sonar Small Online',  false, true),
  ((SELECT id FROM platforms WHERE slug = 'perplexity'), 'llama-3.1-sonar-huge-online',  'Sonar Huge Online',   false, true)
ON CONFLICT (platform_id, slug) DO NOTHING;

-- ── Set default_model_id on platforms ───────────────────────

UPDATE platforms SET default_model_id = (
  SELECT id FROM models WHERE platform_id = platforms.id AND is_default = true LIMIT 1
) WHERE default_model_id IS NULL;
