# Index AI — API Changes Punchlist

A delta document for the backend team. Lists every contract change the
front-end now expects, organized so each section can be picked up
independently.

- **Date:** 2026-04-27
- **Driver:** SEO/GEO audit + new "view-all" news-index page (front-end PR)
- **Companion docs (already updated):** `api.md`, `INTEGRATION.md`,
  `api-implementation.md`, `seeds/*.json`, `seeds/README.md`

---

## Legend

- 🆕 **New** — field/endpoint that didn't exist before
- 🔄 **Change** — existing field whose value/format/semantics shifts
- 🧹 **Cleanup** — backend can drop the field/endpoint; front-end no
  longer consumes it
- ℹ️ **No-op** — front-end ships a new surface, but it's powered by
  existing endpoints; **no backend work required**, listed for awareness

---

## 1. Blog news article detail — `GET /blog-news/{lang}/{slug}`

### 1.1 🆕 `data.sources[]`

External / academic works the article cites. Emitted by the front-end as
`NewsArticle.citation[]` JSON-LD (Schema.org). **Distinct** from the
engine citation tracker (`articles-citations.json`) — those are two
unrelated concepts. Both can coexist on the same article.

```json
{
  "data": {
    "...": "...",
    "sources": [
      { "name": "Universidade de São Paulo", "url": "https://www5.usp.br/" },
      { "name": "IE Business School",        "url": "https://www.ie.edu/business-school/" }
    ]
  }
}
```

| Constraint | Value |
|---|---|
| Required | yes (return `[]` when none) |
| Locale | locale-agnostic (sources are URLs to canonical work pages) |
| Order | preserve editorial order |
| Schema (DB) | new table `article_sources(article_id, position, name, url)` — see `api-implementation.md` §4.6 |

### 1.2 🆕 `data.categoryId`

Stable id for the article's section. Already exposed on category objects;
add it directly on the article so the front-end can route the breadcrumb
section URL via `categoryPath(id, lang)` without round-tripping through
the localized label. Without this, locale-renamed labels break breadcrumb
URLs (verified bug in current production).

```json
{
  "data": {
    "category": { "id": "research", "slug": "pesquisa", "label": "Pesquisa" },
    "categoryId": "research",
    "...": "..."
  }
}
```

`category.id` and `categoryId` will hold the same value — pick one place
to expose it (top-level `categoryId` is simpler for consumers; nested
`category.id` is fine if `category` is always returned).

### 1.3 🔄 `data.keywords` — trim to 4–6 entries

Long keyword arrays are a **negative** GEO signal (Princeton GEO research:
keyword stuffing → −10% AI citation visibility). Cap at 6, prefer 4–5.

| Before | After |
|---|---|
| 11 keywords (`Generative Engine Optimization, GEO, AI search, ChatGPT, Gemini, Perplexity, Claude, Grok, brand visibility, LATAM, EMEA`) | 5 (`Generative Engine Optimization, AI search, ChatGPT, brand visibility, LATAM`) |

Editorial / CMS guidance: optimize for the queries we want to be cited
for, not for keyword density.

### 1.4 🔄 `data.author.url` — populate when available

The front-end now emits `Person.url` in `NewsArticle.author` JSON-LD when
present. Until author landing pages exist, leave `null`.

When the authors API ships (`/blog-authors/{lang}/{slug}` 🔮), populate
`author.url` with the canonical author profile URL.

### 1.5 🧹 No frontend reads of `body[].text` for SEO purposes

The front-end already uses `body[]` for rendering and word count. No
change — listed only because the SEO contract now also expects
`citation[]` data, and reviewers may ask "why not extract citations
from body". Answer: link extraction from prose is fragile; we expect
explicit `sources[]` instead.

---

## 2. Blog news list — `GET /blog-news/{lang}`

### 2.1 🆕 `items[].categoryId`

Same rationale as §1.2 — frontend prefers stable id over localized
label for routing. Already implicit (`category.id` exists in current
seeds), but document it as a guaranteed top-level field on each item.

```json
{
  "items": [
    {
      "id": "gen-search-traffic-war-2026",
      "section": "Pesquisa",
      "categoryId": "research",
      "...": "..."
    }
  ]
}
```

`section` is the localized human label for display. `categoryId` is the
stable id consumers join on.

---

## 3. Blog ranking — `GET /blog-ranking/{lang}`

### 3.1 🆕 `data.faq[]`

Localized Q&A list. The front-end emits this as `FAQPage` Schema.org
JSON-LD on `/{lang}/rankings`. **Highest-leverage GEO signal** for
AI-search citation (Perplexity, ChatGPT-Search), per Princeton GEO
research (~+40% citation visibility).

```json
{
  "data": {
    "...": "...",
    "faq": [
      {
        "question": "O que é o Índice Ainalytics de Visibilidade em IA (AVI)?",
        "answer":   "O AVI é a medida semanal de quão frequentemente uma marca aparece — e em qual posição — nas respostas geradas..."
      },
      {
        "question": "Como o AVI é calculado?",
        "answer":   "Cada semana monitoramos 4,2 milhões de consultas em seis motores generativos..."
      }
    ]
  }
}
```

| Constraint | Value |
|---|---|
| Required | yes (return `[]` when no FAQ; front-end omits the section + Schema) |
| Locale | per `lang` (different content per locale, not just translated) |
| Count | aim 4–6 entries |
| Order | preserve editorial order |
| Schema (DB) | new table `ranking_faq(region, sector, lang, position, question, answer)` — see `api-implementation.md` §4.7 |

**Suggested topic coverage for the AVI FAQ** (mirrors what the front-end
ships today as a static fallback):

1. What is the AVI?
2. How is it calculated?
3. Which engines are tracked?
4. How often is it updated?
5. What sectors/markets are covered?
6. What makes a brand's score go up or down?

**Reference data:** see `seeds/rankings-list.json` for the full localized
text in PT / ES / EN — the front-end's current static copy is the canonical
source.

### 3.2 🔄 `data.period.from` / `data.period.to` — ISO 8601 dates

The front-end joins them as `${from}/${to}` for `Report.temporalCoverage`
JSON-LD (Schema.org's required ISO 8601 range format). **Do not return
localized strings** in these fields.

```json
{
  "period": {
    "label": "weekly",
    "from": "2026-04-21",
    "to":   "2026-04-27"
  }
}
```

| Field | Format | Example |
|---|---|---|
| `period.label` | free-form locale-aware ("weekly", "Semana 17 · 21–27 de abril") | `"weekly"` |
| `period.from`  | ISO 8601 date `yyyy-mm-dd` (UTC, inclusive) | `"2026-04-21"` |
| `period.to`    | ISO 8601 date `yyyy-mm-dd` (UTC, inclusive) | `"2026-04-27"` |

If the API currently returns localized strings here, this is a
**breaking change** that needs to ship before the front-end can drop its
static fallback.

---

## 4. Site / publisher / logo

### 4.1 🔄 `publisher.logo.url` — `/brand/logo` (no `.png`)

The front-end now generates the logo via `app/brand/logo/route.tsx`
(`next/og` `ImageResponse`). The endpoint serves PNG but the path is
extension-less.

| Before | After |
|---|---|
| `https://indexai.news/brand/logo.png` | `https://indexai.news/brand/logo` |

Width / height stay `512 × 512`. Affects every response that embeds
publisher metadata: `articles-detail`, `categories-detail`, `homepage`.

(All seed JSONs already updated.)

### 4.2 ℹ️ Logo / icon hosting moved into the front-end

These are **front-end-only** routes — backend doesn't host them:

- `https://indexai.news/icon` — 32 × 32 favicon
- `https://indexai.news/apple-icon` — 180 × 180 apple-touch
- `https://indexai.news/brand/logo` — 512 × 512 logo
- `https://indexai.news/manifest.webmanifest`

The backend should reference these URLs but doesn't need to serve them.

---

## 5. Homepage — `GET /blog-trending/{lang}`

### 5.1 🧹 Engines section no longer rendered

The home-page `<Engines>` section ("Coverage by engine" — six engine
cards with sparklines) was removed. The front-end no longer reads
`content.engines.cards[]` from the homepage / trending payload.

| What | Status |
|---|---|
| Backend keeps returning it | ✅ safe (forward-compat for re-introducing the block) |
| Backend can stop returning it | ✅ also safe |
| Migration impact | none (front-end ignores it) |

Recommendation: keep returning it for now. When the dedicated
`/blog-engines/{lang}` endpoint ships (🔮), move all engine data there
and drop it from the homepage payload in a single coordinated release.

### 5.2 🧹 Engines link removed from primary nav

No API impact. The localized strings (`nav.engines` in the dictionary)
are still consumed by the prerendered HTML for backward compat — keep
returning them; the front-end just doesn't render an `<a>` for them
right now.

---

## 6. Search

### 6.1 🧹 `WebSite.potentialAction` SearchAction removed (front-end side)

The front-end no longer emits `potentialAction: { SearchAction → /search?q=… }`
in `WebSite` JSON-LD because the `/search` route doesn't exist.

When `/blog-search/{lang}?q=…` ships and the front-end builds `/search`,
re-add the SearchAction. **No API change in this revision** — listed so
backend doesn't accidentally rely on it appearing in the page HTML.

---

## 7. Author profile pages 🔮

The front-end is ready to consume `author.url` on article detail (§1.4)
to enrich `Person` JSON-LD. The backend dependency is the planned
authors API:

- `GET /blog-authors/{lang}` — list (🔮)
- `GET /blog-authors/{lang}/{slug}` — detail (🔮)

Once these ship, `author.url` should be populated on every article-detail
response with the canonical profile URL. No other front-end changes are
needed to switch over.

---

## 8. Front-end-only artifacts (no backend work)

These ship from the Next.js app and are powered by **existing**
endpoints. Listed so backend reviewers can confirm nothing new is needed:

| Front-end route | API source(s) | Notes |
|---|---|---|
| `/{lang}/categoria` · `/{lang}/category` (news index, "view all") | `/blog-news/{lang}?limit=N` | Synthetic CategoryResponse; CollectionPage JSON-LD |
| `/news-sitemap.xml` (Google News) | `/blog-news/{lang}` × 3 | Filters last 48 h published |
| `/{lang}/feed.xml` (Atom 1.0) | `/blog-news/{lang}` | Per-locale; Perplexity-friendly |
| `/sitemap.xml` (extended) | `/blog-news/{lang}`, `/blog-categories/{lang}`, ranking | Now also lists news-index URLs |
| `/icon` · `/apple-icon` · `/brand/logo` | none | `next/og` ImageResponse |
| `/manifest.webmanifest` | none | static |
| `/robots.txt` (extended) | none | bare host, lists both sitemaps |

---

## 9. JSON-LD shapes the front-end now emits

For backend reviewers who want to see what the new fields are *for*. The
front-end builds these in `lib/content/seo.ts` from API responses; the
backend never returns `<script>` tags.

| Schema.org type | Page | Source field(s) |
|---|---|---|
| `NewsArticle.citation[]` | `/[lang]/[slug]` | `data.sources[]` (§1.1) |
| `BreadcrumbList` (article section) | `/[lang]/[slug]` | `data.categoryId` (§1.2) |
| `FAQPage` | `/[lang]/rankings` | `data.faq[]` (§3.1) |
| `Report.temporalCoverage` | `/[lang]/rankings` | `data.period.from` / `period.to` (§3.2) |
| `CollectionPage` | `/[lang]/categoria \| category` | `/blog-news/{lang}` items (§8) |

---

## 10. Cleanup checklist for the backend team

In suggested order:

- [ ] **§3.2** — confirm `/blog-ranking/{lang}` returns `period.from` /
      `period.to` as ISO 8601 dates. If currently localized strings, plan
      a breaking change. (Highest priority — front-end will keep showing
      a stale week label until this lands.)
- [ ] **§3.1** — add `data.faq[]` to `/blog-ranking/{lang}`. Schema:
      `ranking_faq` table. Seed from `seeds/rankings-list.json`.
- [ ] **§1.1** — add `data.sources[]` to `/blog-news/{lang}/{slug}`.
      Schema: `article_sources` table. Seed from
      `seeds/articles-detail.json`.
- [ ] **§1.2 / §2.1** — surface `categoryId` on both article list items
      and article detail (or guarantee `category.id` is always present).
- [ ] **§1.3** — trim `data.keywords` to 4–6 entries per article.
      Editorial / CMS update, not schema.
- [ ] **§4.1** — update publisher logo URL to extension-less
      `/brand/logo`. Affects every response embedding publisher info.
- [ ] **§1.4 / §7** — populate `author.url` once the authors API ships.

No deletions are required; everything in §5 / §6 is a no-op on the
backend side.

---

## 11. Validation

Once the API changes ship, the front-end should be able to drop the
following static fallbacks (listed by source file for the migration PR):

| Static fallback | Replaces with API |
|---|---|
| `lib/content/repo.ts` `ARTICLE_META[id].citations` | `data.sources[]` from article detail |
| `lib/content/rankings.ts` `WEEK_START` / `WEEK_END` | `data.period.from` / `period.to` |
| `lib/content/rankings.ts` `PT.faq` / `ES.faq` / `EN.faq` | `data.faq[]` |
| `lib/content/repo.ts` localized `section` derived from `ARTICLE_CATEGORY[id]` | `data.categoryId` direct |

Keeping the fallbacks until then is fine — they're already structured to
match the API shape exactly.
