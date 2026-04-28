-- ============================================================================
-- Rankings extensions — implements RANKINGS_REQUIREMENTS.md
--
-- Adds:
--   1. engine_scores JSONB on blog_ranking_items
--   2. blog_methodology_pillars + translations (AVI methodology)
--   3. blog_engine_profiles + translations (per-engine cards)
--   4. blog_ranking_insights (per-snapshot editorial cards)
-- ============================================================================

-- ─── 1. Per-engine scores per leaderboard row ───────────────────────────────

ALTER TABLE blog_ranking_items
  ADD COLUMN IF NOT EXISTS engine_scores JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN blog_ranking_items.engine_scores IS
  'Per-engine score map keyed by engine id (e.g. {"chatgpt":96,"gemini":92}). Keys must match blog_engine_profiles.id.';


-- ─── 2. AVI methodology pillars ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blog_methodology_pillars (
  id          TEXT PRIMARY KEY,
  weight      INT  NOT NULL DEFAULT 0,
  position    INT  NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_methodology_pillars_updated BEFORE UPDATE ON blog_methodology_pillars
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE IF NOT EXISTS blog_methodology_pillar_translations (
  pillar_id   TEXT NOT NULL REFERENCES blog_methodology_pillars(id) ON DELETE CASCADE,
  lang        TEXT NOT NULL REFERENCES blog_languages(code) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pillar_id, lang)
);
CREATE TRIGGER trg_blog_methodology_pillar_translations_updated BEFORE UPDATE ON blog_methodology_pillar_translations
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();


-- ─── 3. Engine profiles ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blog_engine_profiles (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#7C7C7C',
  position    INT  NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_engine_profiles_updated BEFORE UPDATE ON blog_engine_profiles
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE IF NOT EXISTS blog_engine_profile_translations (
  engine_id   TEXT NOT NULL REFERENCES blog_engine_profiles(id) ON DELETE CASCADE,
  lang        TEXT NOT NULL REFERENCES blog_languages(code) ON DELETE CASCADE,
  tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
  bias        TEXT  NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (engine_id, lang)
);
CREATE TRIGGER trg_blog_engine_profile_translations_updated BEFORE UPDATE ON blog_engine_profile_translations
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();


-- ─── 4. Editorial insights, scoped per snapshot+lang ─────────────────────────

CREATE TABLE IF NOT EXISTS blog_ranking_insights (
  id          BIGSERIAL PRIMARY KEY,
  snapshot_id BIGINT NOT NULL REFERENCES blog_ranking_snapshots(id) ON DELETE CASCADE,
  lang        TEXT   NOT NULL REFERENCES blog_languages(code) ON DELETE CASCADE,
  position    INT    NOT NULL DEFAULT 0,
  tag         TEXT   NOT NULL DEFAULT '',
  title       TEXT   NOT NULL,
  text        TEXT   NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, lang, position)
);
CREATE INDEX IF NOT EXISTS idx_blog_ranking_insights_snapshot_lang
  ON blog_ranking_insights (snapshot_id, lang, position);
CREATE TRIGGER trg_blog_ranking_insights_updated BEFORE UPDATE ON blog_ranking_insights
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();


-- ─── 5. Seed defaults ────────────────────────────────────────────────────────

-- Pillars (5 default — match the editorial copy currently in lib/content/rankings.ts)
INSERT INTO blog_methodology_pillars (id, weight, position) VALUES
  ('citation',     35, 1),
  ('position',     25, 2),
  ('sentiment',    15, 3),
  ('cross_engine', 15, 4),
  ('semantic',     10, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_methodology_pillar_translations (pillar_id, lang, name, description) VALUES
  ('citation',     'en', 'Citation frequency',  'How often a brand is mentioned across AI-generated answers, normalized for query volume.'),
  ('citation',     'pt', 'Frequência de citação','Com que frequência a marca é mencionada nas respostas geradas por IA, normalizada por volume de consultas.'),
  ('citation',     'es', 'Frecuencia de cita',  'Con qué frecuencia la marca es mencionada en respuestas generadas por IA, normalizada por volumen de consultas.'),

  ('position',     'en', 'Position in answer',  'Where the brand appears within the answer — leading paragraph, mid-body, or footnote.'),
  ('position',     'pt', 'Posição na resposta', 'Onde a marca aparece na resposta — parágrafo inicial, corpo intermediário ou nota de rodapé.'),
  ('position',     'es', 'Posición en la respuesta', 'Dónde aparece la marca en la respuesta — primer párrafo, cuerpo intermedio o nota.'),

  ('sentiment',    'en', 'Sentiment',           'The polarity (positive, neutral, negative) of the surrounding context.'),
  ('sentiment',    'pt', 'Sentimento',          'A polaridade (positivo, neutro, negativo) do contexto em que a marca aparece.'),
  ('sentiment',    'es', 'Sentimiento',         'La polaridad (positivo, neutral, negativo) del contexto donde aparece la marca.'),

  ('cross_engine', 'en', 'Cross-engine consistency', 'How consistently the brand surfaces across all monitored engines.'),
  ('cross_engine', 'pt', 'Consistência entre engines','Quão consistentemente a marca aparece em todas as engines monitoradas.'),
  ('cross_engine', 'es', 'Consistencia entre motores','Qué tan consistentemente la marca aparece en todos los motores monitorizados.'),

  ('semantic',     'en', 'Semantic depth',      'How richly the engine describes the brand — superficial mention vs. detailed explanation.'),
  ('semantic',     'pt', 'Profundidade semântica','Quão ricamente a engine descreve a marca — menção superficial vs. explicação detalhada.'),
  ('semantic',     'es', 'Profundidad semántica','Qué tan ricamente el motor describe la marca — mención superficial vs. explicación detallada.')
ON CONFLICT (pillar_id, lang) DO NOTHING;


-- Engine profiles (6 default engines)
INSERT INTO blog_engine_profiles (id, label, color, position) VALUES
  ('chatgpt',    'ChatGPT',    '#10A37F', 1),
  ('gemini',     'Gemini',     '#4285F4', 2),
  ('claude',     'Claude',     '#D97757', 3),
  ('perplexity', 'Perplexity', '#1FB8CD', 4),
  ('grok',       'Grok',       '#0F0F10', 5),
  ('copilot',    'Copilot',    '#0078D4', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_engine_profile_translations (engine_id, lang, tags, bias) VALUES
  ('chatgpt',    'en', '["Tier-1 media","Wikipedia","Reddit","Recent content"]'::jsonb,
   'Tends to cite established editorial sources and well-indexed knowledge bases. Favors brands with strong English-language press coverage.'),
  ('chatgpt',    'pt', '["Mídia tier-1","Wikipedia","Reddit","Conteúdo recente"]'::jsonb,
   'Tende a citar fontes editoriais estabelecidas e bases de conhecimento bem indexadas. Favorece marcas com forte cobertura na imprensa em inglês.'),
  ('chatgpt',    'es', '["Medios tier-1","Wikipedia","Reddit","Contenido reciente"]'::jsonb,
   'Tiende a citar fuentes editoriales establecidas y bases de conocimiento bien indexadas. Favorece marcas con fuerte cobertura en la prensa en inglés.'),

  ('gemini',     'en', '["Google index","YouTube","Schema.org","Maps"]'::jsonb,
   'Pulls heavily from the Google index and structured data. Brands with rich schema markup and Google Business listings score higher.'),
  ('gemini',     'pt', '["Índice Google","YouTube","Schema.org","Maps"]'::jsonb,
   'Puxa fortemente do índice Google e de dados estruturados. Marcas com schema markup rico e ficha no Google Business pontuam melhor.'),
  ('gemini',     'es', '["Índice Google","YouTube","Schema.org","Maps"]'::jsonb,
   'Extrae mayormente del índice de Google y datos estructurados. Marcas con schema markup rico y ficha en Google Business puntúan mejor.'),

  ('claude',     'en', '["Long-form","Documentation","Whitepapers","Recent"]'::jsonb,
   'Prefers depth over breadth. Cites long-form articles, official docs and whitepapers — less likely to surface social signals.'),
  ('claude',     'pt', '["Conteúdo longo","Documentação","Whitepapers","Recente"]'::jsonb,
   'Prefere profundidade a amplitude. Cita artigos longos, documentação oficial e whitepapers — pouco propenso a sinais sociais.'),
  ('claude',     'es', '["Contenido extenso","Documentación","Whitepapers","Reciente"]'::jsonb,
   'Prefiere profundidad sobre amplitud. Cita artículos extensos, documentación oficial y whitepapers — menos propenso a señales sociales.'),

  ('perplexity', 'en', '["Live search","Citations","Wikipedia","News"]'::jsonb,
   'Citation-first by design. Always names its sources and weighs recent news heavily — a strong signal for time-sensitive brands.'),
  ('perplexity', 'pt', '["Busca ao vivo","Citações","Wikipedia","Notícias"]'::jsonb,
   'Citações em primeiro plano por design. Sempre nomeia suas fontes e dá peso a notícias recentes — sinal forte para marcas sensíveis ao tempo.'),
  ('perplexity', 'es', '["Búsqueda en vivo","Citas","Wikipedia","Noticias"]'::jsonb,
   'Citas en primer plano por diseño. Siempre nombra sus fuentes y pondera fuertemente las noticias recientes — fuerte señal para marcas sensibles al tiempo.'),

  ('grok',       'en', '["X / Twitter","Real-time","Trends","Conversational"]'::jsonb,
   'Heavily weighted toward X/Twitter signals. Brands that engage in real-time conversations and trend cycles surface more often.'),
  ('grok',       'pt', '["X / Twitter","Tempo real","Tendências","Conversacional"]'::jsonb,
   'Fortemente influenciado por sinais do X/Twitter. Marcas que participam de conversas em tempo real e ciclos de tendências aparecem mais.'),
  ('grok',       'es', '["X / Twitter","Tiempo real","Tendencias","Conversacional"]'::jsonb,
   'Fuertemente influenciado por señales de X/Twitter. Marcas que participan en conversaciones en tiempo real y ciclos de tendencias aparecen más.'),

  ('copilot',    'en', '["Bing index","LinkedIn","Microsoft 365","Enterprise"]'::jsonb,
   'Bing-backed and enterprise-flavored. Cites LinkedIn profiles, Microsoft 365 ecosystem content and B2B sources more than consumer signals.'),
  ('copilot',    'pt', '["Índice Bing","LinkedIn","Microsoft 365","Corporativo"]'::jsonb,
   'Apoiado no Bing e com forte viés corporativo. Cita perfis do LinkedIn, conteúdo do ecossistema Microsoft 365 e fontes B2B mais do que sinais de consumo.'),
  ('copilot',    'es', '["Índice Bing","LinkedIn","Microsoft 365","Empresarial"]'::jsonb,
   'Respaldado en Bing y con fuerte sesgo empresarial. Cita perfiles de LinkedIn, contenido del ecosistema Microsoft 365 y fuentes B2B más que señales de consumo.')
ON CONFLICT (engine_id, lang) DO NOTHING;
