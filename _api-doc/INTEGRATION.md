# Index AI — Blog API Integration Guide

Practical guide for the **indexai.news** front-end team to consume the
simplified Index AI Blog API hosted on Ainalytics' Supabase project.

> **Status:** all 8 functions deployed and live — last verified against
> production on **2026-04-28**.

## 0. The 7 endpoints (TL;DR)

| # | Purpose                  | Method | URL                                                  |
|---|--------------------------|--------|------------------------------------------------------|
| 1 | List categories          | GET    | `/blog-categories/{lang}`                            |
| 2 | List news                | GET    | `/blog-news/{lang}?q=&category=&sort=&limit=&cursor=`|
| 2 | News article detail      | GET    | `/blog-news/{lang}/{slug}`                           |
| 3 | Trending feed (homepage) | GET    | `/blog-trending/{lang}?limit=10`                     |
| 4 | Ticker items             | GET    | `/blog-ticker/{lang}`                                |
| 5 | Ranking sectors+subsectors| GET   | `/blog-ranking-sectors/{lang}`                       |
| 6 | Ranking items            | GET    | `/blog-ranking/{lang}?q=&sector=&subsector=&region=&sort=&limit=` |
| 7 | Newsletter register      | POST   | `/blog-newsletter/register`                          |

Every public read returns **`{ data, seo }`** — see §3 for the SEO block.

---

## 1. Base URLs & auth

| Environment   | Functions base URL                                           |
| ------------- | ------------------------------------------------------------ |
| **Production**| `https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1`      |
| **Local dev** | `http://127.0.0.1:54321/functions/v1`                        |

Project ID: `kjfvhiffsusdqphgjsdz`.

**No auth required for any of the 7 public endpoints.** Functions are
deployed with `--no-verify-jwt`, so calls work anonymously without an
`Authorization` or `apikey` header.

`{lang}` ∈ `pt | es | en` (path segment, no fallback — clients must send
it explicitly). Any other value returns `404 unsupported_lang` with the
list of accepted locales in `details.supported`.

---

## 2. Language handling

Every endpoint accepts the language as the first path segment. The response
returns localized content for that language plus a `Content-Language` header
and a `seo.locale` field with the BCP-47 locale (`pt-BR`, `es-ES`, `en-US`).

```bash
curl https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1/blog-categories/pt
# Response Content-Language: pt-BR
```

### 2.1 Conditional GET (ETag → 304)

Every public read response carries a weak `ETag` header (a SHA-1 hash of
the response body, e.g. `W/"a0f5b3c14cf7282c"`). Echo it back in
`If-None-Match` on subsequent requests; if the body hasn't changed the
server returns `304 Not Modified` with no body. `If-Modified-Since` is
**not** honored — use `If-None-Match` exclusively.

```bash
F=https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1
ET=$(curl -sD - -o /dev/null "$F/blog-categories/pt" | awk '/^etag:/ {print $2}' | tr -d '\r')
curl -sI -H "If-None-Match: $ET" "$F/blog-categories/pt"   # → 304
```

Article detail and trending also emit `Last-Modified` for display
purposes only.

---

## 3. The `seo` block (every read response)

Pre-render templates can map this object directly to `<head>` tags + JSON-LD.

```json
{
  "data": { /* endpoint-specific payload */ },
  "seo": {
    "title":            "...",                       // <title> + og:title
    "description":      "...",                       // <meta name=description> + og:description
    "keywords":         ["GEO", "ChatGPT", "..."],   // <meta name=keywords>
    "canonical":        "https://indexai.news/pt/...",
    "ogTitle":          "...",
    "ogDescription":    "...",
    "ogImage":          "https://...",
    "ogImageAlt":       "...",
    "ogType":           "website" | "article",
    "twitterCard":      "summary" | "summary_large_image",
    "twitterHandle":    "@indexai",                  // nullable — currently null
    "publisher": {
      "name": "Ainalytics",
      "url":  "https://indexai.news",
      "logo": { "url": "https://indexai.news/brand/logo", "width": 512, "height": 512 }
    },
    "lang":             "pt",
    "locale":           "pt-BR",
    "alternates": [
      { "hreflang": "pt-BR", "href": "https://indexai.news/pt/..." },
      { "hreflang": "es-ES", "href": "https://indexai.news/es/..." },
      { "hreflang": "en-US", "href": "https://indexai.news/en/..." },
      { "hreflang": "x-default", "href": "https://indexai.news/pt/..." }
    ],
    "publishedTime":    "2026-04-23T12:00:00+00:00", // article only — ISO 8601 UTC
    "modifiedTime":     "2026-04-24T09:00:00+00:00", // article only — ISO 8601 UTC
    "robots":           "index,follow",
    "structuredData":   { /* JSON-LD — see note below */ }
  }
}
```

**Field guarantees:**

- All keys above are **always present** on every public read response.
  Optional values fall back to `null`, never `undefined`/missing.
- `seo.alternates` always includes 4 entries: `pt-BR`, `es-ES`, `en-US`,
  and `x-default` (which mirrors the Portuguese variant).
- `seo.structuredData` is **pre-built only for**:
  - `/blog-news/{lang}/{slug}` → `NewsArticle` (with `citation[]` from `data.sources[]`)
  - `/blog-trending/{lang}` → `WebSite`
  
  All other endpoints return `seo.structuredData: null` and the
  front-end is expected to assemble the appropriate JSON-LD locally
  (e.g. `FAQPage` from `data.faq[]`, `BreadcrumbList`, `CollectionPage`).

**Response headers (all reads):** `Content-Language`, `ETag`,
`Cache-Control`, `Link rel="canonical"`, plus `Last-Modified` on article
detail and trending. CORS: `Access-Control-Allow-Origin: *`.

**Tip for Next.js** — feed `seo` into `generateMetadata`:

```ts
export async function generateMetadata({ params }: { params: { lang: string; slug: string } }) {
  const { seo } = await fetchNewsArticle(params.lang, params.slug);
  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: {
      canonical: seo.canonical,
      languages: Object.fromEntries(seo.alternates.map((a) => [a.hreflang, a.href])),
    },
    openGraph: {
      title: seo.ogTitle,
      description: seo.ogDescription,
      images: seo.ogImage ? [{ url: seo.ogImage, alt: seo.ogImageAlt ?? '' }] : [],
      type: seo.ogType,
      locale: seo.locale,
      publishedTime: seo.publishedTime ?? undefined,
      modifiedTime: seo.modifiedTime ?? undefined,
    },
    twitter: { card: seo.twitterCard, site: seo.twitterHandle ?? undefined },
    robots: seo.robots,
  };
}
```

For pages that include JSON-LD, dump `seo.structuredData` directly:

```tsx
<script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.structuredData) }} />
```

---

## 4. Endpoint reference

### 4.1 `GET /blog-categories/{lang}`

```json
{
  "data": {
    "lang": "pt",
    "locale": "pt-BR",
    "segment": "categoria",
    "items": [
      {
        "id": "research",
        "slug": "pesquisa",
        "label": "Pesquisa",
        "description": "Estudos e análises ...",
        "itemCount": 12,
        "canonicalPath": "/pt/categoria/pesquisa",
        "canonicalUrl": "https://indexai.news/pt/categoria/pesquisa"
      }
    ]
  },
  "seo": { /* ... */ }
}
```

`segment` is the localized URL slug for the category index page —
`categoria` (pt), `categoria` (es), `category` (en). `itemCount` is the
number of *published* articles in that category for the requested locale.

`Cache-Control: public, s-maxage=3600, stale-while-revalidate=604800`

### 4.2a `GET /blog-news/{lang}` — list

Query params:

| Param       | Type   | Default              | Notes                                         |
|-------------|--------|----------------------|-----------------------------------------------|
| `q`         | string | —                    | case-insensitive partial match on title/dek   |
| `category`  | string | —                    | category id (e.g. `research`)                 |
| `sort`      | enum   | `published_at:desc`  | also: `published_at:asc`, `title:asc/desc`    |
| `limit`     | int    | `20` (max `50`)      | page size                                     |
| `cursor`    | string | —                    | opaque, from previous `page.nextCursor`       |

```json
{
  "data": {
    "lang": "pt",
    "locale": "pt-BR",
    "items": [
      {
        "id": "gen-search-traffic-war-2026",
        "slug": "nova-batalha-trafego-chatgpt-gemini-perplexity",
        "title": "...",
        "dek": "...",
        "section": "Pesquisa",                                  /* localized label for display */
        "categoryId": "research",                               /* stable id for routing/joins */
        "category": { "id": "research", "slug": "pesquisa", "label": "Pesquisa" },
        "tags": [{ "id": "chatgpt", "slug": "chatgpt", "label": "ChatGPT" }],
        "author": {
          "id": "mariana-duarte",
          "name": "Mariana Duarte",
          "role": "Editora-chefe · Ainalytics Research",
          "image": "https://indexai.news/authors/mariana-duarte.jpg",
          "url": null                                           /* populated when authors API ships */
        },
        "publishedAt": "2026-04-23T12:00:00+00:00",
        "modifiedAt": "2026-04-24T09:00:00+00:00",
        "readTimeMinutes": 12,
        "image": { "url": "...", "width": 1200, "height": 630, "alt": "..." },
        "canonicalPath": "/pt/nova-batalha-trafego-chatgpt-gemini-perplexity",
        "canonicalUrl": "https://indexai.news/pt/..."
      }
    ],
    "page": { "limit": 20, "cursor": null, "nextCursor": "...", "totalEstimate": 137 },
    "filters": { "q": null, "category": null, "sort": "published_at:desc" }
  },
  "seo": { /* ... */ }
}
```

`Cache-Control` is `s-maxage=300` for normal lists, `s-maxage=0` when `?q=` is present.

### 4.2b `GET /blog-news/{lang}/{slug}` — detail

```json
{
  "data": {
    "id": "gen-search-traffic-war-2026",
    "slug": "nova-batalha-trafego-chatgpt-gemini-perplexity",
    "lang": "pt",
    "title": "...",
    "dek": "...",
    "body": "<p>...</p>\n<h2>...</h2>\n<p>...</p>\n<blockquote>...</blockquote>",
    "toc": ["O novo funil", "Os dados", "Quem ganhou"],
    "categoryId": "research",                                 /* stable id (CHANGES.md §1.2) */
    "category": { "id": "research", "slug": "pesquisa", "label": "Pesquisa" },
    "tags": [...],
    "author": {
      "id": "mariana-duarte",
      "name": "...",
      "role": "...",
      "image": "...",
      "url": null                                             /* populated when authors API ships */
    },
    "sources": [                                              /* external/academic citations (CHANGES.md §1.1) */
      { "name": "Universidade de São Paulo", "url": "https://www5.usp.br/" },
      { "name": "IE Business School",        "url": "https://www.ie.edu/business-school/" }
    ],
    "publishedAt": "...",
    "modifiedAt": "...",
    "readTimeMinutes": 12,
    "readTimeLabel": "12 min",
    "displayDate": "23 de abril, 2026",
    "image": { "url": "...", "width": 1200, "height": 630, "alt": "..." },
    "canonicalPath": "/pt/...",
    "canonicalUrl": "https://indexai.news/pt/..."
  },
  "seo": {
    "...": "...",
    "ogType": "article",
    "structuredData": {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "citation": [                                           /* mirrors data.sources[] */
        { "@type": "CreativeWork", "name": "...", "url": "..." }
      ],
      "...": "..."
    }
  }
}
```

`data.body` is an **HTML string** authored via the rich-text editor on
`/sa/blog/news/:id` — render it directly with React's
`dangerouslySetInnerHTML` (or your framework's equivalent) inside a
sanitized container. Allowed inline tags: `p`, `h2`, `h3`, `blockquote`,
`ul`/`ol`/`li`, `a`, `strong`, `em`, `s`, `br`. Bulk-import via the SA
"Import" path also accepts the legacy block-array shape
(`[{ "type": "p", "text": "..." }]`) — the admin endpoint converts it to
HTML server-side, but the public API only returns HTML.

`data.sources[]` is **always present** (returns `[]` when none) and
locale-agnostic. The frontend dumps it directly into
`NewsArticle.citation[]` JSON-LD.

Editorial note: keep `seo.keywords` to **4–6 entries**. Long keyword lists
hurt AI-citation visibility (Princeton GEO research).

Status codes: `200`, `404` (slug not found in this locale), `410` (article retracted).

`Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.

### 4.3 `GET /blog-trending/{lang}?limit=10`

The full payload for the homepage. Falls back to most-recent published when
fewer than `limit` articles are flagged as trending. `featured` is the hero
card and `items[]` carries the remaining teasers (up to `limit - 1`); when
no published articles exist for the locale `featured` is null and `items`
is empty.

```json
{
  "data": {
    "lang": "pt",
    "locale": "pt-BR",
    "eyebrow":     "Destaques",
    "title":       "Em alta no Index AI",
    "description": "As reportagens mais lidas sobre busca generativa...",
    "featured": { /* news teaser — same shape as items[] in §4.2a, nullable */ },
    "items":    [ /* up to limit-1 more news teasers (may be []) */ ],
    "newsletter": {
      "eyebrow": "Powered by Ainalytics",
      "title":   "Saiba o que a IA diz sobre a sua marca",
      "text":    "Monitore como ChatGPT, Gemini, Perplexity e Grok ...",
      "placeholder": "seu@email.com",
      "button":      "Começar grátis"
    },
    "lastModified": "2026-04-24T09:00:00+00:00"
  },
  "seo": {
    "ogType": "website",
    "structuredData": {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "url": "https://indexai.news/pt",
      "name": "Index AI — ...",
      "description": "...",
      "publisher": { /* Organization */ },
      "potentialAction": { "@type": "SearchAction", "target": "https://indexai.news/search?q={search_term_string}", "query-input": "required name=search_term_string" }
    }
  }
}
```

`Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`. The
`Last-Modified` response header mirrors `data.lastModified`.

### 4.4 `GET /blog-ticker/{lang}`

```json
{
  "data": {
    "lang": "pt",
    "locale": "pt-BR",
    "lastUpdated": "2026-04-27T00:00:00+00:00",
    "items": [
      { "engineId": "chatgpt", "label": "ChatGPT", "value": "Indexação 2x mais rápida", "trend": "up", "linkUrl": null }
    ]
  },
  "seo": { /* ... */ }
}
```

`trend` ∈ `up | down | neutral`. `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.

### 4.5 `GET /blog-ranking-sectors/{lang}`

Returns the canonical 10-sector × 5-subsector taxonomy with brand counts. The
subsectors are nested under each sector — `id` values are the canonical
slugs to pass back to `/blog-ranking?sector=…&subsector=…`.

```json
{
  "data": {
    "lang": "pt",
    "locale": "pt-BR",
    "items": [
      {
        "id": "financial-services",
        "label": "Serviços Financeiros",
        "description": "Bancos, fintechs, seguradoras, pagamentos e investimentos.",
        "brandCount": 50,
        "subsectors": [
          { "id": "banks",            "label": "Bancos",                       "brandCount": 17 },
          { "id": "fintech-neobanks", "label": "Fintech / Neobancos",          "brandCount": 9 },
          { "id": "insurance",        "label": "Seguros",                      "brandCount": 8 },
          { "id": "payments-wallets", "label": "Pagamentos / Carteiras",       "brandCount": 8 },
          { "id": "wealth-investing", "label": "Investimentos / Wealth",       "brandCount": 8 }
        ]
      },
      { "id": "healthcare", "label": "Saúde", "subsectors": [/* hospitals, health-plans, telehealth, pharma-brands, labs-diagnostics */], "brandCount": 34 },
      /* …8 more sectors… */
    ]
  },
  "seo": { /* SEO of the rankings page */ }
}
```

The 10 sectors and 50 subsectors are the production taxonomy. Sector ids:
`financial-services, healthcare, education, retail-ecommerce, travel-hospitality,
consumer-brands, technology, real-estate, automotive-mobility, food-restaurants`.

### 4.6 `GET /blog-ranking/{lang}`

Query params:

| Param        | Type   | Default                                              | Notes |
|--------------|--------|------------------------------------------------------|-------|
| `q`          | string | —                                                    | partial match on brand name, sector or subsector label |
| `sector`     | string | —                                                    | sector id (e.g. `financial-services`) |
| `subsector`  | string | —                                                    | subsector id (e.g. `banks`, `ai-platforms`) — applied at brand-level |
| `region`     | string | per-locale (`pt→br`, `es→es`, `en→us`); falls back to `global` | `br`, `es`, `us`, `global` |
| `period`     | enum   | `weekly`                                             | `weekly`, `monthly`, `quarterly` |
| `sort`       | enum   | `rank:asc`                                           | `rank:desc`, `score:asc/desc`, `name:asc/desc`, `delta:desc` |
| `limit`      | int    | `50` (max `100`)                                     | page size |

If the requested region has no snapshot for the requested sector, the API
silently falls back to `region=global`. The `data.filters.region` field tells
you which region was actually served.

```json
{
  "data": {
    "lang": "en",
    "locale": "en-US",
    "title":       "AI Visibility Index (AVI)",
    "description": "The Ainalytics index blends citation frequency, ...",
    "period":  { "label": "weekly", "from": "2026-04-20", "to": "2026-04-27" },
    "filters": { "region": "global", "sector": "technology", "subsector": null, "q": null, "sort": "rank:asc" },
    "stats":   { "queriesAnalyzed": 4200000, "sectorsCovered": 127,
                 "enginesMonitored": ["chatgpt","gemini","claude","perplexity","grok"] },
    "items": [
      {
        "rank": 1,
        "brandId":         "openai",
        "name":            "OpenAI",
        "country":         "GLOBAL",
        "sectorId":        "technology",
        "sectorLabel":     "Technology",
        "subsectorId":     "ai-platforms",
        "subsectorLabel":  "AI Platforms",
        "homepageDomain":  "openai.com",
        "entityType":      "company",
        "score": 98, "delta": "+1", "direction": "up",
        "snapshotId": 13
      }
    ],
    "faq": [                                                  /* CHANGES.md §3.1 */
      {
        "question": "What is the Ainalytics AI Visibility Index (AVI)?",
        "answer":   "The AVI is the weekly measure of how often a brand appears..."
      },
      { "question": "How is the AVI calculated?",       "answer": "..." },
      { "question": "Which engines are tracked?",       "answer": "..." },
      { "question": "How often is it updated?",         "answer": "..." },
      { "question": "What sectors and markets are covered?", "answer": "..." },
      { "question": "What makes a brand's score go up or down?", "answer": "..." }
    ]
  },
  "seo": { /* ... */ }
}
```

`direction` ∈ `up | down | flat`. `entityType` ∈ `company | university |
school | hospital | government | nonprofit | brand`. `Cache-Control: public,
s-maxage=300, stale-while-revalidate=86400`.

`data.faq[]` is always present (returns `[]` when none). The most-specific
match wins: API picks the FAQ row matching `(region, sector, lang)` if
present, otherwise falls back to `(region, NULL, lang)` → `(NULL, sector,
lang)` → `(NULL, NULL, lang)`. The frontend renders this as `FAQPage`
JSON-LD on the rankings page.

`data.period.from` / `data.period.to` are **ISO 8601 dates** (`yyyy-mm-dd`).
The frontend joins them as `${from}/${to}` for `Report.temporalCoverage`
JSON-LD.

**Subsector filter** (`?subsector=banks`) filters at the brand level — if the
sector snapshot has 10 items but only 3 brands belong to the `banks`
subsector, only those 3 are returned. Item ranks come from the parent sector
snapshot (so a "banks" filter may show ranks 2, 4, 6 — the original positions
within the broader sector).

### 4.7 `POST /blog-newsletter/register`

Single-opt-in subscription (active immediately).

**Request body**

```json
{
  "email":         "you@email.com",
  "lang":          "pt",
  "consent":       true,
  "source":        "homepage_cta",  // optional
  "topics":        ["chatgpt"],     // optional
  "captchaToken":  "..."            // optional unless RECAPTCHA_SECRET_KEY is set
}
```

**Responses**

| Status | Body                                                                                                  |
|--------|-------------------------------------------------------------------------------------------------------|
| `202`  | `{ "status": "subscribed", "subscriberId": "sub_42" }`                                                |
| `409`  | `{ "error": "conflict", "message": "Already subscribed" }`                                            |
| `422`  | `{ "error": "validation_failed", "message": "Consent is required", "details": { "field": "consent" } }` |
| `422`  | `{ "error": "validation_failed", "message": "Invalid email",       "details": { "field": "email"   } }` |
| `400`  | `{ "error": "bad_request",       "message": "Invalid JSON body" }`                                    |
| `429`  | `{ "error": "rate_limited",      "message": "Too many requests" }` — sets `Retry-After`               |

In-memory rate limiting is applied per IP+email pair to deter abuse.
`Cache-Control: no-store`. Origin-restricted CORS (see §6).

---

## 5. Errors

All errors share this envelope:

```json
{ "error": "snake_case_code", "message": "Human-readable", "details": { ... } }
```

| HTTP | `error` code           | When                                                                 |
|------|------------------------|----------------------------------------------------------------------|
| 400  | `bad_request`          | Malformed JSON, missing required fields                              |
| 400  | `invalid_filter`       | Bad value for `?sort`, `?region`, `?period`, etc.                    |
| 401  | `unauthenticated`      | (admin only — never on public reads)                                 |
| 403  | `forbidden`            | (admin only)                                                         |
| 404  | `not_found`            | Slug missing in this locale                                          |
| 404  | `unsupported_lang`     | `{lang}` not in `pt`/`es`/`en` — `details.supported` lists locales   |
| 410  | `gone`                 | Article retracted                                                    |
| 422  | `validation_failed`    | Newsletter: missing/invalid consent or email                         |
| 429  | `rate_limited`         | Too many requests — sets `Retry-After` seconds                       |
| 500  | `internal_error`       | Generic server failure                                               |
| 503  | `upstream_unavailable` | Downstream dependency (e.g. reCAPTCHA) is down                       |

All errors set `Cache-Control: no-store`.

---

## 6. CORS

Public read endpoints respond with `Access-Control-Allow-Origin: *`. The
newsletter `POST` reflects the `Origin` header when it matches:

- `https://indexai.news` / `https://www.indexai.news` / `https://*.indexai.news`
- `https://*.vercel.app`
- `https://ainalytics.tech` / `https://*.ainalytics.tech`
- `http://localhost(:port)`

---

## 7. Wiring it into Next.js

### 7.1 Direct fetch (recommended)

```ts
// lib/blog-api.ts
const FUNCTIONS_BASE =
  process.env.NEXT_PUBLIC_BLOG_API_URL ??
  'https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1';

export type Lang = 'pt' | 'es' | 'en';

async function get<T>(path: string, revalidateSec = 300): Promise<T> {
  const res = await fetch(`${FUNCTIONS_BASE}${path}`, { next: { revalidate: revalidateSec } });
  if (res.status === 404) throw new NotFound();
  if (res.status === 410) throw new Gone();
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export const blog = {
  categories:    (lang: Lang) => get(`/blog-categories/${lang}`,            3600),
  newsList:      (lang: Lang, qs = '') => get(`/blog-news/${lang}${qs ? `?${qs}` : ''}`, 300),
  newsArticle:   (lang: Lang, slug: string) => get(`/blog-news/${lang}/${slug}`,         3600),
  trending:      (lang: Lang, limit = 10) => get(`/blog-trending/${lang}?limit=${limit}`, 300),
  ticker:        (lang: Lang) => get(`/blog-ticker/${lang}`,                60),
  rankingSectors:(lang: Lang) => get(`/blog-ranking-sectors/${lang}`,       3600),
  ranking:       (lang: Lang, qs: { sector?: string; subsector?: string; region?: string; q?: string; sort?: string; limit?: number } = {}) =>
    get(`/blog-ranking/${lang}${Object.keys(qs).length ? `?${new URLSearchParams(qs as Record<string, string>).toString()}` : ''}`, 300),

  registerNewsletter: (body: { email: string; lang: Lang; consent: boolean; source?: string; topics?: string[]; captchaToken?: string }) =>
    fetch(`${FUNCTIONS_BASE}/blog-newsletter/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json()),
};
```

### 7.2 Optional `vercel.ts` rewrites

Map your preferred URL shape (`/api/v1/...`) to the Functions URLs:

```ts
import { routes, type VercelConfig } from '@vercel/config/v1';

const F = 'https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  rewrites: [
    routes.rewrite('/api/v1/categories/:lang',                      `${F}/blog-categories/:lang`),
    routes.rewrite('/api/v1/news/:lang/:slug',                      `${F}/blog-news/:lang/:slug`),
    routes.rewrite('/api/v1/news/:lang',                            `${F}/blog-news/:lang`),
    routes.rewrite('/api/v1/trending/:lang',                        `${F}/blog-trending/:lang`),
    routes.rewrite('/api/v1/ticker/:lang',                          `${F}/blog-ticker/:lang`),
    routes.rewrite('/api/v1/ranking-sectors/:lang',                 `${F}/blog-ranking-sectors/:lang`),
    routes.rewrite('/api/v1/ranking/:lang',                         `${F}/blog-ranking/:lang`),
    routes.rewrite('/api/v1/newsletter/register',                   `${F}/blog-newsletter/register`),
  ],
};
```

---

## 8. Smoke tests (curl)

```bash
F=https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1

# 1. Categories
curl "$F/blog-categories/pt"   | jq '.data.items[].slug'

# 2. News list — newest first, 5 items
curl "$F/blog-news/pt?limit=5" | jq '.data.items[].slug'

# 2'. News list — search + category + sort
curl "$F/blog-news/en?q=traffic&category=research&sort=published_at:desc" | jq '.data.items[].title'

# 2''. Single article
curl "$F/blog-news/en/new-traffic-war-chatgpt-gemini-perplexity" | jq '.data.title, .seo.ogImage'

# 3. Trending — homepage payload
curl "$F/blog-trending/pt"     | jq '.data.featured.title, (.data.items | length)'

# 4. Ticker
curl "$F/blog-ticker/pt"       | jq '.data.items[].label'

# 5. Ranking sectors — list canonical taxonomy (10 sectors × 5 subsectors)
curl "$F/blog-ranking-sectors/pt" | jq '.data.items[] | {id, label, subsectors: (.subsectors | length)}'

# 6a. Ranking — top 10 BR fintech-neobanks
curl "$F/blog-ranking/pt?sector=financial-services&subsector=fintech-neobanks&limit=10" \
  | jq '.data.items[] | {rank, name, subsectorLabel, score}'

# 6b. Ranking — global tech AI platforms (default region=us, falls back to global)
curl "$F/blog-ranking/en?sector=technology&subsector=ai-platforms&sort=score:desc" \
  | jq '.data.items[] | {rank, name, homepageDomain, score}'

# 7. Newsletter register
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test+sub@indexai.news","lang":"pt","consent":true}' \
  "$F/blog-newsletter/register"

# 8. Conditional GET — should return 304 with no body
ET=$(curl -sD - -o /dev/null "$F/blog-categories/pt" | awk '/^etag:/ {print $2}' | tr -d '\r')
curl -s -o /dev/null -w "%{http_code}\n" -H "If-None-Match: $ET" "$F/blog-categories/pt"

# 9. Unsupported language — 404 with details.supported
curl -s "$F/blog-categories/fr" | jq '.error, .details.supported'
```

---

## 9. Local development

```bash
npx supabase start                      # Postgres + Studio + Functions runtime
npx supabase migration up --local       # apply schema + seed
npm run functions                       # serve all blog-* functions
```

Then call `http://127.0.0.1:54321/functions/v1/blog-trending/pt`.

Use `npx supabase status -o env` to read the local `ANON_KEY`, but **public
endpoints don't require it** — they're served anonymously.

---

## 10. Ranking taxonomy reference

The 10 sectors × 5 subsectors are seeded canonically. Use these slugs in
`?sector=` and `?subsector=`. Brand counts below are the live production
totals as of 2026-04-28 (299 brands across all sectors).

| Sector slug             | Brands | Subsector slugs |
| ----------------------- | ------:| --------------- |
| `financial-services`    | 50     | `banks`, `fintech-neobanks`, `insurance`, `payments-wallets`, `wealth-investing` |
| `healthcare`            | 34     | `hospitals`, `health-plans`, `telehealth`, `pharma-brands`, `labs-diagnostics` |
| `education`             | 31     | `universities`, `business-schools`, `online-learning`, `k12-schools`, `bootcamps` |
| `retail-ecommerce`      | 19     | `marketplaces`, `grocery-ecommerce`, `electronics-retail`, `home-goods`, `pharmacy-retail` |
| `travel-hospitality`    | 23     | `hotels-resorts`, `airlines`, `otas-metasearch`, `vacation-rentals`, `tours-experiences` |
| `consumer-brands`       | 29     | `beauty-cosmetics`, `luxury-fashion`, `apparel-fast-fashion`, `sportswear`, `jewelry-watches` |
| `technology`            | 32     | `ai-platforms`, `cloud`, `cybersecurity`, `saas`, `mobile-operators` |
| `real-estate`           | 16     | `residential-developers`, `property-portals`, `brokerages`, `coworking`, `rental-platforms` |
| `automotive-mobility`   | 32     | `automakers`, `ev-brands`, `ride-hailing`, `car-rental-leasing`, `charging-networks` |
| `food-restaurants`      | 33     | `grocery-chains`, `quick-commerce`, `fast-food`, `coffee-chains`, `casual-dining` |

Initial seed regions per sector (other regions fall back to `global` until
their snapshot is published):

| Sector              | Regions seeded |
| ------------------- | -------------- |
| financial-services  | br, es, us |
| healthcare          | br, es, us |
| education           | br, global |
| retail-ecommerce    | br, es, us |
| travel-hospitality  | global |
| consumer-brands     | global |
| technology          | global |
| real-estate         | br, es, us |
| automotive-mobility | global |
| food-restaurants    | br, es, us |

The ingestion pipeline described in
[`ranking-research.md`](./ranking-research.md) overwrites these scores from
real prompt-response data on a weekly cadence (Monday freeze).

---

## 11. Quick reference

```
PROJECT_ID:      kjfvhiffsusdqphgjsdz
PROJECT_URL:     https://kjfvhiffsusdqphgjsdz.supabase.co
FUNCTIONS_URL:   https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1
LOCAL_FUNCTIONS: http://127.0.0.1:54321/functions/v1

PUBLIC AUTH:     none — all 7 endpoints are open
LANGS:           pt | es | en   (path segment)
LOCALES:         pt-BR | es-ES | en-US
DEFAULT LANG:    pt

RESPONSE SHAPE:  { "data": {...}, "seo": {...} }
ERROR SHAPE:     { "error": "code", "message": "...", "details": {...} }
TIMESTAMPS:      ISO 8601 UTC, e.g. "2026-04-23T12:00:00+00:00"
DATES (period):  ISO 8601 date,  e.g. "2026-04-21"
CACHING:         ETag (weak) + Cache-Control public/SWR; honor If-None-Match
```

### 11.1 Deployed function names (verify with `npx supabase functions list`)

```
blog-categories       blog-news
blog-trending         blog-ticker
blog-ranking-sectors  blog-ranking
blog-newsletter       blog-admin (super-admin only — separate concern)
```

All 8 functions are ACTIVE in production. Public endpoints (the 7 listed
in §0) are deployed with `--no-verify-jwt`. The 8th, `blog-admin`, sits
behind super-admin auth and is not part of this integration contract.
