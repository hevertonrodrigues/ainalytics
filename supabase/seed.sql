-- ============================================================
-- Seed: platforms + models (global, idempotent via ON CONFLICT)
-- ============================================================

-- ── Platforms ───────────────────────────────────────────────

INSERT INTO platforms (slug, name, is_active) VALUES
  ('openai',     'OpenAI',        true),
  ('anthropic',  'Anthropic',     true),
  ('gemini',     'Gemini',        true),
  ('grok',       'Grok (xAI)',    true)
  -- ('perplexity', 'Perplexity',    true)
ON CONFLICT (slug) DO NOTHING;

-- ── Models ──────────────────────────────────────────────────

-- OpenAI (only models that support web_search tool)
INSERT INTO models (platform_id, slug, name, is_active, web_search_active) VALUES
  ((SELECT id FROM platforms WHERE slug = 'openai'), 'gpt-5.2-pro',  'GPT-5.2 Pro',  true, true),
  ((SELECT id FROM platforms WHERE slug = 'openai'), 'gpt-4.1',      'GPT-4.1',      true, true),
  ((SELECT id FROM platforms WHERE slug = 'openai'), 'gpt-4.1-mini', 'GPT-4.1 Mini', true, true)
ON CONFLICT (platform_id, slug) DO NOTHING;

-- Anthropic (web_search_20250305 supported on all models)
INSERT INTO models (platform_id, slug, name, is_active, web_search_active) VALUES
  ((SELECT id FROM platforms WHERE slug = 'anthropic'), 'claude-sonnet-4-5-20250929',  'Claude Sonnet 4.5',  true, true),
  ((SELECT id FROM platforms WHERE slug = 'anthropic'), 'claude-opus-4-6',             'Claude Opus 4.6',    true, true),
  ((SELECT id FROM platforms WHERE slug = 'anthropic'), 'claude-haiku-4-5-20251001',   'Claude Haiku 4.5',   true, true)
ON CONFLICT (platform_id, slug) DO NOTHING;

-- Gemini (google_search grounding — only stable/GA models supported)
INSERT INTO models (platform_id, slug, name, is_active, web_search_active) VALUES
  ((SELECT id FROM platforms WHERE slug = 'gemini'), 'gemini-2.5-pro',         'Gemini 2.5 Pro',         true, true),
  ((SELECT id FROM platforms WHERE slug = 'gemini'), 'gemini-2.5-flash-lite',  'Gemini 2.5 Flash-Lite',  true, true)
ON CONFLICT (platform_id, slug) DO NOTHING;

-- Grok (xAI) — uses Responses API with web_search tool
INSERT INTO models (platform_id, slug, name, is_active, web_search_active) VALUES
  ((SELECT id FROM platforms WHERE slug = 'grok'), 'grok-4-1-fast',  'Grok 4.1 Fast',  true, true),
  ((SELECT id FROM platforms WHERE slug = 'grok'), 'grok-4',         'Grok 4',         true, true)
ON CONFLICT (platform_id, slug) DO NOTHING;

-- -- Perplexity
-- INSERT INTO models (platform_id, slug, name, is_active, web_search_active) VALUES
--   ((SELECT id FROM platforms WHERE slug = 'perplexity'), 'llama-3.1-sonar-large-online', 'Sonar Large Online',  true, false),
--   ((SELECT id FROM platforms WHERE slug = 'perplexity'), 'llama-3.1-sonar-small-online', 'Sonar Small Online',  true, false),
--   ((SELECT id FROM platforms WHERE slug = 'perplexity'), 'llama-3.1-sonar-huge-online',  'Sonar Huge Online',   true, false)
-- ON CONFLICT (platform_id, slug) DO NOTHING;

-- ── Set default_model_id on platforms ───────────────────────

UPDATE platforms SET default_model_id = (SELECT id FROM models WHERE platform_id = platforms.id AND slug = 'gpt-5.2-pro') WHERE slug = 'openai';
UPDATE platforms SET default_model_id = (SELECT id FROM models WHERE platform_id = platforms.id AND slug = 'claude-sonnet-4-5-20250929') WHERE slug = 'anthropic';
UPDATE platforms SET default_model_id = (SELECT id FROM models WHERE platform_id = platforms.id AND slug = 'gemini-2.5-pro') WHERE slug = 'gemini';
UPDATE platforms SET default_model_id = (SELECT id FROM models WHERE platform_id = platforms.id AND slug = 'grok-4-1-fast') WHERE slug = 'grok';
-- UPDATE platforms SET default_model_id = (SELECT id FROM models WHERE platform_id = platforms.id AND slug = 'llama-3.1-sonar-large-online') WHERE slug = 'perplexity';

-- ── Activation Plans ────────────────────────────────────────

INSERT INTO activation_plans (code, is_active) VALUES
  ('012345678910', true)
ON CONFLICT (code) DO NOTHING;
