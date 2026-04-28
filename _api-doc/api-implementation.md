# Index AI — API Implementation Guide

This is the build guide for the team implementing the Index AI public API.
It is the practical companion to:

- **`api.md`** — the API contract (request shapes, response shapes, status codes)
- **`seeds/*.json`** — the initial data exactly as the website ships today

If you are picking up this work, read those two first; this document tells
you *how* to build the backend that satisfies the contract.

---

## 1. Goals & non-goals

**Goals**

1. Be a drop-in replacement for the current `app/api/v1/*` route handlers
   in this Next.js repo, which currently read from `lib/i18n.ts`. The
   front-end must keep working with zero code changes.
2. Match the response shapes in `api.md` exactly — same field names,
   nesting, types, status codes, and headers.
3. Return localized content per a `[lang]` path segment (`pt`/`es`/`en`)
   — never infer locale from `Accept-Language`. The site's `proxy.ts`
   already handles user-facing locale negotiation; the API is dumb about
   it.
4. Be SEO-correct out of the box: every localized response carries
   `Content-Language`, `Link rel=canonical`, and one `Link rel=alternate`
   per supported locale.
5. Be cacheable at every layer (CDN, runtime cache, browser).

**Non-goals**

- Editorial / admin CRUD endpoints (separate admin API).
- Search-index maintenance (run as a separate job that consumes the same
  DB).
- Auth provider implementation — proxy whichever provider the team
  picks (Clerk recommended).

---

## 2. Recommended stack

The frontend is **Next.js 16 App Router** deployed on **Vercel Fluid
Compute**. The simplest correct architecture is to keep the API as
**Next.js Route Handlers** in the same repo, backed by a
managed Postgres from the Vercel Marketplace.

| Concern              | Choice                                              | Why                                                                                                |
| -------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| API runtime          | Next.js Route Handlers (Node.js 24 LTS)             | Already where the frontend lives; ships as Fluid Compute functions automatically                   |
| Database             | Neon Postgres (Vercel Marketplace)                  | Native integration, branchable, autoscaling, environment vars wired automatically                  |
| Hot read cache       | Vercel Runtime Cache API                            | Per-region KV cache shared across functions; tag-based invalidation                                |
| ORM / query builder  | Drizzle ORM                                         | Type-safe, lightweight, plays well with serverless Postgres                                        |
| Auth                 | Clerk (Vercel Marketplace)                          | Native integration, no token plumbing                                                              |
| Email / newsletter   | Resend                                              | Simple Vercel-friendly transactional email + audience APIs                                         |
| Search (v2)          | Postgres FTS → Meilisearch                          | Start with built-in, swap when query volume justifies                                              |
| Bot mitigation       | Vercel BotID                                        | Drop-in for newsletter / engagement endpoints                                                      |
| Observability        | Vercel Observability + OpenTelemetry                | Already in the platform                                                                            |

**If the team prefers a separate service** (Hono, Express, FastAPI,
NestJS), the contract in `api.md` is framework-agnostic — pick
whatever ships fastest for your team. The rest of this guide assumes the
recommended stack but the patterns transfer.

---

## 3. Project layout

If you keep the API in this Next.js repo, no new folders are needed:

```
app/api/v1/
  homepage/[lang]/route.ts          ✅ exists (replace mock with DB query)
  articles/[lang]/route.ts          ✅ exists
  articles/[lang]/[slug]/route.ts   ✅ exists
  articles/[lang]/[slug]/citations/route.ts   🔮 add
  articles/[lang]/[slug]/related/route.ts     🔮 add
  articles/[lang]/[slug]/history/route.ts     🔮 add
  articles/[lang]/[slug]/share/route.ts       🔮 add (POST)
  articles/[lang]/[slug]/listen/route.ts      🔮 add
  articles/[lang]/[slug]/bookmark/route.ts    🔮 add (POST/DELETE, auth)
  categories/[lang]/route.ts        ✅ exists
  categories/[lang]/[slug]/route.ts ✅ exists
  authors/[lang]/route.ts           🔮 add
  authors/[lang]/[slug]/route.ts    🔮 add
  engines/[lang]/route.ts           🔮 add
  engines/[lang]/[slug]/route.ts    🔮 add
  engines/[lang]/[slug]/articles/route.ts     🔮 add
  rankings/[lang]/route.ts          🔮 add
  ticker/[lang]/route.ts            🔮 add
  tags/[lang]/route.ts              🔮 add
  tags/[lang]/[slug]/route.ts       🔮 add
  search/[lang]/route.ts            🔮 add
  site/[lang]/route.ts              🔮 add
  newsletter/subscribe/route.ts     🔮 add (POST)
  newsletter/confirm/route.ts       🔮 add (POST)
  newsletter/unsubscribe/route.ts   🔮 add (POST)
  newsletter/preferences/route.ts   🔮 add (GET/PATCH, auth)
  citations/correct/route.ts        🔮 add (POST)
  citations/evidence/[id]/route.ts  🔮 add
  auth/{signup,signin,signout,refresh}/route.ts  🔮 add (proxy to Clerk)
  me/route.ts                       🔮 add (auth)
  me/preferences/route.ts           🔮 add (auth)
  me/bookmarks/route.ts             🔮 add (auth)

lib/
  db/
    client.ts                       Drizzle client singleton
    schema.ts                       Drizzle table definitions
    queries/
      articles.ts                   Reusable article queries (with filters)
      categories.ts
      authors.ts
      engines.ts
      rankings.ts
      ticker.ts
      site.ts
      search.ts
  api/
    response.ts                     Shared response helpers (etag, headers)
    pagination.ts                   Cursor encode/decode
    errors.ts                       Error envelope helper
  content/
    repo.ts                         🟡 currently file-backed; rewrite to call lib/db/queries
```

The frontend (`components/*.tsx`, `app/[lang]/...`) keeps importing from
`lib/content/repo.ts`. That module is the only thing that flips from
"reads `lib/i18n.ts`" to "reads Postgres" — the swap is hidden from the
rest of the app.

---

## 4. Database schema

Localized entities use a **translation table** pattern: one row per
entity in the parent table, plus one row per locale in a sibling
`*_translations` table. This keeps slugs unique per locale, makes
locale filtering cheap, and supports locale-specific full-text indexes.

System-level translatable copy (footer, ticker labels, ranking
headlines) where every locale always has a value uses **JSONB columns**
keyed by `lang` for simplicity.

> Stable IDs are short slugs (e.g. `gen-search-traffic-war-2026`,
> `mariana-duarte`, `research`). Use them as primary keys to keep joins
> readable in logs and to allow IDs to outlive any one DB instance.
> Internal sequences live on event-log / snapshot tables only.

### 4.1 Languages

```sql
CREATE TABLE languages (
  code         TEXT PRIMARY KEY,            -- 'pt', 'es', 'en'
  locale       TEXT NOT NULL,               -- 'pt-BR', 'es-ES', 'en-US'
  label        TEXT NOT NULL,               -- 'Português'
  is_default   BOOLEAN NOT NULL DEFAULT false,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  position     INT NOT NULL DEFAULT 0
);
```

Seed from `seeds/site.json/data.<lang>.languages`.

### 4.2 Authors

```sql
CREATE TABLE authors (
  id           TEXT PRIMARY KEY,            -- 'mariana-duarte'
  email        TEXT UNIQUE,
  image_url    TEXT,
  social       JSONB,                       -- { x, linkedin, email }
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE author_translations (
  author_id    TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL REFERENCES languages(code),
  name         TEXT NOT NULL,               -- usually identical across locales
  role         TEXT NOT NULL,               -- localized
  bio          TEXT,
  PRIMARY KEY (author_id, lang)
);
```

Seed from `seeds/authors-list.json` + `seeds/authors-detail.json`.

### 4.3 Categories

```sql
CREATE TABLE categories (
  id           TEXT PRIMARY KEY,            -- 'research'
  position     INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE category_translations (
  category_id  TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL REFERENCES languages(code),
  slug         TEXT NOT NULL,               -- 'pesquisa' / 'investigacion' / 'research'
  label        TEXT NOT NULL,
  description  TEXT NOT NULL,
  seo_title    TEXT,
  PRIMARY KEY (category_id, lang),
  UNIQUE (lang, slug)
);

CREATE INDEX idx_category_translations_slug ON category_translations(lang, slug);
```

Seed from `seeds/categories-list.json` + `seeds/categories-detail.json`.

### 4.4 Tags

```sql
CREATE TABLE tags (
  id           TEXT PRIMARY KEY,            -- 'chatgpt', 'fintech'
  is_engine    BOOLEAN NOT NULL DEFAULT false  -- engines/* tags surface badges
);

CREATE TABLE tag_translations (
  tag_id       TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL REFERENCES languages(code),
  slug         TEXT NOT NULL,
  label        TEXT NOT NULL,
  PRIMARY KEY (tag_id, lang),
  UNIQUE (lang, slug)
);
```

Seed from `seeds/tags-list.json`.

### 4.5 Engines

```sql
CREATE TABLE engines (
  id           TEXT PRIMARY KEY,            -- 'chatgpt', 'gemini', 'perplexity'
  vendor       TEXT,
  color        TEXT NOT NULL,               -- '#10A37F'
  short_name   TEXT NOT NULL,               -- 'GPT'
  position     INT NOT NULL DEFAULT 0
);

CREATE TABLE engine_translations (
  engine_id    TEXT NOT NULL REFERENCES engines(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL REFERENCES languages(code),
  name         TEXT NOT NULL,               -- usually same across locales
  citations_trend_30d TEXT,                  -- "+12% citações" / "+12% citas" / "+12% citations"
  user_base_label     TEXT,                  -- "2.1B prompts/mês"
  latest_headline     TEXT,                  -- shown on engine card
  latest_published_at TIMESTAMPTZ,
  latest_article_id   TEXT REFERENCES articles(id),
  PRIMARY KEY (engine_id, lang)
);

CREATE TABLE engine_metrics_daily (
  engine_id    TEXT NOT NULL REFERENCES engines(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  citations    INT NOT NULL DEFAULT 0,
  mentions     INT NOT NULL DEFAULT 0,
  queries      INT NOT NULL DEFAULT 0,
  PRIMARY KEY (engine_id, date)
);

CREATE INDEX idx_engine_metrics_date ON engine_metrics_daily(date DESC);
```

Sparkline values for `engines-list.json` come from a 30-day window of
`engine_metrics_daily` aggregated over `citations` (or whichever metric
is selected). Pre-compute or cache.

Seed from `seeds/engines-list.json` (the `sparkline.values` array goes
into 30 daily rows in `engine_metrics_daily`; `latest.*` populates
`engine_translations`).

### 4.6 Articles

```sql
CREATE TYPE article_status AS ENUM ('draft','scheduled','published','retracted');

CREATE TABLE articles (
  id              TEXT PRIMARY KEY,         -- 'gen-search-traffic-war-2026'
  category_id     TEXT NOT NULL REFERENCES categories(id),
  read_time_minutes INT NOT NULL,
  image_url       TEXT,
  image_width     INT,
  image_height    INT,
  status          article_status NOT NULL DEFAULT 'published',
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ NOT NULL,
  modified_at     TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_articles_published ON articles(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_articles_category ON articles(category_id, published_at DESC) WHERE status = 'published';

CREATE TABLE article_translations (
  article_id      TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  lang            TEXT NOT NULL REFERENCES languages(code),
  slug            TEXT NOT NULL,
  title           TEXT NOT NULL,
  dek             TEXT NOT NULL,
  display_date    TEXT NOT NULL,             -- '23 de abril, 2026'
  read_time_label TEXT NOT NULL,             -- '12 min'
  body            JSONB NOT NULL,            -- ArticleBlock[]
  toc             JSONB NOT NULL DEFAULT '[]', -- string[]
  ui              JSONB NOT NULL,            -- back/actions/citation labels
  sidebar_cta     JSONB NOT NULL,
  image_alt       TEXT,
  PRIMARY KEY (article_id, lang),
  UNIQUE (lang, slug)
);

CREATE INDEX idx_article_translations_slug ON article_translations(lang, slug);

-- Body FTS index (per locale config)
CREATE INDEX idx_article_translations_body_pt ON article_translations
  USING gin (to_tsvector('portuguese', title || ' ' || dek || ' ' || body::text))
  WHERE lang = 'pt';
CREATE INDEX idx_article_translations_body_es ON article_translations
  USING gin (to_tsvector('spanish',    title || ' ' || dek || ' ' || body::text))
  WHERE lang = 'es';
CREATE INDEX idx_article_translations_body_en ON article_translations
  USING gin (to_tsvector('english',    title || ' ' || dek || ' ' || body::text))
  WHERE lang = 'en';

CREATE TABLE article_authors (
  article_id  TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES authors(id),
  position    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, author_id)
);

CREATE TABLE article_tags (
  article_id  TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id),
  PRIMARY KEY (article_id, tag_id)
);

CREATE TABLE article_keywords (
  article_id  TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  keyword     TEXT NOT NULL,
  PRIMARY KEY (article_id, keyword)
);

CREATE TABLE article_citations (
  article_id      TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  engine_id       TEXT NOT NULL,            -- e.g. 'chatgpt', 'gemini-2-5'
  status          TEXT NOT NULL CHECK (status IN ('yes','no','partial')),
  evidence_url    TEXT,
  last_seen_at    TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, engine_id)
);

CREATE TABLE article_revisions (
  id              BIGSERIAL PRIMARY KEY,
  article_id      TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  modified_at     TIMESTAMPTZ NOT NULL,
  summary         TEXT,
  diff            JSONB,                     -- per-locale field-level diff (optional)
  UNIQUE (article_id, version)
);
```

Seed from `seeds/articles-list.json`, `seeds/articles-detail.json`,
`seeds/articles-citations.json`.

### 4.7 Brands & Rankings

```sql
CREATE TABLE brands (
  id        TEXT PRIMARY KEY,                -- 'nubank', 'bbva'
  name      TEXT NOT NULL,
  country   CHAR(2),                         -- 'BR', 'ES', 'GLOBAL'
  sector    TEXT NOT NULL                    -- 'fintech', 'bank', 'retail'
);

CREATE TABLE sector_translations (
  sector    TEXT NOT NULL,
  lang      TEXT NOT NULL REFERENCES languages(code),
  label     TEXT NOT NULL,                   -- 'Banco', 'Bank', 'Banco'
  PRIMARY KEY (sector, lang)
);

CREATE TABLE ranking_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  period_label  TEXT NOT NULL,                -- 'weekly'
  period_from   DATE NOT NULL,
  period_to     DATE NOT NULL,
  region        TEXT NOT NULL,                -- 'br','es','mx',...
  sector        TEXT NOT NULL,                -- 'financial-services'
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_from, region, sector)
);

CREATE TABLE ranking_items (
  snapshot_id   BIGINT NOT NULL REFERENCES ranking_snapshots(id) ON DELETE CASCADE,
  rank          INT NOT NULL,
  brand_id      TEXT NOT NULL REFERENCES brands(id),
  score         INT NOT NULL,
  delta         TEXT NOT NULL,                -- '+6','-2','0'
  direction     TEXT NOT NULL CHECK (direction IN ('up','down','flat')),
  PRIMARY KEY (snapshot_id, rank)
);

CREATE TABLE ranking_headlines (
  region        TEXT NOT NULL,
  sector        TEXT NOT NULL,
  lang          TEXT NOT NULL REFERENCES languages(code),
  eyebrow       TEXT NOT NULL,
  title         TEXT NOT NULL,
  text          TEXT NOT NULL,
  table_title   TEXT NOT NULL,
  cta_label     TEXT NOT NULL,
  PRIMARY KEY (region, sector, lang)
);
```

Seed from `seeds/brands.json` (catalog) and `seeds/rankings-list.json`
(one snapshot for the 2026-04-20 → 2026-04-27 week).

### 4.8 Ticker

```sql
CREATE TABLE ticker_items (
  id           BIGSERIAL PRIMARY KEY,
  lang         TEXT NOT NULL REFERENCES languages(code),
  position     INT NOT NULL,
  engine_id    TEXT REFERENCES engines(id),  -- nullable for 'multi'/'ai-overviews'
  label        TEXT NOT NULL,                -- display name shown on ticker
  value        TEXT NOT NULL,
  trend        TEXT NOT NULL CHECK (trend IN ('up','down','neutral')),
  link_url     TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lang, position)
);
```

Seed from `seeds/ticker.json`.

### 4.9 Site shell + homepage components

These tables hold copy that's relatively static but per-locale. JSONB
columns are fine since the structure is small.

```sql
CREATE TABLE site_strings (
  lang         TEXT PRIMARY KEY REFERENCES languages(code),
  nav          JSONB NOT NULL,
  header       JSONB NOT NULL,
  footer       JSONB NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE homepage_hero (
  lang                 TEXT PRIMARY KEY REFERENCES languages(code),
  primary_article_id   TEXT NOT NULL REFERENCES articles(id),
  eyebrow              TEXT NOT NULL,
  tags                 JSONB NOT NULL,        -- string[]
  display_date         TEXT NOT NULL,         -- '23 de abril · 12 min de leitura'
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE homepage_sidebar_items (
  id                   BIGSERIAL PRIMARY KEY,
  lang                 TEXT NOT NULL REFERENCES languages(code),
  position             INT NOT NULL,
  title                TEXT NOT NULL,
  engine_id            TEXT,                  -- 'chatgpt'/'multi'/...
  engine_label         TEXT NOT NULL,         -- 'ChatGPT', 'Multi'
  time_label           TEXT NOT NULL,
  link_kind            TEXT NOT NULL,         -- 'article'
  link_article_id      TEXT REFERENCES articles(id),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (lang, position)
);

CREATE TABLE homepage_stories (
  id                   TEXT PRIMARY KEY,      -- 'story-pt-1'
  lang                 TEXT NOT NULL REFERENCES languages(code),
  position             INT NOT NULL,
  category_id          TEXT NOT NULL REFERENCES categories(id),
  title                TEXT NOT NULL,
  dek                  TEXT NOT NULL,
  author_id            TEXT REFERENCES authors(id),
  read_time_label      TEXT NOT NULL,
  date_label           TEXT NOT NULL,
  link_article_id      TEXT REFERENCES articles(id),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (lang, position)
);

CREATE TABLE homepage_latest (
  lang                 TEXT PRIMARY KEY REFERENCES languages(code),
  title                TEXT NOT NULL,
  title_em             TEXT NOT NULL,
  filters              JSONB NOT NULL          -- string[]
);

CREATE TABLE homepage_cta (
  lang                 TEXT PRIMARY KEY REFERENCES languages(code),
  eyebrow              TEXT NOT NULL,
  title                TEXT NOT NULL,
  title_em             TEXT NOT NULL,
  text                 TEXT NOT NULL,
  placeholder          TEXT NOT NULL,
  button               TEXT NOT NULL,
  quotes               JSONB NOT NULL          -- [{ engineId, label, text }]
);
```

Seed from `seeds/site.json` + `seeds/homepage.json`.

### 4.10 Newsletter, users, engagement

Build these only when implementing §11–14 of `api.md`.

```sql
CREATE TYPE subscriber_status AS ENUM ('pending','active','unsubscribed','bounced');

CREATE TABLE newsletter_subscribers (
  id                  BIGSERIAL PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  lang                TEXT NOT NULL REFERENCES languages(code),
  topics              JSONB NOT NULL DEFAULT '[]',
  source              TEXT,
  status              subscriber_status NOT NULL DEFAULT 'pending',
  confirmation_token  TEXT,
  unsubscribe_token   TEXT,
  subscribed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ,
  unsubscribed_at     TIMESTAMPTZ,
  unsubscribe_reason  TEXT
);

CREATE TABLE users (
  id                  TEXT PRIMARY KEY,         -- from Clerk
  email               TEXT NOT NULL UNIQUE,
  preferred_lang      TEXT NOT NULL DEFAULT 'pt' REFERENCES languages(code),
  preferred_theme     TEXT NOT NULL DEFAULT 'light',
  topics              JSONB NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bookmarks (
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id          TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  saved_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, article_id)
);

CREATE TABLE article_events (
  id                  BIGSERIAL PRIMARY KEY,
  article_id          TEXT REFERENCES articles(id),
  user_id             TEXT REFERENCES users(id),
  event_type          TEXT NOT NULL,            -- 'view','share','listen_start','bookmark','unbookmark'
  channel             TEXT,
  ip_hash             TEXT,
  user_agent          TEXT,
  referrer            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_article_events_article ON article_events(article_id, created_at DESC);
```

---

## 5. Endpoint implementation patterns

Every endpoint follows the same skeleton. Build one carefully and copy.

### 5.1 Skeleton

```ts
// app/api/v1/categories/[lang]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { listCategories } from '@/lib/db/queries/categories';
import { isSupportedLang, localeFor } from '@/lib/content/site';
import { jsonResponse, errorResponse } from '@/lib/api/response';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ lang: string }> },
) {
  const { lang } = await ctx.params;

  // 1) Validate path params — return early on bad input
  if (!isSupportedLang(lang)) {
    return errorResponse({
      status: 404,
      code: 'unsupported_lang',
      message: 'Locale not supported',
      details: { supported: ['pt', 'es', 'en'] },
    });
  }

  // 2) Fetch from DB (cached by Drizzle + Postgres connection pool)
  const payload = await listCategories(db, lang);

  // 3) Return with SEO + cache headers
  return jsonResponse(payload, {
    locale: localeFor(lang),
    canonicalUrl: `https://indexai.news/${lang}`,
    alternates: payload.items.length > 0 ? buildLangAlternates(lang) : null,
    cacheControl: 'public, s-maxage=3600, stale-while-revalidate=604800',
  });
}
```

### 5.2 `lib/api/response.ts` — the response helper

This is the single place that emits `Content-Language`, `Link rel=canonical`,
`Link rel=alternate`, `ETag`, and `Cache-Control`. Every route uses it.

```ts
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

export interface JsonResponseOpts {
  locale: string;                     // e.g. 'pt-BR'
  canonicalUrl?: string;
  alternates?: Record<string, string>; // hreflang → URL
  cacheControl?: string;
  status?: number;
}

export function jsonResponse(data: unknown, opts: JsonResponseOpts) {
  const body = JSON.stringify(data);
  const etag = `"${createHash('sha1').update(body).digest('base64url').slice(0, 16)}"`;

  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'content-language': opts.locale,
    etag,
    'cache-control':
      opts.cacheControl ?? 'public, s-maxage=300, stale-while-revalidate=86400',
  });

  if (opts.canonicalUrl) {
    const links = [`<${opts.canonicalUrl}>; rel="canonical"`];
    if (opts.alternates) {
      for (const [hreflang, url] of Object.entries(opts.alternates)) {
        links.push(`<${url}>; rel="alternate"; hreflang="${hreflang}"`);
      }
    }
    headers.set('link', links.join(', '));
  }

  return new NextResponse(body, { status: opts.status ?? 200, headers });
}

export function errorResponse(opts: {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}) {
  return NextResponse.json(
    { error: opts.code, message: opts.message, details: opts.details },
    { status: opts.status, headers: { 'cache-control': 'no-store' } },
  );
}
```

### 5.3 ETag-aware GET — handle `If-None-Match`

Wrap the response helper with a 304 check at the top of each handler:

```ts
const etag = computeEtag(payload);
const ifNoneMatch = request.headers.get('if-none-match');
if (ifNoneMatch === etag) {
  return new NextResponse(null, { status: 304, headers: { etag } });
}
return jsonResponse(payload, { etag, ... });
```

For tag-stable resources (article body, category metadata), `etag = sha1(body)`.
For frequently-updated resources (rankings, ticker), include `lastModified` in
the hash so cached browsers invalidate when data changes.

### 5.4 Cursor pagination

```ts
// lib/api/pagination.ts
import { Buffer } from 'node:buffer';

export interface Cursor { o: number; id: string }   // offset + last id (tiebreak)

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

export function decodeCursor(s: string | null): Cursor | null {
  if (!s) return null;
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')); }
  catch { return null; }
}
```

In your query: `WHERE (published_at, id) < ($cursorTs, $cursorId) ORDER BY published_at DESC, id DESC LIMIT $limit + 1`. The `+ 1` lets you compute `nextCursor` from the (limit+1)th row without a separate count query.

### 5.5 Localization JOIN pattern

Every list endpoint joins translations once. Example for articles:

```sql
SELECT
  a.id,
  at.slug,
  at.title,
  at.dek,
  c.id           AS category_id,
  COALESCE(json_agg(DISTINCT jsonb_build_object('name', auth_t.name)) FILTER (WHERE auth_t.author_id IS NOT NULL), '[]') AS authors,
  a.published_at,
  a.modified_at,
  a.read_time_minutes
FROM articles a
JOIN article_translations at ON at.article_id = a.id AND at.lang = $1
JOIN categories c             ON c.id = a.category_id
LEFT JOIN article_authors aa  ON aa.article_id = a.id
LEFT JOIN authors auth        ON auth.id = aa.author_id
LEFT JOIN author_translations auth_t
       ON auth_t.author_id = auth.id AND auth_t.lang = $1
WHERE a.status = 'published'
  AND ($categoryId IS NULL OR a.category_id = $categoryId)
ORDER BY a.published_at DESC, a.id DESC
LIMIT $limit;
```

For Drizzle, use `with: { translations: { where: eq(...) } }` and shape
the result to match the seed's `ArticleListItem`.

### 5.6 Building `alternates` (hreflang map)

For any localized resource, after fetching the row in the requested
locale, compute the alternate URLs for the other locales by querying the
same parent's other translations:

```ts
async function articleAlternates(articleId: string) {
  const rows = await db
    .select({ lang: at.lang, slug: at.slug })
    .from(articleTranslations)
    .where(eq(articleTranslations.articleId, articleId));

  const out: AlternateMap = {} as AlternateMap;
  for (const r of rows) {
    out[r.lang as Lang] = {
      path: `/${r.lang}/${r.slug}`,
      url:  `${BASE_URL}/${r.lang}/${r.slug}`,
      locale: localeFor(r.lang as Lang),
    };
  }
  return out;
}
```

Set the response's `Link rel=alternate` headers from the same map.

### 5.7 Caching strategy

Three layers, each with a different invalidation surface:

1. **CDN** (Vercel edge cache via `Cache-Control: s-maxage=...`). Default
   for all `GET`s. Hit by all unauthenticated requests.
2. **Vercel Runtime Cache API** — per-region key/value used inside
   handlers for reusable computed payloads (e.g. an article + its
   alternate-map) shared across function invocations within a region.
3. **Postgres** — read replicas for heavy list endpoints in v2.

Tag-based invalidation: when an article is published or modified, call
`revalidateTag('article:<id>')` plus `revalidateTag('lang:<lang>')` plus
`revalidateTag('category:<id>')`. Your route handlers register the tags
they belong to via `cacheTag` helpers when reading.

```ts
import { cacheTag, cacheLife } from 'next/cache';

async function getArticle(id: string, lang: string) {
  'use cache';
  cacheTag(`article:${id}`, `lang:${lang}`);
  cacheLife('hours');
  return db.query.articles.findFirst({ where: eq(articles.id, id), with: { ... } });
}
```

Per the API spec, recommended `s-maxage` per resource:

| Resource                                  | s-maxage | swr      | Tags                                                |
| ----------------------------------------- | -------- | -------- | --------------------------------------------------- |
| `articles/[lang]/[slug]`                  | `3600`   | `86400`  | `article:<id>`, `lang:<lang>`                       |
| `articles/[lang]` (list)                  | `300`    | `86400`  | `articles:list`, `lang:<lang>`                      |
| `articles/[lang]/[slug]/citations`        | `300`    | `3600`   | `article:<id>:citations`                            |
| `categories/*`                            | `3600`   | `604800` | `categories`, `lang:<lang>`                         |
| `homepage/[lang]`                         | `300`    | `86400`  | `homepage`, `lang:<lang>`                           |
| `engines/*`                               | `300`    | `86400`  | `engines`                                           |
| `rankings/[lang]`                         | `300`    | `86400`  | `rankings:<region>:<sector>`                        |
| `ticker/[lang]`                           | `60`     | `300`    | `ticker:<lang>`                                     |
| `tags/[lang]`, `authors/[lang]`           | `3600`   | `604800` | `tags`, `authors`                                   |
| `search/[lang]`                           | `0`      | `60`     | (no caching)                                        |

### 5.8 Error envelope

Always:

```json
{ "error": "snake_case_code", "message": "Human readable", "details": {...} }
```

with the `Cache-Control: no-store` on errors so a 404 doesn't get pinned
in CDN. The codes used:

| Status | Code                  | Used for                                         |
| ------ | --------------------- | ------------------------------------------------ |
| 400    | `bad_request`         | Malformed query params or body                   |
| 400    | `invalid_filter`      | Unknown `category` / `tag` / `engine` / etc.    |
| 401    | `unauthenticated`     | Missing / invalid bearer                         |
| 403    | `forbidden`           | Authenticated but lacking scope                  |
| 404    | `unsupported_lang`    | `lang` not in supported set                      |
| 404    | `not_found`           | Resource doesn't exist in this locale            |
| 410    | `gone`                | Article retracted (`status = 'retracted'`)       |
| 422    | `validation_failed`   | POST body fails schema                           |
| 429    | `rate_limited`        | + `Retry-After` header                           |
| 500    | `internal_error`      | Unhandled exception                              |
| 503    | `upstream_unavailable`| Citation tracker / TTS / search backend down     |

---

## 6. SEO contract (must implement)

These are **not optional** — the frontend's prerendered HTML uses them:

1. **Every localized GET sets `Content-Language: <bcp47>`.**
2. **Every localized GET sets `Link rel=canonical`** to the absolute URL
   of the resource in that locale.
3. **Every localized GET sets one `Link rel=alternate; hreflang=…`** per
   supported locale plus `hreflang="x-default"` pointing at the default
   (`pt`) URL.
4. **Article list / detail responses include `meta.alternates`** as a
   `{ pt, es, en }` map of `{ path, url, locale }`. The frontend uses it
   to render the language switcher and `<link rel=alternate>` tags. See
   `seeds/articles-detail.json` for the exact shape.
5. **Rates of change**: `Last-Modified` matches the resource's
   `modified_at` (article) / `lastUpdated` (ticker, rankings) so
   conditional GETs work.
6. **404 responses are not cached** (`Cache-Control: no-store`).
7. **JSON-LD generation stays in the frontend.** The API does not return
   `<script>` tags. Keep the API content-only; the frontend assembles
   JSON-LD from response data via `lib/content/seo.ts`.

---

## 7. Auth (when implementing user-state endpoints)

Use **Clerk** via the Vercel Marketplace integration; verify tokens at
the API edge.

```ts
// lib/api/auth.ts
import { auth } from '@clerk/nextjs/server';
import { errorResponse } from './response';

export async function requireUser() {
  const { userId } = await auth();
  if (!userId) {
    return { user: null, response: errorResponse({
      status: 401, code: 'unauthenticated', message: 'Bearer token required',
    })};
  }
  return { user: { id: userId }, response: null };
}
```

In a route:

```ts
export async function GET(req: Request, ctx: { ... }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  // ... user-scoped query using auth.user.id
}
```

Bookmarks, preferences, history all go through `requireUser()`.

---

## 8. Localization rules

1. **Slugs are unique within a locale, not globally.** `pesquisa` is a
   PT category slug; `pesquisa` could plausibly also be a Spanish
   author slug — fine, different table.
2. **Every translatable entity must exist in all active locales.**
   Enforce via a CHECK on `*_translations` or with a periodic data-quality
   job. The frontend's hreflang generation breaks when a locale is
   missing.
3. **Body content (`article_translations.body`) is JSONB**, not split
   into rows. The shape is `[{ type: 'p'|'h2'|'h3'|'blockquote', text: string }]`.
   Do not split into a separate `article_blocks` table — the frontend
   reads it as an opaque array.
4. **Dates** stored as `TIMESTAMPTZ` in UTC. The localized
   `display_date` strings (`'23 de abril, 2026'`) live alongside in
   `article_translations.display_date` because formatting rules
   (`'April 23, 2026'`, `'23 de abril, 2026'`) differ enough per locale
   that it's simpler to author them than compute.
5. **Engine and brand names are usually language-agnostic.** Store the
   canonical name on the parent table; only translate role/sector
   labels.

---

## 9. Testing with the seed JSONs

The files in `seeds/` are **golden fixtures**. Use them in two ways:

### 9.1 Initial DB seed

Write a single seed script that idempotently upserts every entity. Pick
your tool (`drizzle-kit seed`, raw SQL, a Node script). The script reads
each `seeds/*.json` and writes rows.

```ts
// scripts/seed.ts
import categoriesList from '../_api-doc/seeds/categories-list.json';
import categoriesDetail from '../_api-doc/seeds/categories-detail.json';
// ...

await db.transaction(async (tx) => {
  // 1) languages
  await tx.insert(languages).values([
    { code: 'pt', locale: 'pt-BR', label: 'Português', is_default: true, position: 1 },
    { code: 'es', locale: 'es-ES', label: 'Español',   is_default: false, position: 2 },
    { code: 'en', locale: 'en-US', label: 'English',   is_default: false, position: 3 },
  ]).onConflictDoNothing();

  // 2) categories — parents from any locale's items list (IDs are stable)
  await tx.insert(categories).values(
    categoriesList.data.pt.items.map((c, i) => ({ id: c.id, position: i }))
  ).onConflictDoNothing();

  // 3) category translations — one per (lang, id) pair
  for (const lang of ['pt', 'es', 'en']) {
    const langData = categoriesList.data[lang];
    for (const c of langData.items) {
      await tx.insert(categoryTranslations).values({
        category_id: c.id, lang, slug: c.slug, label: c.label,
        description: categoriesDetail.data[lang][c.slug].meta.description,
        seo_title:   categoriesDetail.data[lang][c.slug].meta.seoTitle,
      }).onConflictDoNothing();
    }
  }

  // ... repeat for authors, tags, engines, articles, brands, rankings, ticker, homepage_*, site_strings
});
```

### 9.2 Contract tests

For each endpoint, snapshot the response and diff it against the seed's
`data.<lang>.*` payload. This catches accidental field renames or
ordering bugs.

```ts
// test/contract/categories-list.test.ts
import seed from '../../_api-doc/seeds/categories-list.json';
import { GET } from '@/app/api/v1/categories/[lang]/route';

for (const lang of ['pt','es','en']) {
  test(`GET /api/v1/categories/${lang} matches seed`, async () => {
    const res = await GET(new Request(`https://test/api/v1/categories/${lang}`),
                          { params: Promise.resolve({ lang }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-language')).toMatch(/^(pt|es|en)-/);
    expect(res.headers.get('cache-control')).toContain('s-maxage=');
    const body = await res.json();
    expect(body).toEqual(seed.data[lang]);  // exact match
  });
}
```

If a deliberate change to the contract is needed, **update both**
`api.md` and the corresponding seed file in the same commit so
contract tests stay green.

---

## 10. Migration plan: file-mock → real backend

The current code path is:

```
Route Handler → lib/content/repo.ts → lib/i18n.ts (TS module)
```

Swap in three steps without breaking the frontend:

### Step 1 — DB ready, repo dual-mode (1 PR)

- Provision Neon, run schema migration, run the seed script.
- Add a `lib/db/queries/*.ts` module returning the same shapes the repo
  produces today.
- Behind a `DATA_SOURCE` env var (`file` | `db`), `lib/content/repo.ts`
  delegates to either the static dictionary or the DB queries. Default
  stays `file`.
- Run contract tests against both modes.

### Step 2 — Cut over (1 PR)

- Flip `DATA_SOURCE=db` in production.
- Watch metrics for 24 h. Roll back by flipping the env var.

### Step 3 — Remove the file backend (1 PR)

- Delete `lib/i18n.ts` and the `file` branch of the repo.
- Delete the `DATA_SOURCE` switch.

The frontend never knows the data moved.

---

## 11. Build order (recommended)

Roughly: data first, reads second, writes third, auth last.

1. **Schema migration + seed script** — get §4 in place; `npx drizzle-kit
   push` against a Neon dev branch. Validate by `SELECT *` matching the
   seeds.
2. **Languages, site, ticker, tags, authors, brands, engines reads**
   (the simple list endpoints; no joins beyond translations).
3. **Categories list + detail** — first endpoint with item embedding.
4. **Articles list (with filters) + detail + citations** — most
   complex queries; use this as the template for everything else.
5. **Homepage** — composes hero + sidebar + stories + cta.
6. **Engines detail + per-engine articles**.
7. **Rankings (with region/sector filters)**.
8. **Search (Postgres FTS)**.
9. **RSS feeds** (`/feed.xml`, per-locale, per-category).
10. **Newsletter subscribe / confirm / unsubscribe**.
11. **Auth (Clerk wiring) + `me/*` endpoints**.
12. **Engagement (share, listen, bookmark)**.
13. **Citation correction + evidence**.

Each step is independently shippable: the route handler exists today and
returns a hardcoded payload; you replace it with a DB query.

---

## 12. Pre-launch checklist

Before flipping production traffic:

- [ ] Every endpoint in `api.md` returns the exact shape from
      `seeds/*.json` (contract tests passing).
- [ ] Every localized `GET` returns `Content-Language`,
      `Link rel=canonical`, and `Link rel=alternate` headers including
      `x-default`.
- [ ] `If-None-Match` returns `304` with the matching `ETag`.
- [ ] Conditional `GET` with `If-Modified-Since` honors the resource's
      `modified_at`.
- [ ] CDN `s-maxage` values match the table in §5.7.
- [ ] `revalidateTag` is wired for: article publish/update, category
      change, ranking snapshot, ticker update.
- [ ] Rate limits in place on newsletter + share + bookmark + auth.
- [ ] BotID applied to every public POST.
- [ ] Postgres FTS indexes (per locale) created and populated.
- [ ] Sitemap regenerates daily and after every publish (`revalidatePath('/sitemap.xml')`).
- [ ] `robots.txt` allow-list reviewed for new AI crawlers.
- [ ] All 18 category URLs + 3 article URLs (per locale) prerender 200
      with full HTML in `next build`.
- [ ] Vercel Observability dashboards: API p95 < 200 ms, error rate
      < 0.1 %, cache hit rate > 80 % for read endpoints.
- [ ] Runbook for: rolling back a bad article, force-revalidating
      caches, regenerating ranking snapshot, rotating Clerk keys.

---

## 13. References

- API contract: `api.md`
- Seed data: `seeds/README.md` and `seeds/*.json`
- Frontend repo (this codebase): `app/`, `components/`, `lib/content/`
- Type reference: `lib/content/types.ts` (mirrors the JSON shapes)
- Vercel platform docs: [Fluid Compute](https://vercel.com/docs/functions/fluid-compute),
  [Runtime Cache](https://vercel.com/docs/runtime-cache),
  [Marketplace integrations](https://vercel.com/docs/integrations).
