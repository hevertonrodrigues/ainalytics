-- ============================================================================
-- Index AI — Implement CHANGES.md punchlist for the blog API.
--
-- §1.1 — blog_article_sources (per-article external/academic citation list)
-- §3.1 — blog_ranking_faq (per region/sector/lang Q&A list)
-- §4.1 — publisher logo URL → extension-less /brand/logo
-- §1.3 — trim seeded article keywords to 5 entries (editorial guidance)
-- ============================================================================

-- ─── 1. blog_article_sources (CHANGES.md §1.1) ─────────────────────────────

CREATE TABLE blog_article_sources (
  article_id  TEXT NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  position    INT NOT NULL DEFAULT 0,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, position)
);
CREATE INDEX idx_blog_article_sources_article ON blog_article_sources(article_id, position);
ALTER TABLE blog_article_sources ENABLE ROW LEVEL SECURITY;

-- ─── 2. blog_ranking_faq (CHANGES.md §3.1) ─────────────────────────────────
-- region/sector are nullable: NULL means "applies to any region/sector".
-- The API picks the most-specific match available, falling back to global.

CREATE TABLE blog_ranking_faq (
  id           BIGSERIAL PRIMARY KEY,
  region       TEXT,
  sector       TEXT,
  lang         TEXT NOT NULL REFERENCES blog_languages(code),
  position     INT NOT NULL DEFAULT 0,
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blog_ranking_faq_lookup ON blog_ranking_faq(lang, region, sector, position);
CREATE TRIGGER trg_blog_ranking_faq_updated BEFORE UPDATE ON blog_ranking_faq
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();
ALTER TABLE blog_ranking_faq ENABLE ROW LEVEL SECURITY;

-- ─── 3. Publisher logo URL → extension-less (CHANGES.md §4.1) ──────────────

ALTER TABLE blog_locale_meta
  ALTER COLUMN publisher_logo_url SET DEFAULT 'https://indexai.news/brand/logo';
UPDATE blog_locale_meta
   SET publisher_logo_url = 'https://indexai.news/brand/logo'
 WHERE publisher_logo_url = 'https://indexai.news/brand/logo.png';

-- ─── 4. Trim seeded article keywords to 5 (CHANGES.md §1.3) ────────────────

UPDATE blog_article_translations
   SET meta_keywords = '["Generative Engine Optimization","AI search","ChatGPT","brand visibility","LATAM"]'::jsonb
 WHERE article_id = 'gen-search-traffic-war-2026';

DELETE FROM blog_article_keywords WHERE article_id = 'gen-search-traffic-war-2026';
INSERT INTO blog_article_keywords (article_id, keyword, position) VALUES
  ('gen-search-traffic-war-2026', 'Generative Engine Optimization', 0),
  ('gen-search-traffic-war-2026', 'AI search',                      1),
  ('gen-search-traffic-war-2026', 'ChatGPT',                        2),
  ('gen-search-traffic-war-2026', 'brand visibility',               3),
  ('gen-search-traffic-war-2026', 'LATAM',                          4);

-- ─── 5. Seed sources for the example article (CHANGES.md §1.1 example) ─────

INSERT INTO blog_article_sources (article_id, position, name, url) VALUES
  ('gen-search-traffic-war-2026', 0, 'Universidade de São Paulo',  'https://www5.usp.br/'),
  ('gen-search-traffic-war-2026', 1, 'IE Business School',         'https://www.ie.edu/business-school/');

-- ─── 6. Seed AVI FAQ × 3 langs (region=NULL, sector=NULL = global) ─────────

INSERT INTO blog_ranking_faq (region, sector, lang, position, question, answer) VALUES
  -- Portuguese
  (NULL, NULL, 'pt', 1,
    'O que é o Índice Ainalytics de Visibilidade em IA (AVI)?',
    'O AVI é a medida semanal de quão frequentemente uma marca aparece — e em qual posição — nas respostas geradas pelos principais motores de IA generativa: ChatGPT, Gemini, Claude, Perplexity e Grok.'),
  (NULL, NULL, 'pt', 2,
    'Como o AVI é calculado?',
    'Cada semana monitoramos 4,2 milhões de consultas em seis motores generativos. O score combina frequência de citação, posição média na resposta e sentimento, ponderado pela parcela de mercado de cada motor.'),
  (NULL, NULL, 'pt', 3,
    'Quais motores são monitorados?',
    'ChatGPT (OpenAI), Gemini (Google), Claude (Anthropic), Perplexity, Grok (xAI) e Copilot (Microsoft) — todos os principais motores generativos com tráfego comercial relevante.'),
  (NULL, NULL, 'pt', 4,
    'Com que frequência é atualizado?',
    'O ranking oficial é congelado toda segunda-feira. Coletas diárias alimentam um indicador de movimento de 7 dias para uso interno; o público vê a janela semanal estável.'),
  (NULL, NULL, 'pt', 5,
    'Quais setores e mercados são cobertos?',
    'Hoje 10 setores principais com 5 subsetores cada (50 nós). Mercados ativos: Brasil, Espanha e Estados Unidos — outros mercados têm rankings globais como fallback.'),
  (NULL, NULL, 'pt', 6,
    'O que faz o score de uma marca subir ou descer?',
    'Mais menções nas respostas geradas, posições mais altas dentro da resposta, sentimento mais positivo e maior consistência entre motores. Citações de fontes confiáveis (papers, mídia especializada) também aumentam o score.'),

  -- Spanish
  (NULL, NULL, 'es', 1,
    '¿Qué es el Índice Ainalytics de Visibilidad en IA (AVI)?',
    'El AVI es la medida semanal de la frecuencia con la que una marca aparece — y en qué posición — en las respuestas generadas por los principales motores de IA generativa: ChatGPT, Gemini, Claude, Perplexity y Grok.'),
  (NULL, NULL, 'es', 2,
    '¿Cómo se calcula el AVI?',
    'Cada semana monitorizamos 4,2 millones de consultas en seis motores generativos. La puntuación combina frecuencia de citación, posición media en la respuesta y sentimiento, ponderado por la cuota de mercado de cada motor.'),
  (NULL, NULL, 'es', 3,
    '¿Qué motores se monitorizan?',
    'ChatGPT (OpenAI), Gemini (Google), Claude (Anthropic), Perplexity, Grok (xAI) y Copilot (Microsoft) — todos los principales motores generativos con tráfico comercial relevante.'),
  (NULL, NULL, 'es', 4,
    '¿Con qué frecuencia se actualiza?',
    'El ranking oficial se congela cada lunes. Las recolecciones diarias alimentan un indicador de movimiento de 7 días para uso interno; el público ve la ventana semanal estable.'),
  (NULL, NULL, 'es', 5,
    '¿Qué sectores y mercados están cubiertos?',
    'Hoy 10 sectores principales con 5 subsectores cada uno (50 nodos). Mercados activos: Brasil, España y Estados Unidos — otros mercados tienen rankings globales como respaldo.'),
  (NULL, NULL, 'es', 6,
    '¿Qué hace que la puntuación de una marca suba o baje?',
    'Más menciones en las respuestas generadas, posiciones más altas dentro de la respuesta, sentimiento más positivo y mayor consistencia entre motores. Las citas de fuentes confiables (papers, medios especializados) también aumentan la puntuación.'),

  -- English
  (NULL, NULL, 'en', 1,
    'What is the Ainalytics AI Visibility Index (AVI)?',
    'The AVI is the weekly measure of how often a brand appears — and in what position — in answers generated by the major generative AI engines: ChatGPT, Gemini, Claude, Perplexity, and Grok.'),
  (NULL, NULL, 'en', 2,
    'How is the AVI calculated?',
    'Each week we monitor 4.2 million queries across six generative engines. The score blends citation frequency, average position within the answer, and sentiment, weighted by each engine''s market share.'),
  (NULL, NULL, 'en', 3,
    'Which engines are tracked?',
    'ChatGPT (OpenAI), Gemini (Google), Claude (Anthropic), Perplexity, Grok (xAI), and Copilot (Microsoft) — every major generative engine with relevant commercial traffic.'),
  (NULL, NULL, 'en', 4,
    'How often is it updated?',
    'The official ranking is frozen every Monday. Daily collection feeds a 7-day movement indicator for internal use; the public sees the stable weekly window.'),
  (NULL, NULL, 'en', 5,
    'What sectors and markets are covered?',
    'Today 10 main sectors with 5 subsectors each (50 nodes). Active markets: Brazil, Spain, and the United States — other markets fall back to global rankings.'),
  (NULL, NULL, 'en', 6,
    'What makes a brand''s score go up or down?',
    'More mentions in generated answers, higher positions within the answer, more positive sentiment, and greater consistency across engines. Citations from trusted sources (papers, specialist media) also increase the score.');
