-- ============================================================================
-- Index AI — Blog seed data (mirrors _api-doc/seeds/*.json verbatim)
-- ============================================================================

-- ─── Languages ──────────────────────────────────────────────────────────────

INSERT INTO blog_languages (code, locale, label, is_default, is_active, position) VALUES
  ('pt', 'pt-BR', 'Português', true,  true, 1),
  ('es', 'es-ES', 'Español',   false, true, 2),
  ('en', 'en-US', 'English',   false, true, 3)
ON CONFLICT (code) DO NOTHING;

-- ─── Authors ────────────────────────────────────────────────────────────────

INSERT INTO blog_authors (id, image_url, social) VALUES
  ('mariana-duarte',  'https://indexai.news/authors/mariana-duarte.jpg',
    '{"x":"https://x.com/marianaduarte","linkedin":"https://www.linkedin.com/in/marianaduarte","email":"mariana@indexai.news"}'::jsonb),
  ('rafael-andrade',  'https://indexai.news/authors/rafael-andrade.jpg',  '{}'::jsonb),
  ('beatriz-menezes', 'https://indexai.news/authors/beatriz-menezes.jpg', '{}'::jsonb),
  ('laura-costa',     'https://indexai.news/authors/laura-costa.jpg',     '{}'::jsonb),
  ('diego-ramos',     'https://indexai.news/authors/diego-ramos.jpg',     '{}'::jsonb),
  ('carmen-vila',     'https://indexai.news/authors/carmen-vila.jpg',     '{}'::jsonb),
  ('paulo-vieira',    'https://indexai.news/authors/paulo-vieira.jpg',    '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_author_translations (author_id, lang, name, role, bio) VALUES
  ('mariana-duarte',  'pt', 'Mariana Duarte',  'Editora-chefe · Ainalytics Research',
    'Mariana lidera a redação do Index AI desde a fundação. Ex-pesquisadora da USP, é co-autora do Índice Ainalytics de Visibilidade em IA (AVI).'),
  ('mariana-duarte',  'es', 'Mariana Duarte',  'Editora jefe · Ainalytics Research',
    'Mariana lidera la redacción de Index AI desde su fundación. Ex investigadora de la USP, es coautora del Índice Ainalytics de Visibilidad en IA (AVI).'),
  ('mariana-duarte',  'en', 'Mariana Duarte',  'Editor-in-chief · Ainalytics Research',
    'Mariana has led the Index AI newsroom since its founding. A former USP researcher, she co-authored the Ainalytics AI Visibility Index (AVI).'),

  ('rafael-andrade',  'pt', 'Rafael Andrade',  'Repórter de pesquisa',
    'Cobre estudos acadêmicos sobre comportamento de busca generativa em mercados lusófonos.'),
  ('rafael-andrade',  'es', 'Rafael Andrade',  'Reportero de investigación',
    'Cobre estudios académicos sobre el comportamiento de búsqueda generativa en mercados lusófonos.'),
  ('rafael-andrade',  'en', 'Rafael Andrade',  'Research reporter',
    'Covers academic studies on generative search behavior in Portuguese-speaking markets.'),

  ('beatriz-menezes', 'pt', 'Beatriz Menezes', 'Editora de casos',
    'Acompanha estratégias de marca e suas presenças em respostas de IA generativa.'),
  ('beatriz-menezes', 'es', 'Beatriz Menezes', 'Editora de casos',
    'Sigue estrategias de marca y su presencia en respuestas de IA generativa.'),
  ('beatriz-menezes', 'en', 'Beatriz Menezes', 'Cases editor',
    'Tracks brand strategies and their presence in generative AI responses.'),

  ('laura-costa',     'pt', 'Laura Costa',     'Colunista · Ex-Google',
    'Trabalhou por uma década na equipe de qualidade de busca do Google. Hoje escreve sobre o futuro do funil de marketing.'),
  ('laura-costa',     'es', 'Laura Costa',     'Columnista · Ex-Google',
    'Trabajó una década en el equipo de calidad de búsqueda de Google. Hoy escribe sobre el futuro del embudo de marketing.'),
  ('laura-costa',     'en', 'Laura Costa',     'Columnist · Former Google',
    'Spent a decade on Google''s search quality team. Now writes about the future of the marketing funnel.'),

  ('diego-ramos',     'pt', 'Diego Ramos',     'Repórter de produto',
    'Cobre lançamentos e mudanças de produto em ChatGPT, Gemini, Perplexity e Copilot.'),
  ('diego-ramos',     'es', 'Diego Ramos',     'Reportero de producto',
    'Cubre lanzamientos y cambios de producto en ChatGPT, Gemini, Perplexity y Copilot.'),
  ('diego-ramos',     'en', 'Diego Ramos',     'Product reporter',
    'Covers product launches and changes across ChatGPT, Gemini, Perplexity and Copilot.'),

  ('carmen-vila',     'pt', 'Carmen Vila',     'Correspondente · Europa',
    'Baseada em Madri, cobre regulação de IA e tendências do mercado europeu.'),
  ('carmen-vila',     'es', 'Carmen Vila',     'Corresponsal · Europa',
    'Con base en Madrid, cubre regulación de IA y tendencias del mercado europeo.'),
  ('carmen-vila',     'en', 'Carmen Vila',     'Correspondent · Europe',
    'Based in Madrid, covers AI regulation and trends across the European market.'),

  ('paulo-vieira',    'pt', 'Paulo Vieira',    'Correspondente · LATAM',
    'Cobre a adoção de IA generativa nos mercados de Brasil, México, Argentina e Colômbia.'),
  ('paulo-vieira',    'es', 'Paulo Vieira',    'Corresponsal · LATAM',
    'Cubre la adopción de IA generativa en Brasil, México, Argentina y Colombia.'),
  ('paulo-vieira',    'en', 'Paulo Vieira',    'Correspondent · LATAM',
    'Covers generative AI adoption across Brazil, Mexico, Argentina and Colombia.')
ON CONFLICT (author_id, lang) DO NOTHING;

-- ─── Categories ─────────────────────────────────────────────────────────────

INSERT INTO blog_categories (id, position, is_active) VALUES
  ('research', 1, true),
  ('product',  2, true),
  ('case',     3, true),
  ('opinion',  4, true),
  ('latam',    5, true),
  ('europe',   6, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_category_translations (category_id, lang, slug, label, description, seo_title, segment) VALUES
  ('research', 'pt', 'pesquisa',      'Pesquisa',      'Estudos e análises sobre como motores generativos selecionam, citam e priorizam marcas em português.', 'Pesquisa — Pesquisa em Generative Engine Optimization', 'categoria'),
  ('research', 'es', 'investigacion', 'Investigación', 'Estudios y análisis sobre cómo los motores generativos seleccionan, citan y priorizan marcas en español.', 'Investigación — Investigación en Generative Engine Optimization', 'categoria'),
  ('research', 'en', 'research',      'Research',      'Studies and analyses on how generative engines select, cite and prioritize brands across markets.', 'Research — Research on Generative Engine Optimization', 'category'),

  ('product',  'pt', 'produto',  'Produto',  'Lançamentos, recursos e mudanças em ChatGPT, Gemini, Perplexity, Claude, Grok e Copilot.', 'Produto — Atualizações de produto dos motores generativos', 'categoria'),
  ('product',  'es', 'producto', 'Producto', 'Lanzamientos, funciones y cambios en ChatGPT, Gemini, Perplexity, Claude, Grok y Copilot.', 'Producto — Actualizaciones de producto de los motores generativos', 'categoria'),
  ('product',  'en', 'product',  'Product',  'Launches, features and changes across ChatGPT, Gemini, Perplexity, Claude, Grok and Copilot.', 'Product — Product updates across generative engines', 'category'),

  ('case', 'pt', 'caso', 'Caso', 'Histórias de marcas que ganharam (ou perderam) visibilidade em respostas de IA.', 'Caso — Casos de marcas em busca generativa', 'categoria'),
  ('case', 'es', 'caso', 'Caso', 'Historias de marcas que ganaron (o perdieron) visibilidad en respuestas de IA.', 'Caso — Casos de marcas en búsqueda generativa', 'categoria'),
  ('case', 'en', 'case', 'Case', 'Stories of brands that gained (or lost) visibility in AI-generated answers.', 'Case — Brand cases in generative search', 'category'),

  ('opinion', 'pt', 'opiniao', 'Opinião', 'Ensaios e colunas sobre o futuro do marketing em um funil dominado por motores generativos.', 'Opinião — Opinião sobre busca generativa', 'categoria'),
  ('opinion', 'es', 'opinion', 'Opinión', 'Ensayos y columnas sobre el futuro del marketing en un embudo dominado por motores generativos.', 'Opinión — Opinión sobre búsqueda generativa', 'categoria'),
  ('opinion', 'en', 'opinion', 'Opinion', 'Essays and columns on the future of marketing in a funnel shaped by generative engines.', 'Opinion — Opinion on generative search', 'category'),

  ('latam', 'pt', 'latam', 'LATAM', 'Cobertura regional da América Latina: Brasil, México, Argentina, Colômbia e Chile.', 'LATAM — Busca generativa na América Latina', 'categoria'),
  ('latam', 'es', 'latam', 'LATAM', 'Cobertura regional de América Latina: Brasil, México, Argentina, Colombia y Chile.', 'LATAM — Búsqueda generativa en América Latina', 'categoria'),
  ('latam', 'en', 'latam', 'LATAM', 'Regional coverage of Latin America: Brazil, Mexico, Argentina, Colombia and Chile.', 'LATAM — Generative search in Latin America', 'category'),

  ('europe', 'pt', 'europa', 'Europa', 'Cobertura europeia: regulação, players locais e tendências em Espanha, Portugal, França e Alemanha.', 'Europa — Busca generativa na Europa', 'categoria'),
  ('europe', 'es', 'europa', 'Europa', 'Cobertura europea: regulación, actores locales y tendencias en España, Portugal, Francia y Alemania.', 'Europa — Búsqueda generativa en Europa', 'categoria'),
  ('europe', 'en', 'europe', 'Europe', 'European coverage: regulation, local players and trends across Spain, Portugal, France and Germany.', 'Europe — Generative search in Europe', 'category')
ON CONFLICT (category_id, lang) DO NOTHING;

-- ─── Tags ───────────────────────────────────────────────────────────────────

INSERT INTO blog_tags (id, is_engine) VALUES
  ('chatgpt',    true),
  ('gemini',     true),
  ('perplexity', true),
  ('claude',     true),
  ('grok',       true),
  ('copilot',    true),
  ('research',   false),
  ('exclusive',  false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_tag_translations (tag_id, lang, slug, label) VALUES
  ('chatgpt',   'pt', 'chatgpt',   'ChatGPT'),
  ('chatgpt',   'es', 'chatgpt',   'ChatGPT'),
  ('chatgpt',   'en', 'chatgpt',   'ChatGPT'),
  ('gemini',    'pt', 'gemini',    'Gemini'),
  ('gemini',    'es', 'gemini',    'Gemini'),
  ('gemini',    'en', 'gemini',    'Gemini'),
  ('perplexity','pt', 'perplexity','Perplexity'),
  ('perplexity','es', 'perplexity','Perplexity'),
  ('perplexity','en', 'perplexity','Perplexity'),
  ('claude',    'pt', 'claude',    'Claude'),
  ('claude',    'es', 'claude',    'Claude'),
  ('claude',    'en', 'claude',    'Claude'),
  ('grok',      'pt', 'grok',      'Grok'),
  ('grok',      'es', 'grok',      'Grok'),
  ('grok',      'en', 'grok',      'Grok'),
  ('copilot',   'pt', 'copilot',   'Copilot'),
  ('copilot',   'es', 'copilot',   'Copilot'),
  ('copilot',   'en', 'copilot',   'Copilot'),
  ('research',  'pt', 'pesquisa',     'Pesquisa'),
  ('research',  'es', 'investigacion','Investigación'),
  ('research',  'en', 'research',     'Research'),
  ('exclusive', 'pt', 'exclusivo', 'Estudo Exclusivo'),
  ('exclusive', 'es', 'exclusivo', 'Estudio Exclusivo'),
  ('exclusive', 'en', 'exclusive', 'Exclusive study')
ON CONFLICT (tag_id, lang) DO NOTHING;

-- ─── Engines ────────────────────────────────────────────────────────────────

INSERT INTO blog_engines (id, vendor, color, short_name, position, is_active) VALUES
  ('chatgpt',    'OpenAI',        '#10A37F', 'GPT', 1, true),
  ('gemini',     'Google',        '#4285F4', 'G',   2, true),
  ('perplexity', 'Perplexity AI', '#1FA8AC', 'P',   3, true),
  ('claude',     'Anthropic',     '#CC785C', 'C',   4, true),
  ('grok',       'xAI',           '#111111', 'X',   5, true),
  ('copilot',    'Microsoft',     '#0078D4', 'CP',  6, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_engine_translations (engine_id, lang, name, citations_trend_30d, user_base_label, latest_headline, latest_published_at, segment, article_count) VALUES
  ('chatgpt',    'pt', 'ChatGPT',   '+12% citações',  '2.1B prompts/mês',  'Indexação em tempo real começa a ser testada com editores premium.', '2026-04-26T08:30:00Z', 'motor',  43),
  ('chatgpt',    'es', 'ChatGPT',   '+12% citas',     '2.1B prompts/mes',  'La indexación en tiempo real comienza a probarse con editores premium.', '2026-04-26T08:30:00Z', 'motor',  43),
  ('chatgpt',    'en', 'ChatGPT',   '+12% citations', '2.1B prompts/mo',   'Real-time indexing begins testing with premium publishers.',          '2026-04-26T08:30:00Z', 'engine', 43),

  ('gemini',     'pt', 'Gemini',    '+8% citações',   '890M usuários',     'Gemini 2.5 prioriza conteúdo com autoria verificada em buscas locais.',          '2026-04-26T11:00:00Z', 'motor',  37),
  ('gemini',     'es', 'Gemini',    '+8% citas',      '890M usuarios',     'Gemini 2.5 prioriza contenido con autoría verificada en búsquedas locales.',     '2026-04-26T11:00:00Z', 'motor',  37),
  ('gemini',     'en', 'Gemini',    '+8% citations',  '890M users',        'Gemini 2.5 now prioritizes content with verified authorship in local search.',  '2026-04-26T11:00:00Z', 'engine', 37),

  ('perplexity', 'pt', 'Perplexity','+34% citações', '22M usuários', 'Lançamento do plano empresarial inclui dashboard de citações ao vivo.', '2026-04-25T15:20:00Z', 'motor',  29),
  ('perplexity', 'es', 'Perplexity','+34% citas',    '22M usuarios', 'El plan empresarial incluye panel de citas en vivo.',                   '2026-04-25T15:20:00Z', 'motor',  29),
  ('perplexity', 'en', 'Perplexity','+34% citations','22M users',    'Enterprise plan ships with a live citation dashboard for brands.',      '2026-04-25T15:20:00Z', 'engine', 29),

  ('claude',     'pt', 'Claude',    '', '', '', NULL, 'motor',  0),
  ('claude',     'es', 'Claude',    '', '', '', NULL, 'motor',  0),
  ('claude',     'en', 'Claude',    '', '', '', NULL, 'engine', 0),
  ('grok',       'pt', 'Grok',      '', '', '', NULL, 'motor',  0),
  ('grok',       'es', 'Grok',      '', '', '', NULL, 'motor',  0),
  ('grok',       'en', 'Grok',      '', '', '', NULL, 'engine', 0),
  ('copilot',    'pt', 'Copilot',   '', '', '', NULL, 'motor',  0),
  ('copilot',    'es', 'Copilot',   '', '', '', NULL, 'motor',  0),
  ('copilot',    'en', 'Copilot',   '', '', '', NULL, 'engine', 0)
ON CONFLICT (engine_id, lang) DO NOTHING;

-- Engine sparkline data (30-day window from 2026-03-29 → 2026-04-27)
DO $$
DECLARE
  base_date DATE := '2026-03-29';
  chatgpt_vals    INT[] := ARRAY[55,62,70,77,80,78,71,63,55,50,48,47,46,43,38,32,26,24,27,34,43,51,57,58,56,52,48,46,46,47];
  gemini_vals     INT[] := ARRAY[52,53,51,46,37,27,17,12,11,14,20,25,29,29,29,28,30,34,40,45,47,44,36,26,16,9,8,8,8,8];
  perplexity_vals INT[] := ARRAY[51,51,48,44,41,40,43,50,59,67,72,73,69,63,57,53,51,50,49,45,39,31,23,18,18,23,31,39,45,48];
  i INT;
BEGIN
  FOR i IN 1..30 LOOP
    INSERT INTO blog_engine_metrics_daily (engine_id, date, citations) VALUES
      ('chatgpt',    base_date + (i - 1), chatgpt_vals[i]),
      ('gemini',     base_date + (i - 1), gemini_vals[i]),
      ('perplexity', base_date + (i - 1), perplexity_vals[i])
    ON CONFLICT (engine_id, date) DO NOTHING;
  END LOOP;
END $$;

-- ─── Brands ─────────────────────────────────────────────────────────────────

INSERT INTO blog_brands (id, name, country, sector, labels) VALUES
  ('nubank',         'Nubank',        'BR',     'fintech',   '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  ('itau',           'Itaú',          'BR',     'bank',      '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('inter',          'Inter',         'BR',     'fintech',   '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  ('bradesco',       'Bradesco',      'BR',     'bank',      '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('c6-bank',        'C6 Bank',       'BR',     'fintech',   '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  ('santander-br',   'Santander',     'BR',     'bank',      '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('picpay',         'PicPay',        'BR',     'payments',  '{"pt":"Pagamentos","es":"Pagos","en":"Payments"}'::jsonb),
  ('btg-pactual',    'BTG Pactual',   'BR',     'bank',      '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('bbva',           'BBVA',          'ES',     'bank',      '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('santander-es',   'Santander',     'ES',     'bank',      '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('caixabank',      'CaixaBank',     'ES',     'bank',      '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('openbank',       'Openbank',      'ES',     'fintech',   '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  ('revolut',        'Revolut',       'ES',     'fintech',   '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  ('bankinter',      'Bankinter',     'ES',     'bank',      '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('sabadell',       'Sabadell',      'ES',     'bank',      '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('ing-es',         'ING España',    'ES',     'bank',      '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('natura',         'Natura',        'BR',     'cosmetics', '{"pt":"Cosméticos","es":"Cosméticos","en":"Cosmetics"}'::jsonb),
  ('magalu',         'Magalu',        'BR',     'retail',    '{"pt":"Varejo","es":"Retail","en":"Retail"}'::jsonb),
  ('el-corte-ingles','El Corte Inglés','ES',    'retail',    '{"pt":"Varejo","es":"Retail","en":"Retail"}'::jsonb),
  ('amazon',         'Amazon',        'GLOBAL', 'retail',    '{"pt":"Varejo","es":"Retail","en":"Retail"}'::jsonb),
  ('inditex',        'Inditex',       'ES',     'fashion',   '{"pt":"Moda","es":"Moda","en":"Fashion"}'::jsonb),
  ('mercado-livre',  'Mercado Livre', 'BR',     'retail',    '{"pt":"Varejo","es":"Retail","en":"Retail"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_sector_translations (sector, lang, label) VALUES
  ('fintech',   'pt', 'Fintech'),    ('fintech',   'es', 'Fintech'),    ('fintech',   'en', 'Fintech'),
  ('bank',      'pt', 'Banco'),      ('bank',      'es', 'Banco'),      ('bank',      'en', 'Bank'),
  ('payments',  'pt', 'Pagamentos'), ('payments',  'es', 'Pagos'),      ('payments',  'en', 'Payments'),
  ('cosmetics', 'pt', 'Cosméticos'), ('cosmetics', 'es', 'Cosméticos'), ('cosmetics', 'en', 'Cosmetics'),
  ('retail',    'pt', 'Varejo'),     ('retail',    'es', 'Retail'),     ('retail',    'en', 'Retail'),
  ('fashion',   'pt', 'Moda'),       ('fashion',   'es', 'Moda'),       ('fashion',   'en', 'Fashion')
ON CONFLICT (sector, lang) DO NOTHING;

-- ─── Articles (the one full article we have) ────────────────────────────────

INSERT INTO blog_articles (id, category_id, read_time_minutes, image_url, image_width, image_height, status, is_featured, published_at, modified_at) VALUES
  ('gen-search-traffic-war-2026', 'research', 12,
   'https://indexai.news/pt/nova-batalha-trafego-chatgpt-gemini-perplexity/opengraph-image',
   1200, 630, 'published', true, '2026-04-23T12:00:00Z', '2026-04-24T09:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_article_translations (article_id, lang, slug, title, dek, display_date, read_time_label, body, toc, ui, sidebar_cta, image_alt, meta_keywords) VALUES
  ('gen-search-traffic-war-2026', 'pt', 'nova-batalha-trafego-chatgpt-gemini-perplexity',
   'A nova batalha do tráfego: como ChatGPT, Gemini e Perplexity estão redistribuindo a autoridade de marca',
   'Análise inédita com 4,2 milhões de consultas em português e espanhol mostra que 68% das respostas geradas ignoram os 10 primeiros resultados do Google.',
   '23 de abril, 2026', '12 min',
   '[
     {"type":"p","text":"Durante vinte e cinco anos, dominar o Google significou dominar a internet. Em abril de 2026, essa equação silenciosamente deixou de valer. Nossa análise com 4,2 milhões de consultas conduzidas em ChatGPT, Gemini, Perplexity e Claude, entre janeiro e abril deste ano, mostra que 68% das respostas geradas em português e espanhol não incluem sequer uma citação dos dez primeiros resultados orgânicos do Google para a mesma consulta."},
     {"type":"p","text":"O dado sozinho já é perturbador. Ele fica mais sério quando colocado ao lado de outro: em 41% das respostas, o motor cita fontes que não aparecem nem nas cem primeiras posições da busca tradicional. Em outras palavras, o funil que as equipes de marketing otimizam há duas décadas está sendo contornado por um mecanismo de seleção completamente novo — um mecanismo que ninguém sabe exatamente como funciona."},
     {"type":"h2","text":"O novo funil"},
     {"type":"p","text":"Nos estudos que realizamos em conjunto com a Universidade de São Paulo e a IE Business School, em Madri, o comportamento é consistente: consumidores em mercados de língua portuguesa e espanhola estão adotando chatbots para decisões de alto envolvimento — escolha de banco, plano de saúde, universidade — com uma velocidade que supera a adoção de qualquer nova tecnologia de busca desde o próprio Google."},
     {"type":"blockquote","text":"\"O problema não é que o SEO morreu. O problema é que ele se tornou condição necessária, mas não suficiente. Existe um segundo funil agora, e ele não obedece às mesmas regras.\""},
     {"type":"h2","text":"Os dados"},
     {"type":"p","text":"Dividimos as 4,2 milhões de consultas em três categorias: informacionais (\"o que é marketing de conteúdo\"), comparativas (\"qual o melhor banco digital do Brasil\") e transacionais (\"como abrir conta no Nubank\"). A categoria que mais se desloca do Google é, surpreendentemente, a comparativa — exatamente o momento em que a decisão de compra é influenciada."},
     {"type":"h3","text":"Quem ganhou"},
     {"type":"p","text":"Marcas com presença forte em mídia especializada, papers acadêmicos e bases de dados estruturadas se beneficiaram desproporcionalmente. No Brasil, Nubank aparece em 61% das respostas relacionadas a \"conta digital\", enquanto seu principal competidor de base instalada, um banco tradicional, aparece em 23%."}
   ]'::jsonb,
   '["O novo funil","Os dados","Quem ganhou","Quem perdeu","O que fazer"]'::jsonb,
   '{"back":"← Voltar para Pesquisa","actions":{"save":"Salvar","share":"Compartilhar","listen":"Ouvir"},"sidebarTocTitle":"Índice","lastChecked":"Última verificação há 12 minutos · Atualiza a cada hora","history":"ver histórico →","reportingUpdate":"Seguir reportagem em desenvolvimento. Atualizaremos esta matéria conforme novos dados forem validados pela equipe.","citationLabel":"Rastreador de citação","citationTitle":"Esta matéria está sendo citada por","citationStatus":{"yes":"CITA","no":"NÃO CITA","partial":"PARCIAL"}}'::jsonb,
   '{"eyebrow":"Ainalytics","title":"Veja a visibilidade da sua marca em IA","text":"Relatório gratuito com as 5 primeiras consultas sobre seu nicho.","button":"Gerar relatório grátis →","buttonHref":"https://ainalytics.tech"}'::jsonb,
   'Index AI — 4.2M queries analyzed across ChatGPT, Gemini, Perplexity and Claude',
   '["Generative Engine Optimization","GEO","AI search","ChatGPT","Gemini","Perplexity","Claude","Grok","brand visibility","LATAM","EMEA"]'::jsonb),

  ('gen-search-traffic-war-2026', 'es', 'nueva-batalla-trafico-chatgpt-gemini-perplexity',
   'La nueva batalla del tráfico: cómo ChatGPT, Gemini y Perplexity redistribuyen la autoridad de marca',
   'Análisis inédito con 4,2 millones de consultas en portugués y español muestra que el 68% de las respuestas generadas ignoran los 10 primeros resultados de Google.',
   '23 de abril, 2026', '12 min',
   '[
     {"type":"p","text":"Durante veinticinco años, dominar Google significaba dominar internet. En abril de 2026, esa ecuación dejó de ser válida en silencio. Nuestro análisis de 4,2 millones de consultas realizadas en ChatGPT, Gemini, Perplexity y Claude, entre enero y abril de este año, muestra que el 68% de las respuestas generadas en portugués y español no incluyen ni una sola cita de los diez primeros resultados orgánicos de Google para la misma consulta."},
     {"type":"p","text":"El dato por sí solo ya es preocupante. Se vuelve más serio cuando se coloca junto a otro: en el 41% de las respuestas, el motor cita fuentes que no aparecen ni en las primeras cien posiciones de la búsqueda tradicional. En otras palabras, el embudo que los equipos de marketing optimizan desde hace dos décadas está siendo evitado por un mecanismo de selección completamente nuevo."},
     {"type":"h2","text":"El nuevo embudo"},
     {"type":"p","text":"En los estudios realizados con IE Business School, en Madrid, y con la Universidad de São Paulo, el comportamiento es consistente: los consumidores de mercados de habla portuguesa y española están adoptando chatbots para decisiones de alto compromiso —elección de banco, plan de salud, universidad— con una velocidad que supera la adopción de cualquier nueva tecnología de búsqueda desde el propio Google."},
     {"type":"blockquote","text":"\"El problema no es que el SEO haya muerto. El problema es que se ha convertido en condición necesaria, pero no suficiente. Existe un segundo embudo ahora, y no obedece las mismas reglas.\""},
     {"type":"h2","text":"Los datos"},
     {"type":"p","text":"Dividimos las 4,2 millones de consultas en tres categorías: informacionales, comparativas y transaccionales. La categoría que más se desplaza de Google es, sorprendentemente, la comparativa — exactamente el momento en que se decide la compra."},
     {"type":"h3","text":"Quién ganó"},
     {"type":"p","text":"Las marcas con presencia fuerte en medios especializados, papers académicos y bases de datos estructuradas se beneficiaron de forma desproporcionada."}
   ]'::jsonb,
   '["El nuevo embudo","Los datos","Quién ganó","Quién perdió","Qué hacer"]'::jsonb,
   '{"back":"← Volver a Investigación","actions":{"save":"Guardar","share":"Compartir","listen":"Escuchar"},"sidebarTocTitle":"Índice","lastChecked":"Última verificación hace 12 minutos · Se actualiza cada hora","history":"ver historial →","reportingUpdate":"Reportaje en desarrollo. Actualizaremos este artículo conforme se validen nuevos datos.","citationLabel":"Rastreador de citación","citationTitle":"Este artículo está siendo citado por","citationStatus":{"yes":"CITA","no":"NO CITA","partial":"PARCIAL"}}'::jsonb,
   '{"eyebrow":"Ainalytics","title":"Mira la visibilidad de tu marca en IA","text":"Informe gratuito con las 5 primeras consultas de tu nicho.","button":"Generar informe gratis →","buttonHref":"https://ainalytics.tech"}'::jsonb,
   'Index AI — 4.2M queries analyzed across ChatGPT, Gemini, Perplexity and Claude',
   '["Generative Engine Optimization","GEO","AI search","ChatGPT","Gemini","Perplexity","Claude","Grok","brand visibility","LATAM","EMEA"]'::jsonb),

  ('gen-search-traffic-war-2026', 'en', 'new-traffic-war-chatgpt-gemini-perplexity',
   'The new traffic war: how ChatGPT, Gemini and Perplexity are redistributing brand authority',
   'Unprecedented analysis of 4.2M queries in Portuguese and Spanish shows 68% of generated answers ignore Google''s top 10 results.',
   'April 23, 2026', '12 min',
   '[
     {"type":"p","text":"For twenty-five years, dominating Google meant dominating the internet. In April 2026, that equation quietly stopped holding. Our analysis of 4.2 million queries run through ChatGPT, Gemini, Perplexity and Claude between January and April of this year shows that 68% of answers generated in Portuguese and Spanish do not include a single citation from Google''s top ten organic results for the same query."},
     {"type":"p","text":"That number alone is unsettling. It gets more serious beside another one: in 41% of answers, the engine cites sources that do not appear even in the top one hundred positions of traditional search. In other words, the funnel that marketing teams have been optimizing for two decades is being bypassed by an entirely new selection mechanism — one nobody fully understands."},
     {"type":"h2","text":"The new funnel"},
     {"type":"p","text":"In studies we ran together with the University of São Paulo and IE Business School in Madrid, the behavior is consistent: consumers in Portuguese- and Spanish-speaking markets are adopting chatbots for high-consideration decisions — choosing a bank, a health plan, a university — faster than they adopted any new search technology since Google itself."},
     {"type":"blockquote","text":"\"The problem is not that SEO is dead. The problem is that it has become necessary but no longer sufficient. There is a second funnel now, and it does not follow the same rules.\""},
     {"type":"h2","text":"The data"},
     {"type":"p","text":"We split the 4.2M queries into three buckets: informational, comparative and transactional. The bucket that diverges most from Google is, surprisingly, comparative — exactly where buying decisions are made."},
     {"type":"h3","text":"Who won"},
     {"type":"p","text":"Brands with strong presence in specialist media, academic papers and structured databases benefited disproportionately."}
   ]'::jsonb,
   '["The new funnel","The data","Who won","Who lost","What to do"]'::jsonb,
   '{"back":"← Back to Research","actions":{"save":"Save","share":"Share","listen":"Listen"},"sidebarTocTitle":"Contents","lastChecked":"Last checked 12 minutes ago · Refreshes hourly","history":"view history →","reportingUpdate":"Developing story. We''ll update as new data is validated by the team.","citationLabel":"Citation tracker","citationTitle":"This story is being cited by","citationStatus":{"yes":"CITES","no":"NO CITE","partial":"PARTIAL"}}'::jsonb,
   '{"eyebrow":"Ainalytics","title":"See your brand''s AI visibility","text":"Free report with the first 5 queries in your niche.","button":"Generate free report →","buttonHref":"https://ainalytics.tech"}'::jsonb,
   'Index AI — 4.2M queries analyzed across ChatGPT, Gemini, Perplexity and Claude',
   '["Generative Engine Optimization","GEO","AI search","ChatGPT","Gemini","Perplexity","Claude","Grok","brand visibility","LATAM","EMEA"]'::jsonb)
ON CONFLICT (article_id, lang) DO NOTHING;

INSERT INTO blog_article_authors (article_id, author_id, position) VALUES
  ('gen-search-traffic-war-2026', 'mariana-duarte', 0)
ON CONFLICT (article_id, author_id) DO NOTHING;

INSERT INTO blog_article_tags (article_id, tag_id) VALUES
  ('gen-search-traffic-war-2026', 'research'),
  ('gen-search-traffic-war-2026', 'chatgpt'),
  ('gen-search-traffic-war-2026', 'gemini')
ON CONFLICT (article_id, tag_id) DO NOTHING;

INSERT INTO blog_article_keywords (article_id, keyword, position) VALUES
  ('gen-search-traffic-war-2026', 'Generative Engine Optimization', 0),
  ('gen-search-traffic-war-2026', 'GEO', 1),
  ('gen-search-traffic-war-2026', 'AI search', 2),
  ('gen-search-traffic-war-2026', 'ChatGPT', 3),
  ('gen-search-traffic-war-2026', 'Gemini', 4),
  ('gen-search-traffic-war-2026', 'Perplexity', 5),
  ('gen-search-traffic-war-2026', 'Claude', 6),
  ('gen-search-traffic-war-2026', 'Grok', 7),
  ('gen-search-traffic-war-2026', 'brand visibility', 8),
  ('gen-search-traffic-war-2026', 'LATAM', 9),
  ('gen-search-traffic-war-2026', 'EMEA', 10)
ON CONFLICT (article_id, keyword) DO NOTHING;

-- Citations
INSERT INTO blog_article_citations (article_id, engine_id, engine_name, engine_color, status, evidence_url, last_seen_at, last_checked_at, position) VALUES
  ('gen-search-traffic-war-2026', 'chatgpt',       'ChatGPT',       '#10A37F', 'yes',     NULL, '2026-04-27T10:55:12Z', '2026-04-27T11:00:00Z', 0),
  ('gen-search-traffic-war-2026', 'gemini-2-5',    'Gemini 2.5',    '#4285F4', 'yes',     NULL, '2026-04-27T10:42:08Z', '2026-04-27T11:00:00Z', 1),
  ('gen-search-traffic-war-2026', 'perplexity',    'Perplexity',    '#1FA8AC', 'yes',     NULL, '2026-04-27T10:48:31Z', '2026-04-27T11:00:00Z', 2),
  ('gen-search-traffic-war-2026', 'claude-sonnet', 'Claude Sonnet', '#CC785C', 'partial', NULL, '2026-04-27T09:21:55Z', '2026-04-27T11:00:00Z', 3),
  ('gen-search-traffic-war-2026', 'grok-3',        'Grok 3',        '#111111', 'no',      NULL, NULL,                   '2026-04-27T11:00:00Z', 4),
  ('gen-search-traffic-war-2026', 'copilot',       'Copilot',       '#0078D4', 'yes',     NULL, '2026-04-27T10:11:02Z', '2026-04-27T11:00:00Z', 5)
ON CONFLICT (article_id, engine_id) DO NOTHING;

-- ─── Ranking snapshots ──────────────────────────────────────────────────────

DO $$
DECLARE
  br_snapshot_id BIGINT;
  es_snapshot_id BIGINT;
BEGIN
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
    VALUES ('weekly','2026-04-20','2026-04-27','br','financial-services',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
    ON CONFLICT (period_from, region, sector) DO UPDATE SET updated_at = now()
    RETURNING id INTO br_snapshot_id;

  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
    VALUES ('weekly','2026-04-20','2026-04-27','es','financial-services',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
    ON CONFLICT (period_from, region, sector) DO UPDATE SET updated_at = now()
    RETURNING id INTO es_snapshot_id;

  -- BR ranking items
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (br_snapshot_id, 1, 'nubank',       94, '+6',  'up'),
    (br_snapshot_id, 2, 'itau',         87, '-2',  'down'),
    (br_snapshot_id, 3, 'inter',        82, '+11', 'up'),
    (br_snapshot_id, 4, 'bradesco',     76, '0',   'flat'),
    (br_snapshot_id, 5, 'c6-bank',      71, '+4',  'up'),
    (br_snapshot_id, 6, 'santander-br', 68, '-3',  'down'),
    (br_snapshot_id, 7, 'picpay',       64, '+2',  'up'),
    (br_snapshot_id, 8, 'btg-pactual',  59, '+1',  'up')
  ON CONFLICT (snapshot_id, rank) DO NOTHING;

  -- ES ranking items
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (es_snapshot_id, 1, 'bbva',         91, '+4', 'up'),
    (es_snapshot_id, 2, 'santander-es', 88, '+2', 'up'),
    (es_snapshot_id, 3, 'caixabank',    83, '-1', 'down'),
    (es_snapshot_id, 4, 'openbank',     77, '+9', 'up'),
    (es_snapshot_id, 5, 'revolut',      73, '+3', 'up'),
    (es_snapshot_id, 6, 'bankinter',    68, '0',  'flat'),
    (es_snapshot_id, 7, 'sabadell',     62, '-2', 'down'),
    (es_snapshot_id, 8, 'ing-es',       57, '+1', 'up')
  ON CONFLICT (snapshot_id, rank) DO NOTHING;
END $$;

-- Headlines (region+sector → localized table copy)
INSERT INTO blog_ranking_headlines (region, sector, lang, eyebrow, title, text, table_title, cta_label, region_label) VALUES
  ('br','financial-services','pt','Ranking semanal','Quem está dominando a IA esta semana','Índice Ainalytics de Visibilidade em IA (AVI) combina frequência de citação, posição média e sentimento em ChatGPT, Gemini, Claude, Perplexity e Grok. Atualizado toda segunda-feira.','Top 10 marcas · Brasil · Serviços financeiros','Ver relatório completo','Brasil'),
  ('br','financial-services','es','Ranking semanal','Quién está dominando la IA esta semana','El Índice Ainalytics de Visibilidad en IA (AVI) combina frecuencia de citación, posición media y sentimiento en ChatGPT, Gemini, Claude, Perplexity y Grok. Se actualiza cada lunes.','Top 10 marcas · Brasil · Servicios financieros','Ver informe completo','Brasil'),
  ('br','financial-services','en','Weekly ranking','Who''s dominating AI this week','The Ainalytics AI Visibility Index (AVI) blends citation frequency, average position and sentiment across ChatGPT, Gemini, Claude, Perplexity and Grok. Updated every Monday.','Top 10 brands · Brazil · Financial services','See full report','Brazil'),
  ('es','financial-services','pt','Ranking semanal','Quem está dominando a IA esta semana','Índice Ainalytics de Visibilidade em IA (AVI) combina frequência de citação, posição média e sentimento em ChatGPT, Gemini, Claude, Perplexity e Grok. Atualizado toda segunda-feira.','Top 10 marcas · Espanha · Serviços financeiros','Ver relatório completo','Espanha'),
  ('es','financial-services','es','Ranking semanal','Quién está dominando la IA esta semana','El Índice Ainalytics de Visibilidad en IA (AVI) combina frecuencia de citación, posición media y sentimiento en ChatGPT, Gemini, Claude, Perplexity y Grok. Se actualiza cada lunes.','Top 10 marcas · España · Servicios financieros','Ver informe completo','España'),
  ('es','financial-services','en','Weekly ranking','Who''s dominating AI this week','The Ainalytics AI Visibility Index (AVI) blends citation frequency, average position and sentiment across ChatGPT, Gemini, Claude, Perplexity and Grok. Updated every Monday.','Top 10 brands · Spain · Financial services','See full report','Spain')
ON CONFLICT (region, sector, lang) DO NOTHING;

-- ─── Ticker ─────────────────────────────────────────────────────────────────

INSERT INTO blog_ticker_items (lang, position, engine_id, label, value, trend, link_url, is_active) VALUES
  ('pt', 1, 'chatgpt',     'ChatGPT',     'Indexação 2x mais rápida',   'up',      NULL, true),
  ('pt', 2, 'gemini',      'Gemini',      'Nova política de citação',   'neutral', NULL, true),
  ('pt', 3, 'perplexity',  'Perplexity',  'Espaço para anúncios',       'up',      NULL, true),
  ('pt', 4, 'claude',      'Claude',      'Web search em GA',           'up',      NULL, true),
  ('pt', 5, 'ai-overviews','AI Overviews','-18% de cliques orgânicos',  'down',    NULL, true),
  ('pt', 6, 'grok',        'Grok',        'API pública aberta',         'up',      NULL, true),

  ('es', 1, 'chatgpt',     'ChatGPT',     'Indexación 2x más rápida',   'up',      NULL, true),
  ('es', 2, 'gemini',      'Gemini',      'Nueva política de citación', 'neutral', NULL, true),
  ('es', 3, 'perplexity',  'Perplexity',  'Espacio para anuncios',      'up',      NULL, true),
  ('es', 4, 'claude',      'Claude',      'Web search en GA',           'up',      NULL, true),
  ('es', 5, 'ai-overviews','AI Overviews','-18% clics orgánicos',       'down',    NULL, true),
  ('es', 6, 'grok',        'Grok',        'API pública abierta',        'up',      NULL, true),

  ('en', 1, 'chatgpt',     'ChatGPT',     '2x faster indexing',         'up',      NULL, true),
  ('en', 2, 'gemini',      'Gemini',      'New citation policy',        'neutral', NULL, true),
  ('en', 3, 'perplexity',  'Perplexity',  'Ad slots rolling out',       'up',      NULL, true),
  ('en', 4, 'claude',      'Claude',      'Web search goes GA',         'up',      NULL, true),
  ('en', 5, 'ai-overviews','AI Overviews','-18% organic clicks',        'down',    NULL, true),
  ('en', 6, 'grok',        'Grok',        'Public API open',            'up',      NULL, true)
ON CONFLICT (lang, position) DO NOTHING;

-- ─── Site strings ───────────────────────────────────────────────────────────

INSERT INTO blog_site_strings (lang, nav, header, footer, meta) VALUES
  ('pt',
    '{"home":"Início","news":"Notícias","engines":"Motores de IA","rankings":"Rankings","guides":"Guias GEO","research":"Pesquisa","events":"Eventos"}'::jsonb,
    '{"subscribe":"Assinar","login":"Entrar","platform":"Plataforma"}'::jsonb,
    '{"about":"Notícias independentes sobre o futuro da busca generativa. Uma publicação Ainalytics.","cols":{"content":{"title":"Conteúdo","items":["Últimas","Pesquisa","Rankings","Guias","Glossário"]},"engines":{"title":"Motores","items":["ChatGPT","Gemini","Claude","Perplexity","Grok"]},"tools":{"title":"Ferramentas","items":["Monitor de Marca","Simulador de Prompt","Relatório Semanal","API"]},"company":{"title":"Sobre","items":["Redação","Anuncie","Carreiras","Contato","Imprensa"]}},"copyright":"© 2026 Ainalytics · Index AI · indexai.news","legal":["Privacidade","Termos","Cookies"]}'::jsonb,
    '{"title":"Index AI — Notícias sobre Generative Engine Optimization","description":"Notícias independentes sobre o futuro da busca generativa. Uma publicação Ainalytics.","publisher":{"name":"Ainalytics","logo":{"url":"https://indexai.news/brand/logo.png","width":512,"height":512},"url":"https://indexai.news"}}'::jsonb),

  ('es',
    '{"home":"Inicio","news":"Noticias","engines":"Motores de IA","rankings":"Rankings","guides":"Guías GEO","research":"Investigación","events":"Eventos"}'::jsonb,
    '{"subscribe":"Suscribirse","login":"Entrar","platform":"Plataforma"}'::jsonb,
    '{"about":"Noticias independientes sobre el futuro de la búsqueda generativa. Una publicación Ainalytics.","cols":{"content":{"title":"Contenido","items":["Últimas","Investigación","Rankings","Guías","Glosario"]},"engines":{"title":"Motores","items":["ChatGPT","Gemini","Claude","Perplexity","Grok"]},"tools":{"title":"Herramientas","items":["Monitor de marca","Simulador de prompt","Informe semanal","API"]},"company":{"title":"Empresa","items":["Redacción","Publicidad","Empleo","Contacto","Prensa"]}},"copyright":"© 2026 Ainalytics · Index AI · indexai.news","legal":["Privacidad","Términos","Cookies"]}'::jsonb,
    '{"title":"Index AI — Notícias sobre Generative Engine Optimization","description":"Noticias independientes sobre el futuro de la búsqueda generativa. Una publicación Ainalytics.","publisher":{"name":"Ainalytics","logo":{"url":"https://indexai.news/brand/logo.png","width":512,"height":512},"url":"https://indexai.news"}}'::jsonb),

  ('en',
    '{"home":"Home","news":"News","engines":"AI Engines","rankings":"Rankings","guides":"GEO Guides","research":"Research","events":"Events"}'::jsonb,
    '{"subscribe":"Subscribe","login":"Sign in","platform":"Platform"}'::jsonb,
    '{"about":"Independent news on the future of generative search. An Ainalytics publication.","cols":{"content":{"title":"Content","items":["Latest","Research","Rankings","Guides","Glossary"]},"engines":{"title":"Engines","items":["ChatGPT","Gemini","Claude","Perplexity","Grok"]},"tools":{"title":"Tools","items":["Brand Monitor","Prompt Simulator","Weekly Report","API"]},"company":{"title":"Company","items":["Masthead","Advertise","Careers","Contact","Press"]}},"copyright":"© 2026 Ainalytics · Index AI · indexai.news","legal":["Privacy","Terms","Cookies"]}'::jsonb,
    '{"title":"Index AI — Notícias sobre Generative Engine Optimization","description":"Independent news on the future of generative search. An Ainalytics publication.","publisher":{"name":"Ainalytics","logo":{"url":"https://indexai.news/brand/logo.png","width":512,"height":512},"url":"https://indexai.news"}}'::jsonb)
ON CONFLICT (lang) DO NOTHING;

-- ─── Homepage components ────────────────────────────────────────────────────

INSERT INTO blog_homepage_hero (lang, primary_article_id, eyebrow, tags, display_date, title, dek, author_id, author_name, author_role) VALUES
  ('pt','gen-search-traffic-war-2026','Destaque · Atualização de 23/Abr','["Estudo Exclusivo","ChatGPT · Gemini · Perplexity"]'::jsonb,'23 de abril · 12 min de leitura','A nova batalha do tráfego: como ChatGPT, Gemini e Perplexity estão redistribuindo a autoridade de marca','Análise inédita com 4,2 milhões de consultas em português e espanhol mostra que 68% das respostas geradas ignoram os 10 primeiros resultados do Google. O que isso significa para o seu funil.','mariana-duarte','Mariana Duarte','Editora-chefe'),
  ('es','gen-search-traffic-war-2026','Destacado · Actualización 23/Abr','["Estudio Exclusivo","ChatGPT · Gemini · Perplexity"]'::jsonb,'23 de abril · 12 min de lectura','La nueva batalla del tráfico: cómo ChatGPT, Gemini y Perplexity redistribuyen la autoridad de marca','Análisis inédito con 4,2 millones de consultas en portugués y español muestra que el 68% de las respuestas generadas ignoran los 10 primeros resultados de Google. Qué significa para tu embudo.','mariana-duarte','Mariana Duarte','Editora jefe'),
  ('en','gen-search-traffic-war-2026','Featured · Updated Apr 23','["Exclusive study","ChatGPT · Gemini · Perplexity"]'::jsonb,'April 23 · 12 min read','The new traffic war: how ChatGPT, Gemini and Perplexity are redistributing brand authority','Unprecedented analysis of 4.2M queries in Portuguese and Spanish shows 68% of generated answers ignore Google''s top 10 results. What it means for your funnel.','mariana-duarte','Mariana Duarte','Editor-in-chief')
ON CONFLICT (lang) DO NOTHING;

INSERT INTO blog_homepage_sidebar_items (lang, position, title, engine_id, engine_label, time_label, link_kind, link_article_id, is_active) VALUES
  ('pt', 1, 'OpenAI lança "cite-back": marcas poderão contestar citações incorretas',  'chatgpt',    'ChatGPT',    'há 2h',   'article','gen-search-traffic-war-2026', true),
  ('pt', 2, 'Gemini 2.5 começa a priorizar conteúdo com autoria verificada no Brasil', 'gemini',     'Gemini',     'há 5h',   'article','gen-search-traffic-war-2026', true),
  ('pt', 3, 'E-commerce brasileiro: Magalu lidera citações em IA, Amazon cai 14%',     'multi',      'Multi',      'há 8h',   'article','gen-search-traffic-war-2026', true),
  ('pt', 4, 'Perplexity lança plano empresarial com dashboard de visibilidade',        'perplexity', 'Perplexity', 'ontem',   'article','gen-search-traffic-war-2026', true),

  ('es', 1, 'OpenAI lanza "cite-back": las marcas podrán impugnar citas incorrectas',   'chatgpt',    'ChatGPT',    'hace 2h', 'article','gen-search-traffic-war-2026', true),
  ('es', 2, 'Gemini 2.5 empieza a priorizar contenido con autoría verificada en España','gemini',     'Gemini',     'hace 5h', 'article','gen-search-traffic-war-2026', true),
  ('es', 3, 'E-commerce español: El Corte Inglés lidera, Amazon cae 14%',               'multi',      'Multi',      'hace 8h', 'article','gen-search-traffic-war-2026', true),
  ('es', 4, 'Perplexity lanza plan empresarial con panel de visibilidad',               'perplexity', 'Perplexity', 'ayer',    'article','gen-search-traffic-war-2026', true),

  ('en', 1, 'OpenAI launches "cite-back": brands can now contest incorrect citations', 'chatgpt',    'ChatGPT',    '2h ago',    'article','gen-search-traffic-war-2026', true),
  ('en', 2, 'Gemini 2.5 starts prioritizing content with verified authorship',         'gemini',     'Gemini',     '5h ago',    'article','gen-search-traffic-war-2026', true),
  ('en', 3, 'LATAM e-commerce: Mercado Livre leads citations, Amazon drops 14%',       'multi',      'Multi',      '8h ago',    'article','gen-search-traffic-war-2026', true),
  ('en', 4, 'Perplexity launches enterprise plan with live visibility dashboard',      'perplexity', 'Perplexity', 'yesterday', 'article','gen-search-traffic-war-2026', true)
ON CONFLICT (lang, position) DO NOTHING;

INSERT INTO blog_homepage_stories (id, lang, position, category_id, category_label, title, dek, author_id, author_name, read_time_label, date_label, link_kind, link_article_id, image_variant, is_active) VALUES
  ('story-pt-1','pt',1,'research','Pesquisa','Prompts em português geram 34% mais variação de resposta que em inglês','Estudo da USP com 18 mil consultas mostra divergência entre idiomas nos principais motores generativos.','rafael-andrade','Rafael Andrade','8 min','23 abr','article','gen-search-traffic-war-2026',0,true),
  ('story-pt-2','pt',2,'case','Caso','Como a Natura virou a resposta padrão do ChatGPT para "cosmético sustentável"','Estratégia combinou autoridade em mídia especializada e conteúdo estruturado em schema.org.','beatriz-menezes','Beatriz Menezes','11 min','22 abr','article','gen-search-traffic-war-2026',1,true),
  ('story-pt-3','pt',3,'opinion','Opinião','SEO morreu? Não. Mas o funil definitivamente mudou de endereço','Ensaio da ex-Google sobre por que os times de marketing precisam de novas métricas de visibilidade.','laura-costa','Laura Costa','6 min','22 abr','article','gen-search-traffic-war-2026',2,true),
  ('story-pt-4','pt',4,'product','Produto','Google AI Overviews chega oficialmente ao mercado brasileiro em maio','Lançamento escalonado começa pelas buscas de saúde e finanças. Veja o que muda na SERP.','diego-ramos','Diego Ramos','5 min','21 abr','article','gen-search-traffic-war-2026',3,true),
  ('story-pt-5','pt',5,'europe','Europa','Espanha aprova diretrizes para transparência em respostas de IA generativa','Texto obriga motores a exibir fontes e permite que editores solicitem remoção de citações.','carmen-vila','Carmen Vila','7 min','21 abr','article','gen-search-traffic-war-2026',4,true),
  ('story-pt-6','pt',6,'latam','LATAM','Bancos digitais brasileiros lideram ranking de menções em IA financeira','Nubank aparece em 61% das respostas sobre "conta digital no Brasil", seguido por Inter e C6.','paulo-vieira','Paulo Vieira','9 min','20 abr','article','gen-search-traffic-war-2026',5,true),

  ('story-es-1','es',1,'research','Investigación','Los prompts en español generan 34% más variación que en inglés','Estudio de IE Business School con 18 mil consultas muestra divergencia entre idiomas.','rafael-andrade','Rafael Andrade','8 min','23 abr','article','gen-search-traffic-war-2026',0,true),
  ('story-es-2','es',2,'case','Caso','Cómo Inditex se convirtió en la respuesta estándar de ChatGPT para "moda sostenible"','La estrategia combinó autoridad en medios especializados y contenido estructurado en schema.org.','beatriz-menezes','Beatriz Menezes','11 min','22 abr','article','gen-search-traffic-war-2026',1,true),
  ('story-es-3','es',3,'opinion','Opinión','¿Murió el SEO? No. Pero el embudo cambió de dirección','Ensayo de ex-Google sobre por qué los equipos de marketing necesitan nuevas métricas.','laura-costa','Laura Costa','6 min','22 abr','article','gen-search-traffic-war-2026',2,true),
  ('story-es-4','es',4,'product','Producto','Google AI Overviews llega oficialmente a España en mayo','Lanzamiento escalonado comienza con búsquedas de salud y finanzas.','diego-ramos','Diego Ramos','5 min','21 abr','article','gen-search-traffic-war-2026',3,true),
  ('story-es-5','es',5,'europe','Europa','España aprueba directrices de transparencia para respuestas de IA generativa','El texto obliga a los motores a mostrar fuentes y permite retirar citas.','carmen-vila','Carmen Vila','7 min','21 abr','article','gen-search-traffic-war-2026',4,true),
  ('story-es-6','es',6,'latam','LATAM','Los bancos digitales brasileños lideran el ranking de menciones en IA financiera','Nubank aparece en el 61% de las respuestas sobre "cuenta digital en Brasil".','paulo-vieira','Paulo Vieira','9 min','20 abr','article','gen-search-traffic-war-2026',5,true),

  ('story-en-1','en',1,'research','Research','Portuguese prompts yield 34% more response variance than English','Study of 18,000 queries shows divergence between languages across major generative engines.','rafael-andrade','Rafael Andrade','8 min','Apr 23','article','gen-search-traffic-war-2026',0,true),
  ('story-en-2','en',2,'case','Case','How Natura became ChatGPT''s default answer for "sustainable cosmetics"','Strategy blended authority in specialist media with structured schema.org content.','beatriz-menezes','Beatriz Menezes','11 min','Apr 22','article','gen-search-traffic-war-2026',1,true),
  ('story-en-3','en',3,'opinion','Opinion','Is SEO dead? No. But the funnel has definitely moved','Former Google lead on why marketing teams need entirely new visibility metrics.','laura-costa','Laura Costa','6 min','Apr 22','article','gen-search-traffic-war-2026',2,true),
  ('story-en-4','en',4,'product','Product','Google AI Overviews officially arrives in Brazil and Spain in May','Staged rollout starts with health and finance queries. Here''s what changes on the SERP.','diego-ramos','Diego Ramos','5 min','Apr 21','article','gen-search-traffic-war-2026',3,true),
  ('story-en-5','en',5,'europe','Europe','Spain approves transparency guidelines for generative AI answers','Law requires engines to display sources and lets publishers request citation removal.','carmen-vila','Carmen Vila','7 min','Apr 21','article','gen-search-traffic-war-2026',4,true),
  ('story-en-6','en',6,'latam','LATAM','Brazilian digital banks top the financial AI mentions ranking','Nubank appears in 61% of answers about "digital account in Brazil", followed by Inter and C6.','paulo-vieira','Paulo Vieira','9 min','Apr 20','article','gen-search-traffic-war-2026',5,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_homepage_latest (lang, title, title_em, filters, sidebar_title, sidebar_all, report_cta_label) VALUES
  ('pt', 'Últimas',  'notícias', '["Tudo","Pesquisa","Produto","Caso","Opinião","LATAM","Europa"]'::jsonb,            'Em alta agora',     'Ver todas →', 'Ver relatório completo'),
  ('es', 'Últimas',  'noticias', '["Todo","Investigación","Producto","Caso","Opinión","LATAM","Europa"]'::jsonb,    'Lo más comentado',  'Ver todas →', 'Ver informe completo'),
  ('en', 'Latest',   'news',     '["All","Research","Product","Case","Opinion","LATAM","Europe"]'::jsonb,           'Trending now',      'See all →',   'See full report')
ON CONFLICT (lang) DO NOTHING;

INSERT INTO blog_homepage_cta (lang, eyebrow, title, title_em, text, placeholder, button, submit_to, quotes) VALUES
  ('pt','Powered by Ainalytics','Saiba o que a IA diz sobre a sua marca','antes do seu concorrente','Monitore em tempo real como ChatGPT, Gemini, Perplexity e Grok mencionam — ou omitem — sua marca. Teste grátis por 14 dias.','seu@email.com','Começar grátis','POST /api/v1/newsletter/subscribe',
    '[{"engineId":"chatgpt","label":"ChatGPT · 23 abr","text":"\"Para bancos digitais no Brasil, Nubank continua sendo a referência...\""},{"engineId":"gemini","label":"Gemini · 23 abr","text":"\"Entre fintechs brasileiras, destacam-se três opções principais...\""},{"engineId":"perplexity","label":"Perplexity · 23 abr","text":"\"According to recent reports, Brazilian neobanks lead LATAM in adoption...\""}]'::jsonb),
  ('es','Powered by Ainalytics','Descubre qué dice la IA sobre tu marca','antes que tu competencia','Monitoriza en tiempo real cómo ChatGPT, Gemini, Perplexity y Grok mencionan —u omiten— tu marca. 14 días gratis.','tu@email.com','Empezar gratis','POST /api/v1/newsletter/subscribe',
    '[{"engineId":"chatgpt","label":"ChatGPT · 23 abr","text":"\"Para banca digital en España, BBVA sigue siendo la referencia...\""},{"engineId":"gemini","label":"Gemini · 23 abr","text":"\"Entre los neobancos españoles, destacan tres opciones principales...\""},{"engineId":"perplexity","label":"Perplexity · 23 abr","text":"\"According to recent reports, Spanish digital banks lead EU adoption...\""}]'::jsonb),
  ('en','Powered by Ainalytics','See what AI says about your brand','before your competitor does','Track in real time how ChatGPT, Gemini, Perplexity and Grok mention — or omit — your brand. 14-day free trial.','you@email.com','Start free','POST /api/v1/newsletter/subscribe',
    '[{"engineId":"chatgpt","label":"ChatGPT · Apr 23","text":"\"For Brazilian digital banks, Nubank remains the benchmark...\""},{"engineId":"gemini","label":"Gemini · Apr 23","text":"\"Among Brazilian fintechs, three options stand out...\""},{"engineId":"perplexity","label":"Perplexity · Apr 23","text":"\"According to recent reports, Brazilian neobanks lead LATAM in adoption...\""}]'::jsonb)
ON CONFLICT (lang) DO NOTHING;
