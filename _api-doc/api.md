# Index AI — Blog API

Canonical reference for the **indexai.news** Blog API hosted on Ainalytics'
Supabase project. Single source of truth — supersedes `INTEGRATION.md`,
`REVALIDATION.md`, `RANKINGS_REQUIREMENTS.md`, `api.md` and
`api-implementation.md`.

> **Status:** all 9 public read endpoints + 1 write + 1 webhook deployed.
> Last updated: **2026-04-28**.

---

## 0. The endpoint map (TL;DR)

Public reads (no auth):

| #  | Purpose                       | Method | URL                                                                |
|----|-------------------------------|--------|--------------------------------------------------------------------|
| 1  | List categories               | GET    | `/blog-categories/{lang}`                                          |
| 2  | List news                     | GET    | `/blog-news/{lang}?q=&category=&sort=&limit=&cursor=`              |
| 2′ | News article detail           | GET    | `/blog-news/{lang}/{slug}`                                         |
| 3  | Trending feed (homepage)      | GET    | `/blog-trending/{lang}?limit=10`                                   |
| 4  | Ticker items                  | GET    | `/blog-ticker/{lang}`                                              |
| 5  | Ranking sectors + subsectors  | GET    | `/blog-ranking-sectors/{lang}`                                     |
| 6  | Ranking items (current week)  | GET    | `/blog-ranking/{lang}?q=&sector=&subsector=&region=&period=&sort=&limit=` |
| 7  | Ranking timeline (chart)      | GET    | `/blog-ranking-timeline/{lang}?weeks=12&top=5&region=&sector=`     |
| 8  | Engine profiles (cards)       | GET    | `/blog-engine-profiles/{lang}`                                     |

Public write:

| #  | Purpose                       | Method | URL                                                                |
|----|-------------------------------|--------|--------------------------------------------------------------------|
| 9  | Newsletter register           | POST   | `/blog-newsletter/register`                                        |

Admin webhook (shared-secret):

| #  | Purpose                       | Method | URL                                                                |
|----|-------------------------------|--------|--------------------------------------------------------------------|
| W1 | On-demand revalidation        | POST   | `https://indexai.news/api/revalidate`                              |

Every public read returns `{ data, seo }` — see §3.

---

## 1. Base URLs & auth

| Environment    | Functions base URL                                           |
|----------------|--------------------------------------------------------------|
| **Production** | `https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1`      |
| **Local dev**  | `http://127.0.0.1:54321/functions/v1`                        |

Project ID: `kjfvhiffsusdqphgjsdz`.

**No auth required for public endpoints.** Functions are deployed with
`--no-verify-jwt`, so calls work anonymously without an `Authorization` or
`apikey` header.

`{lang}` ∈ `pt | es | en` (path segment, no fallback — clients must send it
explicitly). Any other value returns `404 unsupported_lang` with the list of
accepted locales in `details.supported`.

---

## 2. Language handling

Every read endpoint accepts the language as the first path segment. The
response returns localized content for that language plus a
`Content-Language` header and `seo.locale` (BCP-47: `pt-BR`, `es-ES`, `en-US`).

```bash
curl https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1/blog-categories/pt
# Response Content-Language: pt-BR
```

### 2.1 Conditional GET (ETag → 304)

Every public read response carries a weak `ETag` (SHA-1 of the body, e.g.
`W/"a0f5b3c14cf7282c"`). Echo it back in `If-None-Match`; if the body hasn't
changed the server returns `304 Not Modified` with no body.
`If-Modified-Since` is **not** honored — use `If-None-Match`.

```bash
F=https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1
ET=$(curl -sD - -o /dev/null "$F/blog-categories/pt" | awk '/^etag:/ {print $2}' | tr -d '\r')
curl -sI -H "If-None-Match: $ET" "$F/blog-categories/pt"   # → 304
```

`Last-Modified` is also emitted on article detail and trending for display
purposes only.

---

## 3. The `seo` block (every read response)

Pre-render templates can map this object directly to `<head>` tags + JSON-LD.

```json
{
  "data": { /* endpoint-specific payload */ },
  "seo": {
    "title":            "...",                       // <title> + og:title
    "description":      "...",                       // <meta description> + og:description
    "keywords":         ["GEO", "ChatGPT", "..."],   // <meta keywords>
    "canonical":        "https://indexai.news/pt/...",
    "ogTitle":          "...",
    "ogDescription":    "...",
    "ogImage":          "https://...",
    "ogImageAlt":       "...",
    "ogType":           "website" | "article",
    "twitterCard":      "summary" | "summary_large_image",
    "twitterHandle":    "@indexai" | null,
    "publisher": {
      "name": "Ainalytics",
      "url":  "https://indexai.news",
      "logo": { "url": "https://indexai.news/brand/logo.png", "width": 512, "height": 512 }
    },
    "lang":             "pt",
    "locale":           "pt-BR",
    "alternates": [
      { "hreflang": "pt-BR", "href": "https://indexai.news/pt/..." },
      { "hreflang": "es-ES", "href": "https://indexai.news/es/..." },
      { "hreflang": "en-US", "href": "https://indexai.news/en/..." },
      { "hreflang": "x-default", "href": "https://indexai.news/pt/..." }
    ],
    "publishedTime":    "2026-04-23T12:00:00+00:00" | null,  // article only
    "modifiedTime":     "2026-04-24T09:00:00+00:00" | null,
    "robots":           "index,follow" | "noindex,nofollow",
    "structuredData":   { /* JSON-LD object — present on article detail and trending */ } | null
  }
}
```

Editorial tip: keep `seo.keywords` to **4–6 entries**. Long keyword lists
hurt AI-citation visibility (Princeton GEO research).

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
`categoria` (pt/es), `category` (en). `itemCount` is the count of *published*
articles in that category for the requested locale.

`Cache-Control: public, s-maxage=3600, stale-while-revalidate=604800`

### 4.2a `GET /blog-news/{lang}` — list

| Param      | Type   | Default              | Notes                                      |
|------------|--------|----------------------|--------------------------------------------|
| `q`        | string | —                    | partial match on title/dek                 |
| `category` | string | —                    | category id (e.g. `research`)              |
| `sort`     | enum   | `published_at:desc`  | also: `published_at:asc`, `title:asc/desc` |
| `limit`    | int    | `20` (max `50`)      | page size                                  |
| `cursor`   | string | —                    | opaque, from previous `page.nextCursor`    |

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
        "section": "Pesquisa",
        "categoryId": "research",
        "category": { "id": "research", "slug": "pesquisa", "label": "Pesquisa" },
        "tags": [{ "id": "chatgpt", "slug": "chatgpt", "label": "ChatGPT" }],
        "author": {
          "id": "mariana-duarte",
          "name": "Mariana Duarte",
          "role": "Editora-chefe · Ainalytics Research",
          "image": "https://indexai.news/authors/mariana-duarte.jpg",
          "url": null
        },
        "publishedAt": "2026-04-23T12:00:00+00:00",
        "modifiedAt":  "2026-04-24T09:00:00+00:00",
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

`Cache-Control` is `s-maxage=300` for normal lists, `s-maxage=0` when `?q=`
is present.

### 4.2b `GET /blog-news/{lang}/{slug}` — detail

```json
{
  "data": {
    "id": "gen-search-traffic-war-2026",
    "slug": "nova-batalha-trafego-chatgpt-gemini-perplexity",
    "lang": "pt",
    "title": "...",
    "dek": "...",
    "body": "<p>...</p>\n<h2>...</h2>\n<blockquote>...</blockquote>",
    "toc": ["O novo funil", "Os dados", "Quem ganhou"],
    "categoryId": "research",
    "category": { "id": "research", "slug": "pesquisa", "label": "Pesquisa" },
    "tags": [/* ... */],
    "author": { "id": "...", "name": "...", "role": "...", "image": "...", "url": null },
    "sources": [
      { "name": "Universidade de São Paulo", "url": "https://www5.usp.br/" }
    ],
    "publishedAt":  "2026-04-23T12:00:00+00:00",
    "modifiedAt":   "2026-04-24T09:00:00+00:00",
    "readTimeMinutes": 12,
    "readTimeLabel":   "12 min",
    "displayDate":     "23 de abril, 2026",
    "image": { "url": "...", "width": 1200, "height": 630, "alt": "..." },
    "canonicalPath": "/pt/...",
    "canonicalUrl":  "https://indexai.news/pt/..."
  },
  "seo": {
    "ogType": "article",
    "structuredData": {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "citation": [{ "@type": "CreativeWork", "name": "...", "url": "..." }]
    }
  }
}
```

`data.body` is an **HTML string** authored via the rich-text editor on
`/sa/blog/news/:id`. Render with React's `dangerouslySetInnerHTML`. Allowed
inline tags: `p`, `h2`, `h3`, `blockquote`, `ul`/`ol`/`li`, `a`, `strong`,
`em`, `s`, `br`. Bulk-import accepts the legacy block-array shape; the admin
endpoint converts it to HTML server-side, but the public API only returns
HTML.

`data.sources[]` is **always present** (returns `[]` when none) and
locale-agnostic. The frontend dumps it directly into
`NewsArticle.citation[]` JSON-LD.

Status codes: `200`, `404` (slug not found in this locale), `410` (article
retracted). `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.

### 4.3 `GET /blog-trending/{lang}?limit=10`

Homepage payload. Falls back to most-recent published when fewer than `limit`
articles are flagged trending. `featured` is the hero card and `items[]`
carries the remaining teasers (up to `limit - 1`); when no published articles
exist for the locale `featured` is null and `items` is empty.

```json
{
  "data": {
    "lang": "pt",
    "locale": "pt-BR",
    "eyebrow":     "Destaques",
    "title":       "Em alta no Index AI",
    "description": "As reportagens mais lidas sobre busca generativa...",
    "featured": { /* news teaser — same shape as items[] in §4.2a, nullable */ },
    "items":    [ /* up to limit-1 more news teasers */ ],
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
      "publisher": { /* Organization */ },
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://indexai.news/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  }
}
```

`Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`. The
`Last-Modified` header mirrors `data.lastModified`.

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

Returns the canonical 10-sector × 5-subsector taxonomy with brand counts.

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
          { "id": "banks",            "label": "Bancos",                 "brandCount": 17 },
          { "id": "fintech-neobanks", "label": "Fintech / Neobancos",    "brandCount": 9  },
          { "id": "insurance",        "label": "Seguros",                "brandCount": 8  },
          { "id": "payments-wallets", "label": "Pagamentos / Carteiras", "brandCount": 8  },
          { "id": "wealth-investing", "label": "Investimentos / Wealth", "brandCount": 8  }
        ]
      }
      /* … 9 more sectors … */
    ]
  },
  "seo": { /* SEO of the rankings page */ }
}
```

Sector ids: `financial-services, healthcare, education, retail-ecommerce,
travel-hospitality, consumer-brands, technology, real-estate,
automotive-mobility, food-restaurants`. Subsector ids are the slugs to pass
back to `/blog-ranking?sector=…&subsector=…`.

### 4.6 `GET /blog-ranking/{lang}` — current week leaderboard

| Param        | Type   | Default                                                     | Notes                                                                |
|--------------|--------|-------------------------------------------------------------|----------------------------------------------------------------------|
| `q`          | string | —                                                           | partial match on brand name, sector or subsector label               |
| `sector`     | string | —                                                           | sector id (e.g. `financial-services`)                                |
| `subsector`  | string | —                                                           | subsector id (e.g. `banks`) — applied at brand-level                 |
| `region`     | string | per-locale (`pt→br`, `es→es`, `en→us`); falls back to `global` | `br`, `es`, `us`, `global`                                       |
| `period`     | enum   | `weekly`                                                    | `weekly`, `monthly`, `quarterly`                                     |
| `sort`       | enum   | `rank:asc`                                                  | `rank:desc`, `score:asc/desc`, `name:asc/desc`, `delta:desc`         |
| `limit`      | int    | `50` (max `100`)                                            | page size                                                            |

Region fallback: if no snapshot exists for the requested region, the API
silently serves `region=global`. `data.filters.region` reports what was
actually served.

```json
{
  "data": {
    "lang": "en",
    "locale": "en-US",
    "title":       "AI Visibility Index (AVI)",
    "description": "The Ainalytics index blends citation frequency, ...",
    "period": {
      "label":      "weekly",
      "from":       "2026-04-20",
      "to":         "2026-04-27",
      "weekNumber": 17,
      "weekLabel":  "Week 17 · April 20–27, 2026"
    },
    "filters": { "region": "global", "sector": "technology", "subsector": null, "q": null, "sort": "rank:asc" },
    "stats": {
      "queriesAnalyzed":        4200000,
      "queriesAnalyzedDelta":   "+8.4%",
      "sectorsCovered":         127,
      "sectorsCoveredDelta":    "+3",
      "enginesMonitored":       ["chatgpt", "gemini", "claude", "perplexity", "grok", "copilot"],
      "enginesMonitoredDelta":  "0",
      "brandsIndexed":          2847,
      "brandsIndexedDelta":     "+142"
    },
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
        "score":      98,
        "delta":      "+1",
        "direction":  "up",
        "engineScores": {
          "chatgpt":    96,
          "gemini":     92,
          "claude":     89,
          "perplexity": 95,
          "grok":       88,
          "copilot":    91
        },
        "snapshotId": 13
      }
    ],
    "methodology": {
      "pillars": [
        { "id": "citation",     "name": "Citation frequency",       "description": "...", "weight": 35, "position": 1 },
        { "id": "position",     "name": "Position in answer",       "description": "...", "weight": 25, "position": 2 },
        { "id": "sentiment",    "name": "Sentiment",                "description": "...", "weight": 15, "position": 3 },
        { "id": "cross_engine", "name": "Cross-engine consistency", "description": "...", "weight": 15, "position": 4 },
        { "id": "semantic",     "name": "Semantic depth",           "description": "...", "weight": 10, "position": 5 }
      ]
    },
    "insights": [
      { "position": 1, "tag": "Insight #1", "title": "The money is in fintech",        "text": "..." },
      { "position": 2, "tag": "Insight #2", "title": "Long-form beats social signals", "text": "..." },
      { "position": 3, "tag": "Insight #3", "title": "Cross-engine wins compound",     "text": "..." }
    ],
    "faq": [
      { "question": "What is the Ainalytics AI Visibility Index (AVI)?", "answer": "..." }
      /* … up to 6 entries … */
    ]
  },
  "seo": { /* ... */ }
}
```

Field semantics (new fields marked **★**):

- `period.weekNumber` ★ — ISO 8601 week number (1–53). `null` when no snapshot.
- `period.weekLabel` ★ — locale-formatted, e.g.
  - en: `Week 17 · April 20–27, 2026`
  - pt: `Semana 17 · 20–27 de abril de 2026`
  - es: `Semana 17 · 20–27 de abril de 2026`
- `stats.*Delta` ★ — week-over-week delta vs. the immediately preceding
  snapshot for the same `(region, sector, period)`. Returns `null` when no
  prior snapshot exists.
  - `queriesAnalyzedDelta`: percentage with 1-decimal precision (`"+8.4%"`).
  - `sectorsCoveredDelta`, `enginesMonitoredDelta`, `brandsIndexedDelta`:
    absolute integer (`"+3"`, `"0"`).
- `stats.brandsIndexed` ★ — distinct brands across the served snapshots.
- `items[].engineScores` ★ — per-engine score map; keys must match
  `stats.enginesMonitored` and `/blog-engine-profiles` ids. Empty `{}` when
  the snapshot has not been populated yet.
- `methodology.pillars[]` ★ — AVI pillar copy, localized. `weight` totals 100.
- `insights[]` ★ — editorial cards bound to the served snapshot+lang.
  Empty `[]` when none authored.
- `faq[]` — most-specific match wins: `(region, sector, lang)` → `(region,
  null, lang)` → `(null, sector, lang)` → `(null, null, lang)`. Always
  present (returns `[]` when nothing matches). Frontend renders this as
  `FAQPage` JSON-LD.

`direction` ∈ `up | down | flat`. `entityType` ∈ `company | university |
school | hospital | government | nonprofit | brand`. `data.period.from` /
`data.period.to` are ISO 8601 dates; the frontend joins them as
`${from}/${to}` for `Report.temporalCoverage` JSON-LD.

**Subsector filter** (`?subsector=banks`) filters at brand level — ranks come
from the parent sector snapshot, so a `banks` filter may show ranks 2, 4, 6.

`Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`.

### 4.7 `GET /blog-ranking-timeline/{lang}` ★ NEW

Historical AVI lines for the rankings-page chart — score of the top-N brands
across the last `weeks` weekly snapshots.

| Param     | Type   | Default                                                     | Notes                                |
|-----------|--------|-------------------------------------------------------------|--------------------------------------|
| `weeks`   | int    | `12` (max `52`)                                             | how many weekly snapshots to include |
| `top`     | int    | `5`  (max `20`)                                             | number of top brands to expose       |
| `region`  | string | per-locale (`pt→br`, `es→es`, `en→us`); falls back to `global` | as in §4.6                        |
| `sector`  | string | —                                                           | optional sector filter               |

```json
{
  "data": {
    "region": "us",
    "sector": null,
    "top":    5,
    "weeks":  ["2026-W06", "2026-W07", "...", "2026-W17"],
    "periods": [
      { "from": "2026-02-09", "to": "2026-02-15" },
      { "from": "2026-02-16", "to": "2026-02-22" }
      /* … one entry per ISO week … */
    ],
    "lines": [
      {
        "brandId": "openai",
        "name":    "OpenAI",
        "color":   "#10A37F",
        "data":    [78, 79, 81, 82, 84, 85, 86, 88, 89, 90, 92, 94]
      }
      /* … `top` lines total. `data` may contain `null` for missing weeks … */
    ]
  },
  "seo": { /* SEO of the rankings page */ }
}
```

Top-N brands are picked from the **most recent** snapshot, then their score
is back-filled across the prior weeks (null when a brand was not in the
snapshot that week). `color` is provided so the frontend doesn't need a
separate brand-color catalog.

`Cache-Control: public, s-maxage=600, stale-while-revalidate=86400`.

### 4.8 `GET /blog-engine-profiles/{lang}` ★ NEW

Per-engine cards for the rankings page: id, label, color, localized tags
and bias paragraph.

```json
{
  "data": {
    "items": [
      {
        "id":    "chatgpt",
        "label": "ChatGPT",
        "color": "#10A37F",
        "tags":  ["Tier-1 media", "Wikipedia", "Reddit", "Recent content"],
        "bias":  "Tends to cite established editorial sources and well-indexed knowledge bases. ..."
      },
      { "id": "gemini",     "label": "Gemini",     "color": "#4285F4", "tags": [...], "bias": "..." },
      { "id": "claude",     "label": "Claude",     "color": "#D97757", "tags": [...], "bias": "..." },
      { "id": "perplexity", "label": "Perplexity", "color": "#1FB8CD", "tags": [...], "bias": "..." },
      { "id": "grok",       "label": "Grok",       "color": "#0F0F10", "tags": [...], "bias": "..." },
      { "id": "copilot",    "label": "Copilot",    "color": "#0078D4", "tags": [...], "bias": "..." }
    ]
  },
  "seo": { /* SEO of the rankings page */ }
}
```

`id` must match keys used in `/blog-ranking` `stats.enginesMonitored` and
`items[].engineScores`. New engines are added by inserting into
`blog_engine_profiles` (+ translations) — they flow through to the rankings
response automatically.

`Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.

### 4.9 `POST /blog-newsletter/register`

Single-opt-in subscription (active immediately).

**Request body**

```json
{
  "email":         "you@email.com",
  "lang":          "pt",
  "consent":       true,
  "source":        "homepage_cta",   // optional
  "topics":        ["chatgpt"],      // optional
  "captchaToken":  "..."             // optional unless RECAPTCHA_SECRET_KEY is set
}
```

**Responses**

| Status | Body                                                                                              |
|--------|---------------------------------------------------------------------------------------------------|
| `202`  | `{ "status": "subscribed", "subscriberId": "sub_42" }`                                            |
| `409`  | `{ "error": "conflict",          "message": "Already subscribed" }`                               |
| `422`  | `{ "error": "validation_failed", "message": "Consent is required",  "details": { "field": "consent" } }` |
| `422`  | `{ "error": "validation_failed", "message": "Invalid email",        "details": { "field": "email" } }`   |
| `400`  | `{ "error": "bad_request",       "message": "Invalid JSON body" }`                                |
| `429`  | `{ "error": "rate_limited",      "message": "Too many requests" }` — sets `Retry-After`           |

In-memory rate limiting is applied per IP+email pair. `Cache-Control:
no-store`. Origin-restricted CORS (see §6).

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
| 401  | `unauthenticated`      | Admin only — never on public reads                                   |
| 403  | `forbidden`            | Admin only                                                           |
| 404  | `not_found`            | Slug missing in this locale                                          |
| 404  | `unsupported_lang`     | `{lang}` not in `pt`/`es`/`en` — `details.supported` lists locales   |
| 410  | `gone`                 | Article retracted                                                    |
| 422  | `validation_failed`    | Newsletter: missing/invalid consent or email                         |
| 429  | `rate_limited`         | Too many requests — sets `Retry-After`                               |
| 500  | `internal_error`       | Generic server failure                                               |
| 503  | `upstream_unavailable` | Downstream dependency (e.g. reCAPTCHA) is down                       |

All errors set `Cache-Control: no-store`.

---

## 6. CORS

Public reads (`blog-categories`, `blog-news`, `blog-trending`, `blog-ticker`,
`blog-ranking-sectors`, `blog-ranking`, `blog-ranking-timeline`,
`blog-engine-profiles`) use a permissive CORS policy: any origin can call
them.

`blog-newsletter/register` is origin-restricted to `indexai.news` and
`localhost:3000` / `localhost:5173` (configurable via `SITE_URL`). Pre-flight
returns `Access-Control-Allow-Methods: POST, OPTIONS`.

The admin webhook at `https://indexai.news/api/revalidate` is
server-to-server and not intended to be called from a browser.

---

## 7. On-demand revalidation (admin webhook)

The website prerenders pages with time-based ISR (5 min – 1 h windows). To
make new or edited content visible **immediately**, call the revalidation
webhook from the admin platform after every write that affects public content.

### Endpoint

```
POST https://indexai.news/api/revalidate
Content-Type: application/json
x-revalidate-secret: <REVALIDATE_SECRET>
```

`GET` with the same query params is also accepted for one-off curl tests;
production integrations should use `POST`.

### Authentication

The shared secret can be passed in **either**:

- header `x-revalidate-secret: <REVALIDATE_SECRET>` *(preferred)*, or
- query string `?secret=<REVALIDATE_SECRET>` *(only when headers are unavailable)*.

The secret is set on Vercel as `REVALIDATE_SECRET` (Project → Settings →
Environment Variables, all environments). Generate with
`openssl rand -hex 32`. Rotate any time — update Vercel and the admin in the
same change.

### Request body

```ts
{
  event:
    | "article.published"
    | "article.updated"
    | "article.deleted"
    | "category.changed"
    | "ranking.updated"
    | "purge",
  lang?: "en" | "es" | "pt",   // required for all events except "purge"
  slug?: string,               // required for article.* events
  tags?: string[]              // optional, advanced — purges these tags as-is
}
```

The endpoint resolves the event into the right cache tags and calls
`revalidateTag(tag, "max")` for each. `"max"` uses stale-while-revalidate:
the old page is served once more while a fresh render runs in the
background.

### Event → tag mapping

| Event                | Tags revalidated                                                                       |
|----------------------|----------------------------------------------------------------------------------------|
| `article.published`  | `blog:news:{lang}`, `blog:trending:{lang}`, `blog:ticker:{lang}`, `blog:article:{slug}` |
| `article.updated`    | same as above                                                                          |
| `article.deleted`    | same as above                                                                          |
| `category.changed`   | `blog:categories:{lang}`                                                               |
| `ranking.updated`    | `blog:ranking:{lang}`, `blog:ranking-sectors:{lang}`, `blog:ranking-timeline:{lang}`, `blog:engine-profiles:{lang}` |
| `purge`              | `blog` (umbrella — invalidates everything tagged `blog`)                               |

If the same article exists in multiple locales, fire **one request per locale**.

### Responses

```json
{
  "ok": true,
  "revalidated": ["blog:news:en", "blog:trending:en", "blog:ticker:en", "blog:article:my-slug"],
  "now": 1730122800000
}
```

Errors:

| Code | Reason                                                       |
|------|--------------------------------------------------------------|
| 400  | Missing/unknown event, or no tags resolved                   |
| 401  | Missing or wrong `x-revalidate-secret`                       |
| 500  | `REVALIDATE_SECRET` not configured on the server             |

### Operational notes

- **Idempotent**: calling twice for the same event is safe.
- **Non-blocking**: don't make the admin's publish UI wait for this. Fire
  and forget (or use a queue with retries).
- **Failure mode**: if the webhook fails entirely, content still appears on
  the site once the ISR window expires (max 1 h for articles, 10 min for
  sitemap & feed).
- **Rotating the secret**: deploy the new value to Vercel **first**, then
  update the admin. A few seconds of 401s during the swap are harmless.
- **Sitemaps & feeds** (`/news-sitemap.xml`, `/{lang}/feed.xml`) consume the
  same tagged fetches, so they refresh inside `article.*` events too.
- **Search results** (`?q=...`) bypass the cache by design and need no
  webhook.

---

## 8. Smoke tests (curl)

```bash
F=https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1

# 1. Categories
curl -s "$F/blog-categories/pt" | jq '.data.items[0]'

# 2. News list — newest first, 5 items
curl -s "$F/blog-news/pt?limit=5&sort=published_at:desc" | jq '.data.items | length'

# 2'. Single article
curl -s "$F/blog-news/pt/some-slug" | jq '.data.title'

# 3. Trending
curl -s "$F/blog-trending/pt?limit=10" | jq '.data.items | length'

# 4. Ticker
curl -s "$F/blog-ticker/pt" | jq '.data.items | length'

# 5. Ranking sectors
curl -s "$F/blog-ranking-sectors/pt" | jq '.data.items | length'

# 6a. Ranking — top 10 BR fintech
curl -s "$F/blog-ranking/pt?sector=financial-services&subsector=fintech-neobanks&limit=10" | jq '.data.items[0]'

# 6b. Ranking — global tech AI platforms
curl -s "$F/blog-ranking/en?sector=technology&subsector=ai-platforms&region=global" | jq '.data.stats'

# 7. Ranking timeline — 12 weeks, top 5 brands, US fintech
curl -s "$F/blog-ranking-timeline/en?weeks=12&top=5&region=us&sector=financial-services" | jq '.data.lines[0]'

# 8. Engine profiles
curl -s "$F/blog-engine-profiles/pt" | jq '.data.items[].id'

# 9. Newsletter register
curl -s -X POST "$F/blog-newsletter/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","lang":"pt","consent":true}'

# Conditional GET — should return 304 with no body
ET=$(curl -sD - -o /dev/null "$F/blog-categories/pt" | awk '/^etag:/ {print $2}' | tr -d '\r')
curl -sI -H "If-None-Match: $ET" "$F/blog-categories/pt"

# Unsupported language — 404 with details.supported
curl -s "$F/blog-categories/de" | jq

# Revalidation webhook — purge everything blog-tagged
curl -X POST https://indexai.news/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -d '{"event":"purge"}'
```

---

## 9. Local development

```bash
npm install
npx supabase start && npx supabase db reset    # boots local Supabase + applies migrations
npm run dev                                     # frontend: http://localhost:5173
npm run functions                               # Edge Functions: http://127.0.0.1:54321/functions/v1
# or run all of the above with: npm run dev:all
```

To deploy a single function:

```bash
npx supabase functions deploy blog-ranking --no-verify-jwt
npx supabase functions deploy blog-ranking-timeline --no-verify-jwt
npx supabase functions deploy blog-engine-profiles --no-verify-jwt
```

Apply pending migrations to production: `npx supabase db push`.

---

## 10. Wiring it into Next.js (sketch)

```ts
// lib/blog-api.ts
const BASE = "https://kjfvhiffsusdqphgjsdz.supabase.co/functions/v1";

export async function getRankings(lang: "pt" | "es" | "en", opts: { sector?: string; subsector?: string; region?: string; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (opts.sector)    qs.set("sector",    opts.sector);
  if (opts.subsector) qs.set("subsector", opts.subsector);
  if (opts.region)    qs.set("region",    opts.region);
  if (opts.limit)     qs.set("limit",     String(opts.limit));
  const res = await fetch(`${BASE}/blog-ranking/${lang}?${qs}`, {
    next: { revalidate: 300, tags: [`blog:ranking:${lang}`] },
  });
  return res.json();
}

export async function getRankingTimeline(lang: "pt" | "es" | "en", weeks = 12, top = 5) {
  const res = await fetch(`${BASE}/blog-ranking-timeline/${lang}?weeks=${weeks}&top=${top}`, {
    next: { revalidate: 600, tags: [`blog:ranking-timeline:${lang}`] },
  });
  return res.json();
}

export async function getEngineProfiles(lang: "pt" | "es" | "en") {
  const res = await fetch(`${BASE}/blog-engine-profiles/${lang}`, {
    next: { revalidate: 3600, tags: [`blog:engine-profiles:${lang}`] },
  });
  return res.json();
}
```

The `tags` array lines up 1:1 with the `event → tag mapping` in §7, so a
`POST /api/revalidate` with `{ event: "ranking.updated", lang: "en" }`
revalidates all three Next.js fetch caches in one call.

---

## 11. Reference data

### 11.1 Engine ids

`chatgpt`, `gemini`, `claude`, `perplexity`, `grok`, `copilot`. These are
stable across the rankings, the engine profiles endpoint, and the per-item
`engineScores` map.

### 11.2 Sector ids

`financial-services`, `healthcare`, `education`, `retail-ecommerce`,
`travel-hospitality`, `consumer-brands`, `technology`, `real-estate`,
`automotive-mobility`, `food-restaurants`. Subsector ids are returned by
`/blog-ranking-sectors/{lang}`.

### 11.3 Region ids

`br`, `es`, `us`, `global`. Default region per locale: `pt → br`, `es → es`,
`en → us`. All regions fall back to `global` if no snapshot exists for the
requested `(region, sector, period)`.

### 11.4 Period labels

`weekly` (default), `monthly`, `quarterly`. Most production data is `weekly`.

### 11.5 Cache headers cheat sheet

| Endpoint                        | s-maxage | stale-while-revalidate |
|---------------------------------|----------|------------------------|
| `/blog-categories`              | 3600     | 604800                 |
| `/blog-news` (no `?q=`)         | 300      | 86400                  |
| `/blog-news` (with `?q=`)       | 0        | —                      |
| `/blog-news/{slug}`             | 3600     | 86400                  |
| `/blog-trending`                | 300      | 86400                  |
| `/blog-ticker`                  | 60       | 300                    |
| `/blog-ranking-sectors`         | 3600     | 86400                  |
| `/blog-ranking`                 | 300      | 86400                  |
| `/blog-ranking-timeline`        | 600      | 86400                  |
| `/blog-engine-profiles`         | 3600     | 86400                  |
| `/blog-newsletter/register`     | no-store | —                      |
| Errors (any endpoint)           | no-store | —                      |
