/**
 * Reference JSON templates for the SA blog admin.
 *
 * Every SA page exposes a "Download template" button that emits the matching
 * file from this module. The shapes mirror the payloads accepted by the
 * `blog-admin` Edge Function — paste the file back through the matching page
 * to import data.
 *
 * The News page additionally accepts these files via "Import" — see
 * BlogNewsPage.tsx.
 */

// ─── News ───────────────────────────────────────────────────────────────────

export const NEWS_TEMPLATE = {
  /**
   * `articles[].translations.<lang>.body` accepts either of two shapes:
   *
   *   1. **HTML string** (canonical, written by the rich-text editor):
   *        body: "<p>...</p><h2>...</h2><blockquote>...</blockquote>"
   *
   *   2. **Legacy block array** (still accepted by import — auto-converted
   *      to HTML server-side):
   *        body: [
   *          { "type": "p",          "text": "..." },
   *          { "type": "h2",         "text": "..." },
   *          { "type": "h3",         "text": "..." },
   *          { "type": "blockquote", "text": "..." }
   *        ]
   *
   * The example below shows HTML for `pt`/`es` and the legacy block array
   * for `en` so you can see both in one file.
   */
  articles: [
    {
      article: {
        id: "example-news-2026",
        category_id: "research",
        read_time_minutes: 8,
        image_url: "https://indexai.news/example/cover.jpg",
        image_width: 1200,
        image_height: 630,
        status: "draft",
        is_featured: false,
        trending_position: null,
        published_at: "2026-04-28T12:00:00Z",
      },
      translations: {
        pt: {
          slug: "exemplo-de-noticia-2026",
          title: "Exemplo de matéria — substitua pelo título real",
          dek: "Subtítulo (dek) em português que resume a matéria em uma frase clara.",
          display_date: "28 de abril, 2026",
          read_time_label: "8 min",
          // HTML string (canonical shape — what the editor produces)
          body: [
            "<p>Primeiro parágrafo da matéria com <strong>texto em destaque</strong>.</p>",
            "<h2>Subseção em destaque</h2>",
            "<p>Mais conteúdo, dados e análise. Inclua <a href=\"https://exemplo.com\">links relevantes</a>.</p>",
            "<blockquote>Citação textual relevante.</blockquote>",
            "<ul><li>Bullet 1</li><li>Bullet 2</li></ul>",
          ].join("\n"),
          toc: ["Subseção em destaque"],
          image_alt: "Texto alternativo descrevendo a imagem",
          meta_keywords: ["GEO", "AI search", "ChatGPT"],
        },
        es: {
          slug: "ejemplo-de-noticia-2026",
          title: "Ejemplo de noticia — sustituya por el título real",
          dek: "Subtítulo (dek) en español que resume la nota en una frase clara.",
          display_date: "28 de abril, 2026",
          read_time_label: "8 min",
          body: [
            "<p>Primer párrafo de la noticia con <strong>texto destacado</strong>.</p>",
            "<h2>Subsección destacada</h2>",
            "<p>Más contenido, datos y análisis.</p>",
            "<blockquote>Cita textual relevante.</blockquote>",
          ].join("\n"),
          toc: ["Subsección destacada"],
          image_alt: "Texto alternativo describiendo la imagen",
          meta_keywords: ["GEO", "AI search", "ChatGPT"],
        },
        en: {
          slug: "example-news-2026",
          title: "Example article — replace with the real headline",
          dek: "Sub-headline (dek) in English summarizing the story in one clear sentence.",
          display_date: "April 28, 2026",
          read_time_label: "8 min",
          // Legacy block-array shape — still accepted by import; auto-converted to HTML.
          body: [
            { type: "p",          text: "Opening paragraph of the article." },
            { type: "h2",         text: "Highlighted subsection" },
            { type: "p",          text: "More content, data and analysis." },
            { type: "blockquote", text: "Pull quote that drives the point home." },
          ],
          toc: ["Highlighted subsection"],
          image_alt: "Alt text describing the image",
          meta_keywords: ["GEO", "AI search", "ChatGPT"],
        },
      },
      authors: [
        { author_id: "mariana-duarte", position: 0 },
      ],
      tags: ["chatgpt", "research"],
      keywords: ["GEO", "AI search", "ChatGPT", "brand visibility", "LATAM"],
      sources: [
        { name: "Universidade de São Paulo", url: "https://www5.usp.br/" },
        { name: "IE Business School",        url: "https://www.ie.edu/business-school/" },
      ],
    },
  ],
};

// ─── Categories ─────────────────────────────────────────────────────────────

export const CATEGORIES_TEMPLATE = {
  categories: [
    {
      category: { id: "example-category", position: 7, is_active: true },
      translations: {
        pt: { slug: "exemplo-categoria", label: "Exemplo",  description: "Descrição em português.", seo_title: "Exemplo — descrição SEO", segment: "categoria" },
        es: { slug: "ejemplo-categoria", label: "Ejemplo",  description: "Descripción en español.", seo_title: "Ejemplo — descripción SEO", segment: "categoria" },
        en: { slug: "example-category",  label: "Example",  description: "English description.",    seo_title: "Example — SEO description",  segment: "category"  },
      },
    },
  ],
};

// ─── Tags ───────────────────────────────────────────────────────────────────

export const TAGS_TEMPLATE = {
  tags: [
    {
      tag: { id: "example-tag", is_engine: false },
      translations: {
        pt: { slug: "exemplo-tag", label: "Exemplo Tag" },
        es: { slug: "ejemplo-tag", label: "Ejemplo Tag" },
        en: { slug: "example-tag", label: "Example Tag" },
      },
    },
  ],
};

// ─── Authors ────────────────────────────────────────────────────────────────

export const AUTHORS_TEMPLATE = {
  authors: [
    {
      author: {
        id: "example-author",
        email: "author@indexai.news",
        image_url: "https://indexai.news/authors/example.jpg",
        social: {
          x: "https://x.com/example",
          linkedin: "https://www.linkedin.com/in/example",
          email: "author@indexai.news",
        },
      },
      translations: {
        pt: { name: "Nome do Autor",  role: "Cargo · Equipe",            bio: "Biografia em português." },
        es: { name: "Nombre del Autor", role: "Cargo · Equipo",          bio: "Biografía en español." },
        en: { name: "Author Name",    role: "Role · Team",               bio: "Bio in English." },
      },
    },
  ],
};

// ─── Brands ─────────────────────────────────────────────────────────────────

export const BRANDS_TEMPLATE = {
  brands: [
    {
      id: "example-brand",
      name: "Example Brand",
      country: "US",
      sector: "technology",
      subsector_id: "ai-platforms",
      homepage_domain: "example.com",
      entity_type: "company",
      labels: { pt: "Tecnologia", es: "Tecnología", en: "Technology" },
    },
    {
      id: "another-brand-br",
      name: "Marca Brasileira",
      country: "BR",
      sector: "financial-services",
      subsector_id: "fintech-neobanks",
      homepage_domain: "marca.com.br",
      entity_type: "company",
      labels: { pt: "Fintech", es: "Fintech", en: "Fintech" },
    },
  ],
};

// ─── Ticker ─────────────────────────────────────────────────────────────────

export const TICKER_TEMPLATE = {
  ticker: [
    {
      lang: "pt",
      position: 7,
      engine_id: "chatgpt",
      label: "ChatGPT",
      value: "Texto curto do sinal",
      trend: "up",
      link_url: null,
      is_active: true,
    },
    {
      lang: "en",
      position: 7,
      engine_id: "chatgpt",
      label: "ChatGPT",
      value: "Short signal text",
      trend: "up",
      link_url: null,
      is_active: true,
    },
  ],
};

// ─── Rankings ───────────────────────────────────────────────────────────────

export const RANKINGS_TEMPLATE = {
  snapshots: [
    {
      period_label: "weekly",
      period_from: "2026-04-21",
      period_to: "2026-04-28",
      region: "us",
      sector: "technology",
      queries_analyzed: 4200000,
      sectors_covered: 127,
      engines_monitored: ["chatgpt", "gemini", "claude", "perplexity", "grok"],
      items: [
        { rank: 1, brandId: "openai",        score: 98, delta: "+1", direction: "up"   },
        { rank: 2, brandId: "google-ai",     score: 94, delta: "0",  direction: "flat" },
        { rank: 3, brandId: "anthropic",     score: 92, delta: "+3", direction: "up"   },
      ],
    },
  ],
};

// ─── Ranking FAQ ────────────────────────────────────────────────────────────

export const RANKING_FAQ_TEMPLATE = {
  faq: [
    {
      lang: "pt",
      region: null,
      sector: null,
      position: 1,
      question: "O que é o Índice Ainalytics de Visibilidade em IA (AVI)?",
      answer: "O AVI é a medida semanal de quão frequentemente uma marca aparece — e em qual posição — nas respostas geradas pelos principais motores generativos.",
    },
    {
      lang: "en",
      region: "us",
      sector: "financial-services",
      position: 1,
      question: "What is the AVI for US Financial Services?",
      answer: "Region- and sector-specific FAQ overrides the global one. Use NULL region/sector for the default fallback FAQ.",
    },
  ],
};

// ─── Locale meta ────────────────────────────────────────────────────────────

export const LOCALE_META_TEMPLATE = {
  locale_meta: [
    {
      lang: "pt",
      site_title: "Index AI — Notícias sobre Generative Engine Optimization",
      site_description: "Notícias independentes sobre o futuro da busca generativa.",
      site_keywords: ["GEO", "ChatGPT", "Gemini", "Perplexity"],
      default_og_image_url: "https://indexai.news/brand/og-default.png",
      publisher_name: "Ainalytics",
      publisher_url: "https://indexai.news",
      publisher_logo_url: "https://indexai.news/brand/logo",
      publisher_logo_width: 512,
      publisher_logo_height: 512,
      twitter_handle: "@indexai",
      trending_eyebrow: "Destaques",
      trending_title: "Em alta no Index AI",
      trending_description: "As reportagens mais lidas sobre busca generativa.",
      newsletter_eyebrow: "Powered by Ainalytics",
      newsletter_title: "Saiba o que a IA diz sobre a sua marca",
      newsletter_text: "Monitore como ChatGPT, Gemini, Perplexity e Grok mencionam sua marca.",
      newsletter_placeholder: "seu@email.com",
      newsletter_button: "Começar grátis",
      newsletter_success_message: "Pronto! Em breve você receberá nossa primeira edição.",
      rankings_title: "Ranking de Visibilidade em IA (AVI)",
      rankings_description: "O Índice Ainalytics combina frequência de citação, posição média e sentimento.",
      categories_title: "Categorias",
      categories_description: "Pesquisa, produto, casos, opinião, LATAM e Europa.",
      category_segment: "categoria",
    },
  ],
};

// ─── Trending positions ─────────────────────────────────────────────────────

export const TRENDING_TEMPLATE = {
  trending: [
    { article_id: "gen-search-traffic-war-2026", trending_position: 1 },
    { article_id: "another-published-article",   trending_position: 2 },
  ],
};

// ─── Newsletter subscribers ────────────────────────────────────────────────

export const NEWSLETTER_TEMPLATE = {
  subscribers: [
    {
      email: "user@example.com",
      lang: "pt",
      topics: ["chatgpt", "gemini"],
      source: "manual_import",
      status: "active",
    },
  ],
};
