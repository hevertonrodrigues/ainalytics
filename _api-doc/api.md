# Index AI — API Specification

This document is the API contract between the Index AI website (Next.js
frontend, prerendered + SSR) and its backend services. It covers every
endpoint required to serve the public site end-to-end, including the ones
already implemented in this repository and the ones still needed before the
site can be fully data-driven.

- **API base:** `https://indexai.news/api/v1`
- **Versioning:** URL-versioned. Breaking changes ship under `/api/v2`.
- **Status legend:**
  - ✅ Implemented in this repo
  - 🟡 Partial — data exists in `lib/i18n.ts` but is delivered inside a
    parent payload; should be split into its own endpoint
  - 🔮 Future — required by UI elements that are referenced but not yet
    backed by an API

---

## Conventions

### Locales

Every translated resource is locale-prefixed via a `[lang]` path segment.
Supported values:

| `lang` | BCP-47 (`Content-Language`) | Region default |
| ------ | ---------------------------- | -------------- |
| `pt`   | `pt-BR`                      | Brazil         |
| `es`   | `es-ES`                      | Spain          |
| `en`   | `en-US`                      | Global         |

The default locale is `pt`. Browser negotiation happens at the proxy layer
(`proxy.ts`) using `Accept-Language` and a `pref_lang` cookie. **API clients
must pass `lang` explicitly** — never rely on cookie state.

### Authentication

| Endpoint class                                        | Auth                              |
| ----------------------------------------------------- | --------------------------------- |
| Public read (homepage, article, category, etc.)       | None                              |
| Newsletter subscribe / share tracking                 | None (rate-limited per IP)        |
| User-state (bookmarks, profile, history)              | `Authorization: Bearer <jwt>`     |
| Editorial / admin                                     | Out of scope (separate admin API) |

JWT shape:

```json
{
  "sub": "user_01J9R8...",
  "email": "you@example.com",
  "lang": "pt",
  "iat": 1745000000,
  "exp": 1745086400,
  "scope": ["read:bookmarks", "write:bookmarks"]
}
```

### Caching & validation

Public GETs return:

- `Cache-Control: public, s-maxage=<n>, stale-while-revalidate=<m>`
- `ETag: "<weak-hash>"` — supports `If-None-Match` → `304 Not Modified`
- `Last-Modified: <RFC1123>` — supports `If-Modified-Since`

Recommended `s-maxage` defaults:

| Resource                            | s-maxage | swr      |
| ----------------------------------- | -------- | -------- |
| Article detail                      | `3600`   | `86400`  |
| Article list / category list        | `300`    | `86400`  |
| Homepage payload                    | `300`    | `86400`  |
| Rankings / engines / sparklines     | `300`    | `86400`  |
| Ticker                              | `60`     | `300`    |
| Static taxonomy (categories, tags)  | `3600`   | `604800` |
| Search                              | `0`      | `60`     |

### Localization headers

Every localized response sets:

- `Content-Language: <bcp47>`
- `Link: <canonical_url>; rel="canonical"`
- One `Link: <alt_url>; rel="alternate"; hreflang="<bcp47>"` per supported
  locale, plus one with `hreflang="x-default"` pointing at the default-locale
  URL.

### Pagination

Cursor-based. Query params on any list endpoint:

| Param    | Type   | Default | Notes                      |
| -------- | ------ | ------- | -------------------------- |
| `limit`  | int    | `20`    | Max `50`                   |
| `cursor` | string | `null`  | Opaque, from previous page |

Response wrapper:

```json
{
  "items": [ /* ... */ ],
  "page": {
    "limit": 20,
    "cursor": null,
    "nextCursor": "eyJvIjoxMjAsImlkIjoiZ2VuLXNlYXJjaC0uLi4ifQ",
    "totalEstimate": 137
  }
}
```

`nextCursor: null` indicates the last page. `totalEstimate` is best-effort —
clients must not depend on it being exact.

### Filtering & sorting

Common list-endpoint query params:

| Param       | Type     | Example               | Notes                                                |
| ----------- | -------- | --------------------- | ---------------------------------------------------- |
| `category`  | string   | `research`            | Stable category id                                   |
| `tag`       | string   | `chatgpt`             | Tag slug                                             |
| `author`    | string   | `mariana-duarte`      | Author slug                                          |
| `engine`    | string   | `chatgpt`             | Engine id                                            |
| `from`      | ISO date | `2026-04-01`          | `publishedAt >=`                                     |
| `to`        | ISO date | `2026-04-30`          | `publishedAt <=`                                     |
| `sort`      | string   | `publishedAt:desc`    | Allowed: `publishedAt:asc/desc`, `popular`, `trending` |
| `q`         | string   | `geo+seo`             | Free-text (where supported)                          |

Multiple values use comma separators: `?engine=chatgpt,gemini`.

### Error envelope

```json
{
  "error": "snake_case_code",
  "message": "Human-readable description",
  "details": { "field": "lang", "supported": ["pt", "es", "en"] }
}
```

| Status | When                                                |
| ------ | --------------------------------------------------- |
| `400`  | Malformed request (bad query string, JSON parse)    |
| `401`  | Missing / invalid bearer token                      |
| `403`  | Authenticated but insufficient scope                |
| `404`  | Resource not found                                  |
| `410`  | Resource was retracted / unpublished                |
| `422`  | Validation failure on body fields                   |
| `429`  | Rate limit hit; `Retry-After` header                |
| `500`  | Server error                                        |
| `503`  | Upstream dependency down (e.g. citation tracker)    |

### Rate limits

Default per IP for public endpoints: `120 req/min`. Newsletter and engagement
endpoints: `10 req/min`. All limited responses include:

- `RateLimit-Limit: 120`
- `RateLimit-Remaining: 0`
- `RateLimit-Reset: 30`

### CORS

Public endpoints respond with `Access-Control-Allow-Origin: *`. Engagement
and auth endpoints whitelist the website origins explicitly:
`https://indexai.news`, `https://www.indexai.news`, and preview deployments
matching `https://*.vercel.app`.

---

## 1. Site shell

Currently the site shell (nav, ticker, footer, header) is delivered inside
the homepage and article payloads. Splitting it into its own endpoint allows
clients (mobile apps, partners) to fetch the chrome once and cache it
independently from content.

### `GET /api/v1/site/[lang]`  🔮

Returns site-wide chrome content in the requested locale.

**Path params**

| Name   | Type | Required | Notes      |
| ------ | ---- | -------- | ---------- |
| `lang` | enum | yes      | `pt|es|en` |

**Response 200**

```json
{
  "lang": "pt",
  "locale": "pt-BR",
  "nav": {
    "home": "Início",
    "news": "Notícias",
    "engines": "Motores de IA",
    "rankings": "Rankings",
    "guides": "Guias GEO",
    "research": "Pesquisa",
    "events": "Eventos"
  },
  "header": {
    "subscribe": "Assinar",
    "login": "Entrar",
    "platform": "Plataforma"
  },
  "footer": {
    "about": "Notícias independentes sobre o futuro da busca generativa.",
    "cols": {
      "content": { "title": "Conteúdo", "items": ["Últimas", "Pesquisa", "Rankings"] },
      "engines": { "title": "Motores", "items": ["ChatGPT", "Gemini"] },
      "tools":   { "title": "Ferramentas", "items": ["Monitor de Marca"] },
      "company": { "title": "Sobre", "items": ["Redação", "Anuncie"] }
    },
    "copyright": "© 2026 Ainalytics · Index AI · indexai.news",
    "legal": ["Privacidade", "Termos", "Cookies"]
  },
  "languages": [
    { "lang": "pt", "locale": "pt-BR", "label": "Português" },
    { "lang": "es", "locale": "es-ES", "label": "Español" },
    { "lang": "en", "locale": "en-US", "label": "English" }
  ]
}
```

**Status codes:** `200`, `404` (unsupported lang)

---

## 2. Homepage

### `GET /api/v1/homepage/[lang]`  ✅

Returns the entire homepage payload (chrome content + hero + sidebar +
latest stories + rankings + engines + CTA + footer).

**Path params**

| Name   | Type | Required | Notes      |
| ------ | ---- | -------- | ---------- |
| `lang` | enum | yes      | `pt|es|en` |

**Response 200**

```json
{
  "meta": {
    "lang": "pt",
    "locale": "pt-BR",
    "title": "Index AI — Notícias sobre Generative Engine Optimization",
    "description": "Notícias independentes sobre o futuro da busca generativa.",
    "canonicalPath": "/pt",
    "canonicalUrl": "https://indexai.news/pt",
    "alternates": {
      "pt": { "path": "/pt", "url": "https://indexai.news/pt", "locale": "pt-BR" },
      "es": { "path": "/es", "url": "https://indexai.news/es", "locale": "es-ES" },
      "en": { "path": "/en", "url": "https://indexai.news/en", "locale": "en-US" }
    },
    "publisher": {
      "name": "Ainalytics",
      "logo": { "url": "https://...", "width": 512, "height": 512 },
      "url": "https://indexai.news"
    },
    "lastModified": "2026-04-26T00:00:00.000Z"
  },
  "content": { /* full Dict — see Type Reference */ }
}
```

**Status codes:** `200`, `404` (unsupported lang)
**Cache:** `s-maxage=300, stale-while-revalidate=86400`

---

## 3. Articles

### `GET /api/v1/articles/[lang]`  ✅

Lists articles in a locale, newest first. Supports filtering and
pagination.

**Path params**

| Name   | Type | Required | Notes      |
| ------ | ---- | -------- | ---------- |
| `lang` | enum | yes      | `pt|es|en` |

**Query params**

| Name       | Type    | Default              | Notes                         |
| ---------- | ------- | -------------------- | ----------------------------- |
| `limit`    | int     | `20` (max `50`)      | Page size                     |
| `cursor`   | string  | —                    | Pagination cursor             |
| `category` | string  | —                    | Stable category id            |
| `tag`      | string  | —                    | Tag slug                      |
| `author`   | string  | —                    | Author slug                   |
| `engine`   | string  | —                    | Engine id                     |
| `from`     | date    | —                    | ISO `YYYY-MM-DD`              |
| `to`       | date    | —                    | ISO `YYYY-MM-DD`              |
| `sort`     | enum    | `publishedAt:desc`   | `publishedAt:asc`, `popular`  |

**Response 200**

```json
{
  "lang": "pt",
  "locale": "pt-BR",
  "items": [
    {
      "id": "gen-search-traffic-war-2026",
      "slug": "nova-batalha-trafego-chatgpt-gemini-perplexity",
      "title": "A nova batalha do tráfego: ...",
      "dek": "Análise inédita com 4,2 milhões de consultas ...",
      "section": "Research",
      "authors": [{ "name": "Mariana Duarte" }],
      "publishedAt": "2026-04-23T12:00:00.000Z",
      "modifiedAt": "2026-04-24T09:00:00.000Z",
      "readTimeMinutes": 12,
      "canonicalPath": "/pt/nova-batalha-trafego-chatgpt-gemini-perplexity",
      "canonicalUrl": "https://indexai.news/pt/nova-batalha-trafego-chatgpt-gemini-perplexity"
    }
  ],
  "page": { "limit": 20, "cursor": null, "nextCursor": null, "totalEstimate": 1 }
}
```

**Status codes:** `200`, `400` (bad filters), `404` (unsupported lang)
**Cache:** `s-maxage=300, stale-while-revalidate=86400`

---

### `GET /api/v1/articles/[lang]/[slug]`  ✅

Returns a single article by its localized slug.

**Path params**

| Name   | Type   | Required | Notes                                |
| ------ | ------ | -------- | ------------------------------------ |
| `lang` | enum   | yes      | `pt|es|en`                           |
| `slug` | string | yes      | Localized slug from the same locale  |

**Response 200**

```json
{
  "meta": {
    "id": "gen-search-traffic-war-2026",
    "slug": "nova-batalha-trafego-chatgpt-gemini-perplexity",
    "lang": "pt",
    "locale": "pt-BR",
    "title": "A nova batalha do tráfego: ...",
    "description": "Análise inédita ...",
    "canonicalPath": "/pt/nova-batalha-trafego-chatgpt-gemini-perplexity",
    "canonicalUrl": "https://indexai.news/pt/nova-batalha-trafego-chatgpt-gemini-perplexity",
    "alternates": {
      "pt": { "path": "/pt/nova-batalha-trafego-chatgpt-gemini-perplexity", "url": "https://...", "locale": "pt-BR" },
      "es": { "path": "/es/nueva-batalla-trafico-chatgpt-gemini-perplexity", "url": "https://...", "locale": "es-ES" },
      "en": { "path": "/en/new-traffic-war-chatgpt-gemini-perplexity",       "url": "https://...", "locale": "en-US" }
    },
    "section": "Research",
    "tags": ["Pesquisa", "ChatGPT", "Gemini"],
    "keywords": ["GEO", "AI search", "ChatGPT", "Gemini", "..."],
    "authors": [
      { "name": "Mariana Duarte", "role": "Editora-chefe · Ainalytics Research", "url": null }
    ],
    "publisher": { "name": "Ainalytics", "logo": { "url": "...", "width": 512, "height": 512 }, "url": "https://indexai.news" },
    "publishedAt": "2026-04-23T12:00:00.000Z",
    "modifiedAt": "2026-04-24T09:00:00.000Z",
    "readTimeMinutes": 12,
    "image": {
      "url": "https://indexai.news/pt/nova-batalha-trafego-chatgpt-gemini-perplexity/opengraph-image",
      "width": 1200,
      "height": 630,
      "alt": "Index AI — 4.2M queries analyzed across ChatGPT, Gemini, Perplexity and Claude"
    }
  },
  "content": { /* full Dict including article.body[], article.citations[], article.toc[] */ }
}
```

**Status codes:** `200`, `301` (slug rename → redirect to canonical),
`404` (slug not found in this locale), `410` (article retracted)

**Headers:**

```
Content-Language: pt-BR
Link: <https://indexai.news/pt/nova-batalha-trafego-chatgpt-gemini-perplexity>; rel="canonical"
Link: <https://indexai.news/es/nueva-batalla-trafico-chatgpt-gemini-perplexity>; rel="alternate"; hreflang="es-ES"
Link: <https://indexai.news/en/new-traffic-war-chatgpt-gemini-perplexity>; rel="alternate"; hreflang="en-US"
```

**Cache:** `s-maxage=3600, stale-while-revalidate=86400`

---

### `GET /api/v1/articles/[lang]/[slug]/related`  🔮

Related articles for a given article — used for "Read next" / "You might
also like" rails on the article page.

**Query params**

| Name    | Type | Default | Notes                |
| ------- | ---- | ------- | -------------------- |
| `limit` | int  | `4`     | Max `12`             |

**Response 200**

```json
{
  "lang": "pt",
  "locale": "pt-BR",
  "items": [ /* ArticleListItem */ ]
}
```

Selection heuristic (server-side): same category → tag overlap → engine
overlap → recency. Not paginated.

---

### `GET /api/v1/articles/[lang]/[slug]/citations`  🟡

Returns the live citation tracker for the article: which AI engines
currently surface this story. Currently embedded in the article response,
but the underlying data refreshes hourly while article bodies change rarely
— so a separate endpoint with shorter `s-maxage` is preferred.

**Response 200**

```json
{
  "lang": "pt",
  "locale": "pt-BR",
  "articleId": "gen-search-traffic-war-2026",
  "lastChecked": "2026-04-26T11:00:00.000Z",
  "checkFrequency": "hourly",
  "engines": [
    {
      "engineId": "chatgpt",
      "name": "ChatGPT",
      "color": "#10A37F",
      "status": "yes",
      "evidenceUrl": "https://indexai.news/api/v1/citations/evidence/abc123",
      "lastSeenAt": "2026-04-26T10:55:12.000Z"
    },
    { "engineId": "grok-3", "name": "Grok 3", "color": "#111111", "status": "no", "lastSeenAt": null }
  ]
}
```

`status` enum: `yes` | `partial` | `no`.

**Cache:** `s-maxage=300, stale-while-revalidate=3600`

---

### `GET /api/v1/articles/[lang]/[slug]/history`  🔮

Revision log for the article — used by the "view history" link.

**Response 200**

```json
{
  "lang": "pt",
  "items": [
    { "version": 3, "modifiedAt": "2026-04-24T09:00:00.000Z", "summary": "Added Q1 data refresh" },
    { "version": 2, "modifiedAt": "2026-04-23T18:42:00.000Z", "summary": "Updated Nubank citation rate" },
    { "version": 1, "modifiedAt": "2026-04-23T12:00:00.000Z", "summary": "Initial publication" }
  ]
}
```

---

## 4. Categories

### `GET /api/v1/categories/[lang]`  ✅

Lists all categories with item counts. Used by the homepage filter pills,
mobile drawer, and category index pages.

**Response 200**

```json
{
  "lang": "pt",
  "locale": "pt-BR",
  "segment": "categoria",
  "items": [
    {
      "id": "research",
      "slug": "pesquisa",
      "label": "Pesquisa",
      "canonicalPath": "/pt/categoria/pesquisa",
      "canonicalUrl": "https://indexai.news/pt/categoria/pesquisa",
      "itemCount": 2
    }
  ]
}
```

`segment` is the localized URL prefix (`categoria` for `pt`/`es`,
`category` for `en`).

**Cache:** `s-maxage=3600, stale-while-revalidate=604800`

---

### `GET /api/v1/categories/[lang]/[slug]`  ✅

Single category detail with its articles. Slug is the localized form.

**Path params**

| Name   | Type   | Required | Notes                                       |
| ------ | ------ | -------- | ------------------------------------------- |
| `lang` | enum   | yes      | `pt|es|en`                                  |
| `slug` | string | yes      | Localized category slug for the same locale |

**Query params**

| Name     | Type   | Default | Notes              |
| -------- | ------ | ------- | ------------------ |
| `limit`  | int    | `20`    | Pagination         |
| `cursor` | string | —       | Pagination cursor  |

**Response 200**

```json
{
  "meta": {
    "id": "research",
    "slug": "pesquisa",
    "lang": "pt",
    "locale": "pt-BR",
    "label": "Pesquisa",
    "description": "Estudos e análises sobre como motores generativos selecionam, citam e priorizam marcas em português.",
    "canonicalPath": "/pt/categoria/pesquisa",
    "canonicalUrl": "https://indexai.news/pt/categoria/pesquisa",
    "alternates": {
      "pt": { "path": "/pt/categoria/pesquisa",        "url": "https://...", "locale": "pt-BR" },
      "es": { "path": "/es/categoria/investigacion",   "url": "https://...", "locale": "es-ES" },
      "en": { "path": "/en/category/research",         "url": "https://...", "locale": "en-US" }
    },
    "publisher": { "name": "Ainalytics", "logo": { "url": "...", "width": 512, "height": 512 }, "url": "https://indexai.news" },
    "lastModified": "2026-04-26T00:00:00.000Z",
    "itemCount": 2,
    "seoTitle": "Pesquisa — Pesquisa em Generative Engine Optimization"
  },
  "items": [
    {
      "id": "gen-search-traffic-war-2026",
      "title": "A nova batalha do tráfego: ...",
      "dek": "Análise inédita ...",
      "sectionLabel": "Pesquisa",
      "author": "Mariana Duarte",
      "date": "23 de abril, 2026",
      "readTime": "12 min",
      "imageVariant": 0,
      "href": "/pt/nova-batalha-trafego-chatgpt-gemini-perplexity",
      "canonicalUrl": "https://indexai.news/pt/nova-batalha-trafego-chatgpt-gemini-perplexity",
      "isPrimary": true
    }
  ]
}
```

**Status codes:** `200`, `404` (unknown slug or unsupported lang)
**Cache:** `s-maxage=300, stale-while-revalidate=86400`

---

## 5. Authors  🔮

Currently authors are flat strings on articles. To support author bios,
columnist landing pages, and JSON-LD `Person` enrichment, expose:

### `GET /api/v1/authors/[lang]`  🔮

```json
{
  "lang": "pt",
  "items": [
    {
      "id": "mariana-duarte",
      "slug": "mariana-duarte",
      "name": "Mariana Duarte",
      "role": "Editora-chefe",
      "image": "https://...",
      "articleCount": 24,
      "canonicalPath": "/pt/autor/mariana-duarte",
      "canonicalUrl": "https://indexai.news/pt/autor/mariana-duarte"
    }
  ]
}
```

URL segment `autor` (pt/es) / `author` (en) — same translation pattern as
categories.

### `GET /api/v1/authors/[lang]/[slug]`  🔮

```json
{
  "meta": {
    "id": "mariana-duarte",
    "slug": "mariana-duarte",
    "lang": "pt",
    "locale": "pt-BR",
    "name": "Mariana Duarte",
    "role": "Editora-chefe · Ainalytics Research",
    "bio": "Mariana lidera a redação do Index AI desde a fundação ...",
    "image": "https://...",
    "social": {
      "x":        "https://x.com/marianaduarte",
      "linkedin": "https://www.linkedin.com/in/marianaduarte",
      "email":    "mariana@indexai.news"
    },
    "canonicalPath": "/pt/autor/mariana-duarte",
    "canonicalUrl": "https://indexai.news/pt/autor/mariana-duarte",
    "alternates": { "pt": { "..." }, "es": { "..." }, "en": { "..." } }
  },
  "items": [ /* ArticleListItem[] — articles by this author */ ],
  "page": { /* ... */ }
}
```

---

## 6. Engines  🟡

The homepage "Engines" section currently embeds engine cards inline. A
dedicated endpoint enables: a `/motor/[engineSlug]` engine landing page,
mobile clients, and partner widgets.

### `GET /api/v1/engines/[lang]`  🟡

```json
{
  "lang": "pt",
  "locale": "pt-BR",
  "items": [
    {
      "id": "chatgpt",
      "name": "ChatGPT",
      "shortName": "GPT",
      "vendor": "OpenAI",
      "color": "#10A37F",
      "canonicalPath": "/pt/motor/chatgpt",
      "canonicalUrl": "https://indexai.news/pt/motor/chatgpt",
      "stats": {
        "articleCount": 43,
        "citationsTrend30d": "+12%",
        "userBase": "2.1B prompts/mês"
      },
      "latest": {
        "headline": "Indexação em tempo real começa a ser testada com editores premium.",
        "publishedAt": "2026-04-25T08:30:00.000Z",
        "articleSlug": null
      },
      "sparkline": {
        "metric": "citations",
        "from": "2026-03-27",
        "to": "2026-04-26",
        "values": [34, 52, 28, 71, 45, 89, 62, 48, 95, 77, 58, 82, 41, 68, 55, 73, 49, 92, 66, 81, 38, 64, 87, 53, 70, 44, 86, 61, 76, 90]
      }
    }
  ]
}
```

### `GET /api/v1/engines/[lang]/[engineSlug]`  🔮

Engine landing page payload — same shape as a single `items[]` entry plus a
longer-window sparkline, recent news, top brands cited.

### `GET /api/v1/engines/[lang]/[engineSlug]/articles`  🔮

Articles tagged with this engine. Same shape as `/articles/[lang]` list.

---

## 7. Rankings  🟡

The AI Visibility Index (AVI) ranking shown on the homepage is currently
hardcoded. To support filtering by region/sector and weekly recomputation:

### `GET /api/v1/rankings/[lang]`  🟡

**Query params**

| Name      | Type   | Default          | Notes                                     |
| --------- | ------ | ---------------- | ----------------------------------------- |
| `region`  | string | locale-derived   | `br`, `es`, `mx`, `co`, `cl`, `ar`, `pt`, `eu` |
| `sector`  | string | `financial-services` | Slug like `fintech`, `bank`, `retail` |
| `period`  | enum   | `weekly`         | `weekly`, `monthly`, `quarterly`          |
| `limit`   | int    | `10`             | Max `100`                                 |

**Response 200**

```json
{
  "lang": "pt",
  "locale": "pt-BR",
  "period": {
    "label": "weekly",
    "from": "2026-04-19",
    "to":   "2026-04-26"
  },
  "filters": {
    "region": "br",
    "sector": "financial-services"
  },
  "filtersAvailable": {
    "regions": [
      { "id": "br", "label": "Brasil" },
      { "id": "es", "label": "Espanha" }
    ],
    "sectors": [
      { "id": "financial-services", "label": "Serviços financeiros" },
      { "id": "retail",              "label": "Varejo" }
    ]
  },
  "stats": {
    "queriesAnalyzed": 4200000,
    "sectorsCovered": 127,
    "enginesMonitored": ["chatgpt", "gemini", "claude", "perplexity", "grok"]
  },
  "items": [
    {
      "rank": 1,
      "brandId": "nubank",
      "name": "Nubank",
      "sector": "Fintech",
      "score": 94,
      "delta": "+6",
      "direction": "up"
    }
  ]
}
```

`direction` enum: `up` | `down` | `flat`.

**Cache:** `s-maxage=300, stale-while-revalidate=86400`

---

## 8. Ticker  🟡

Real-time engine signals shown at the top of every page.

### `GET /api/v1/ticker/[lang]`  🟡

```json
{
  "lang": "pt",
  "locale": "pt-BR",
  "lastUpdated": "2026-04-26T12:30:00.000Z",
  "items": [
    {
      "engineId": "chatgpt",
      "label": "ChatGPT",
      "value": "Indexação 2x mais rápida",
      "trend": "up",
      "linkUrl": null
    }
  ]
}
```

`trend` enum: `up` | `down` | `neutral`.

**Cache:** `s-maxage=60, stale-while-revalidate=300`

---

## 9. Tags  🔮

Lightweight taxonomy beyond categories. Each story carries multiple tags
(e.g. `chatgpt`, `gemini`, `latam`, `fintech`). Tags drive cross-cutting
discovery.

### `GET /api/v1/tags/[lang]`  🔮

```json
{
  "lang": "pt",
  "items": [
    { "id": "chatgpt",   "slug": "chatgpt",   "label": "ChatGPT",   "articleCount": 43 },
    { "id": "fintech",   "slug": "fintech",   "label": "Fintech",   "articleCount": 18 }
  ]
}
```

### `GET /api/v1/tags/[lang]/[tagSlug]`  🔮

Returns articles tagged with the given slug. Same response shape as
`/articles/[lang]` list.

---

## 10. Search  🔮

Full-text search referenced by the JSON-LD `SearchAction` on every page
(`urlTemplate: https://indexai.news/search?q={search_term_string}`) and the
header search button.

### `GET /api/v1/search/[lang]`  🔮

**Query params**

| Name     | Type    | Required | Notes                                              |
| -------- | ------- | -------- | -------------------------------------------------- |
| `q`      | string  | yes      | URL-encoded query (min length 2)                   |
| `type`   | enum    | no       | `article` (default), `category`, `engine`, `author`|
| `limit`  | int     | no       | Default `20`, max `50`                             |
| `cursor` | string  | no       | Pagination cursor                                  |

**Response 200**

```json
{
  "lang": "pt",
  "locale": "pt-BR",
  "query": "geo seo",
  "totalResults": 12,
  "items": [
    {
      "type": "article",
      "id": "gen-search-traffic-war-2026",
      "title": "A nova batalha do tráfego: ...",
      "snippet": "...prompts em português geram <mark>34%</mark> mais variação que em <mark>inglês</mark>...",
      "score": 0.87,
      "url": "https://indexai.news/pt/nova-batalha-trafego-chatgpt-gemini-perplexity",
      "section": "Research",
      "publishedAt": "2026-04-23T12:00:00.000Z"
    },
    {
      "type": "category",
      "id": "research",
      "title": "Pesquisa",
      "snippet": "Estudos e análises sobre como motores generativos ...",
      "url": "https://indexai.news/pt/categoria/pesquisa"
    }
  ],
  "page": { "limit": 20, "cursor": null, "nextCursor": null }
}
```

`<mark>` HTML in `snippet` is safe — server-sanitized; clients should render
it as-is.

**Cache:** none (`Cache-Control: private, no-store`)

---

## 11. Newsletter  🔮

Drives the "Começar grátis" form in the homepage CTA + sidebar CTA on
articles. Uses double opt-in.

### `POST /api/v1/newsletter/subscribe`  🔮

**Request body**

```json
{
  "email": "you@email.com",
  "lang": "pt",
  "source": "homepage_cta",
  "topics": ["chatgpt", "gemini"],
  "consent": true,
  "captchaToken": "..."
}
```

`source` enum: `homepage_cta`, `article_sidebar`, `footer`, `category_page`,
`other`. `captchaToken` is the Vercel BotID / hCaptcha token.

**Response 202**

```json
{
  "status": "pending_confirmation",
  "subscriberId": "sub_01J9...",
  "confirmationEmailSentTo": "you@email.com"
}
```

**Status codes:** `202`, `400` (bad email), `409` (already subscribed),
`422` (consent missing), `429`

### `POST /api/v1/newsletter/confirm`  🔮

```json
{ "token": "<from email link>" }
```

Returns `200 { "status": "subscribed" }`.

### `POST /api/v1/newsletter/unsubscribe`  🔮

```json
{ "token": "<from email footer>", "reason": "too_frequent" | "not_relevant" | "other" }
```

Returns `200 { "status": "unsubscribed" }`.

### `GET /api/v1/newsletter/preferences`  🔮 (auth)

```json
{
  "subscribed": true,
  "topics": ["chatgpt", "gemini"],
  "frequency": "weekly",
  "lang": "pt"
}
```

`PATCH` accepts the same shape to update.

---

## 12. Engagement  🔮

### `POST /api/v1/articles/[lang]/[slug]/share`  🔮

Tracks an outbound share. Body:

```json
{ "channel": "twitter" | "linkedin" | "copy_link" | "email" | "other" }
```

Returns `204 No Content`.

### `GET /api/v1/articles/[lang]/[slug]/listen`  🔮

Returns a streaming audio URL (TTS). Used by the "Ouvir" button.

```json
{
  "lang": "pt",
  "voice": "narrator-pt-female",
  "audioUrl": "https://cdn.indexai.news/audio/.../narration.m3u8",
  "format": "hls",
  "durationSeconds": 720,
  "expiresAt": "2026-04-26T13:30:00.000Z"
}
```

The URL is a signed CDN URL, expires after 1 h. Clients re-request when
expired.

### `POST /api/v1/articles/[lang]/[slug]/bookmark`  🔮 (auth)

`POST` saves the article to the user's reading list, `DELETE` removes.

```json
{ "bookmarked": true, "savedAt": "2026-04-26T12:00:00.000Z" }
```

### `GET /api/v1/me/bookmarks`  🔮 (auth)

Lists current user's bookmarks. Same shape as `/articles/[lang]` list.

---

## 13. Citations  🔮

Powers the "cite-back" feature mentioned in the top-of-page article: brands
can flag incorrect citations and request a review.

### `POST /api/v1/citations/correct`  🔮

```json
{
  "articleId": "gen-search-traffic-war-2026",
  "engineId": "chatgpt",
  "brandId": "nubank",
  "evidenceUrl": "https://chat.openai.com/share/...",
  "claimedFact": "Nubank appears in 61% of answers about 'digital account in Brazil'",
  "correctionType": "incorrect_attribution",
  "submittedBy": {
    "name": "Maria S",
    "email": "maria@nubank.com.br",
    "company": "Nubank",
    "role": "PR Manager"
  }
}
```

`correctionType` enum: `incorrect_attribution`, `outdated_data`,
`misinterpretation`, `defamation`, `other`.

Returns `202 Accepted` with `{ "ticketId": "ct_01J9..." }`. Reviewed by the
editorial team within 5 business days.

### `GET /api/v1/citations/evidence/[id]`  🔮

Returns the evidence record (screenshot URL, captured prompt, captured
response) for a citation entry.

---

## 14. Authentication  🔮

Currently the header has "Entrar" / "Assinar" buttons that link nowhere.
For a paid tier and personalized features:

### `POST /api/v1/auth/signup`  🔮
### `POST /api/v1/auth/signin`  🔮
### `POST /api/v1/auth/signout`  🔮
### `POST /api/v1/auth/refresh`  🔮
### `POST /api/v1/auth/forgot`  🔮
### `POST /api/v1/auth/reset`  🔮

The Vercel Marketplace already provides Clerk and Auth0 — the public API
should proxy whichever provider is selected. Recommended: Clerk (native
Vercel integration, OIDC, Sign in with Vercel support).

### `GET /api/v1/me`  🔮 (auth)

```json
{
  "id": "user_01J9...",
  "email": "you@email.com",
  "name": "...",
  "preferredLang": "pt",
  "preferredTheme": "light",
  "topics": ["chatgpt", "fintech"],
  "createdAt": "2026-01-12T...",
  "subscriptions": { "newsletter": true, "premium": false }
}
```

### `PATCH /api/v1/me/preferences`  🔮 (auth)

Updates `preferredLang`, `preferredTheme`, `topics`, `frequency`.

---

## 15. Discovery / SEO

These are not under `/api/v1` but are part of the public surface and
already implemented:

### `GET /sitemap.xml`  ✅

All localized URLs (homepages, categories, articles) with `xhtml:link
hreflang` alternates and `x-default`. Auto-revalidates on content changes
via the `revalidatePath('/sitemap.xml')` server action (when implemented).

### `GET /robots.txt`  ✅

Allow-list per major search and AI agent (Googlebot, Google-Extended,
GPTBot, Perplexity, ClaudeBot, OAI-SearchBot, Applebot-Extended, CCBot,
Bytespider, Amazonbot, etc.). Disallows `/api/` and `/_next/`. Points at
sitemap and sets `Host`.

### `GET /[lang]/opengraph-image`  ✅
### `GET /[lang]/[slug]/opengraph-image`  ✅
### `GET /[lang]/[slug]/[categorySlug]/opengraph-image`  ✅

Dynamic `image/png` 1200×630 social cards per page kind, generated at
request time via `next/og` `ImageResponse`.

### `GET /feed.xml` / `GET /feed/[lang].xml` / `GET /feed/[lang]/[category].xml`  🔮

RSS / Atom feeds — referenced by the "RSS" social link in the footer. One
feed per locale + per (locale, category). Standard RSS 2.0 with
`<atom:link rel="alternate" hreflang>` for cross-locale discovery.

### `GET /.well-known/security.txt`  🔮

Standard `security.txt` with contact + policy URLs.

---

## Type reference

The shapes used across endpoints. The frontend imports these from
`lib/content/types.ts`.

```ts
// Locale set
type Lang   = 'pt' | 'es' | 'en';
type Locale = 'pt-BR' | 'es-ES' | 'en-US';

interface AlternateTarget { path: string; url: string; locale: Locale }
type AlternateMap = Record<Lang, AlternateTarget>;

interface Publisher {
  name: string;
  logo: { url: string; width: number; height: number };
  url: string;
}

interface Author { name: string; role: string; url?: string }

interface PageInfo {
  limit: number;
  cursor: string | null;
  nextCursor: string | null;
  totalEstimate?: number;
}

// Article
interface ArticleListItem {
  id: string;
  slug: string;
  title: string;
  dek: string;
  section: string;
  authors: Array<{ name: string }>;
  publishedAt: string;        // ISO-8601
  modifiedAt: string;
  readTimeMinutes: number;
  canonicalPath: string;
  canonicalUrl: string;
}

interface ArticleMeta {
  id: string;
  slug: string;
  lang: Lang;
  locale: Locale;
  title: string;
  description: string;
  canonicalPath: string;
  canonicalUrl: string;
  alternates: AlternateMap;
  section: string;
  tags: string[];
  keywords: string[];
  authors: Author[];
  publisher: Publisher;
  publishedAt: string;
  modifiedAt: string;
  readTimeMinutes: number;
  image: { url: string; width: number; height: number; alt: string };
}

// Article body block
type ArticleBlock =
  | { type: 'p';         text: string }
  | { type: 'h2';        text: string }
  | { type: 'h3';        text: string }
  | { type: 'blockquote'; text: string };

interface CitationEntry {
  engineId: string;
  name: string;
  color: string;
  status: 'yes' | 'partial' | 'no';
  evidenceUrl: string | null;
  lastSeenAt: string | null;
}

// Category
interface CategoryListItem {
  id: string;
  slug: string;
  label: string;
  canonicalPath: string;
  canonicalUrl: string;
  itemCount: number;
}

interface CategoryCard {
  id: string;
  title: string;
  dek: string;
  sectionLabel: string;
  author: string;
  date: string;
  readTime: string;
  imageVariant: number;
  href: string;
  canonicalUrl: string;
  isPrimary: boolean;
}

// Engine
interface EngineListItem {
  id: string;
  name: string;
  shortName: string;
  vendor: string;
  color: string;          // hex
  canonicalPath: string;
  canonicalUrl: string;
  stats: {
    articleCount: number;
    citationsTrend30d: string;
    userBase: string;
  };
  latest: {
    headline: string;
    publishedAt: string;
    articleSlug: string | null;
  };
  sparkline: {
    metric: 'citations' | 'mentions' | 'queries';
    from: string;        // ISO date
    to:   string;
    values: number[];
  };
}

// Ranking
interface RankingItem {
  rank: number;
  brandId: string;
  name: string;
  sector: string;
  score: number;          // 0–100
  delta: string;          // "+6", "-2", "0"
  direction: 'up' | 'down' | 'flat';
}

// Ticker
interface TickerItem {
  engineId: string;
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  linkUrl: string | null;
}
```

---

## Implementation roadmap

To get from "current repo" to "fully API-backed website", in dependency
order:

1. **Split the homepage payload.** Move `ticker`, `rankings`, `engines`,
   `sidebar.items` (trending) into their own endpoints. Homepage payload
   becomes a thin composition reference.
2. **Wire the citation tracker** to its own endpoint. Refresh hourly,
   independent of article content.
3. **Newsletter subscribe → confirm → unsubscribe.** Drop-in via a third-
   party (Resend, Beehiiv, Mailchimp) behind our endpoint to keep the API
   contract stable.
4. **Search.** Tantivy / Meilisearch / Postgres FTS — pick one. Index
   articles + categories + engines + authors. Backed by `SearchAction`
   JSON-LD already shipped.
5. **Authors API** + author landing pages. Enriches `Person` JSON-LD on
   articles.
6. **Engines API** + engine landing pages.
7. **Tags API.**
8. **RSS feeds** (per-locale, per-category).
9. **Auth + user state** (bookmarks, preferences, premium tier).
10. **Engagement** (share, listen, bookmark, citation correction).

Each step keeps the contract documented here intact — front-end clients,
mobile apps, and partners can be built against this spec before the
backend ships.
