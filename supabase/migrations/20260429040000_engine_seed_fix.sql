-- ============================================================================
-- Engine seed fix:
--   1. The 6 engines now seeded by 20260428220000_rankings_extensions.sql
--      should have unique positions 1..6, but production restores left a
--      collision (both grok and perplexity at position=5). Re-anchor.
--   2. Production-side restore lacked perplexity and copilot translations.
--      Re-insert them (idempotent on conflict).
-- ============================================================================

-- 1. Canonical positions
UPDATE blog_engines SET position = 1 WHERE id = 'chatgpt';
UPDATE blog_engines SET position = 2 WHERE id = 'gemini';
UPDATE blog_engines SET position = 3 WHERE id = 'claude';
UPDATE blog_engines SET position = 4 WHERE id = 'perplexity';
UPDATE blog_engines SET position = 5 WHERE id = 'grok';
UPDATE blog_engines SET position = 6 WHERE id = 'copilot';

-- Make sure the 6 canonical engines exist (idempotent — no-op on conflict).
INSERT INTO blog_engines (id, label, color, position) VALUES
  ('chatgpt',    'ChatGPT',    '#10A37F', 1),
  ('gemini',     'Gemini',     '#4285F4', 2),
  ('claude',     'Claude',     '#D97757', 3),
  ('perplexity', 'Perplexity', '#1FB8CD', 4),
  ('grok',       'Grok',       '#0F0F10', 5),
  ('copilot',    'Copilot',    '#0078D4', 6)
ON CONFLICT (id) DO NOTHING;

-- 2. Re-seed translations for engines that may be missing them.
INSERT INTO blog_engine_translations (engine_id, lang, tags, bias) VALUES
  ('perplexity', 'en', '["Live search","Citations","Wikipedia","News"]'::jsonb,
   'Citation-first by design. Always names its sources and weighs recent news heavily — a strong signal for time-sensitive brands.'),
  ('perplexity', 'pt', '["Busca ao vivo","Citações","Wikipedia","Notícias"]'::jsonb,
   'Citações em primeiro plano por design. Sempre nomeia suas fontes e dá peso a notícias recentes — sinal forte para marcas sensíveis ao tempo.'),
  ('perplexity', 'es', '["Búsqueda en vivo","Citas","Wikipedia","Noticias"]'::jsonb,
   'Citas en primer plano por diseño. Siempre nombra sus fuentes y pondera fuertemente las noticias recientes — fuerte señal para marcas sensibles al tiempo.'),

  ('copilot', 'en', '["Bing index","LinkedIn","Microsoft 365","Enterprise"]'::jsonb,
   'Bing-backed and enterprise-flavored. Cites LinkedIn profiles, Microsoft 365 ecosystem content and B2B sources more than consumer signals.'),
  ('copilot', 'pt', '["Índice Bing","LinkedIn","Microsoft 365","Corporativo"]'::jsonb,
   'Apoiado no Bing e com forte viés corporativo. Cita perfis do LinkedIn, conteúdo do ecossistema Microsoft 365 e fontes B2B mais do que sinais de consumo.'),
  ('copilot', 'es', '["Índice Bing","LinkedIn","Microsoft 365","Empresarial"]'::jsonb,
   'Respaldado en Bing y con fuerte sesgo empresarial. Cita perfiles de LinkedIn, contenido del ecosistema Microsoft 365 y fuentes B2B más que señales de consumo.')
ON CONFLICT (engine_id, lang) DO NOTHING;
