# On-Demand Revalidation

The website prerenders pages with time-based ISR (5 min – 1 h windows). To make
new or edited content visible **immediately**, the admin platform that manages
the news must call the revalidation webhook after every write that affects
public content.

## Endpoint

```
POST https://indexai.news/api/revalidate
Content-Type: application/json
x-revalidate-secret: <REVALIDATE_SECRET>
```

`GET` with the same params is also accepted for one-off curl tests; production
integrations should use `POST`.

### Authentication

The request must include the shared secret in **either**:

- header `x-revalidate-secret: <REVALIDATE_SECRET>` *(preferred)*, or
- query string `?secret=<REVALIDATE_SECRET>` *(only if headers can't be set)*.

The secret value is set on Vercel as `REVALIDATE_SECRET` (Project → Settings →
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
`revalidateTag(tag, "max")` for each. `"max"` uses stale-while-revalidate: the
old page is served once more while a fresh render runs in the background, then
the next visitor sees the new content. There is no warm-up cost on the user
that triggers the publish.

### Response

```json
{
  "ok": true,
  "revalidated": ["blog:news:en", "blog:trending:en", "blog:ticker:en", "blog:article:my-slug"],
  "now": 1730122800000
}
```

Errors:

| Code | Reason |
|------|--------|
| 400  | Missing/unknown event, or no tags resolved |
| 401  | Missing or wrong `x-revalidate-secret` |
| 500  | `REVALIDATE_SECRET` not configured on the server |

## Event → tag mapping

The website's fetch layer (`lib/blog-api.ts`) tags every API response. The
webhook resolves an event into the matching set:

| Event                | Tags revalidated |
|----------------------|------------------|
| `article.published`  | `blog:news:{lang}`, `blog:trending:{lang}`, `blog:ticker:{lang}`, `blog:article:{slug}` |
| `article.updated`    | same as above |
| `article.deleted`    | same as above |
| `category.changed`   | `blog:categories:{lang}` |
| `ranking.updated`    | `blog:ranking:{lang}`, `blog:ranking-sectors:{lang}` |
| `purge`              | `blog` (umbrella — invalidates everything tagged `blog`) |

If the same article exists in multiple locales, fire **one request per locale**.

## When the admin should call it

| Admin action                                | Call |
|---------------------------------------------|------|
| Publish a draft                             | `article.published` for each locale of the article |
| Edit a published article (title, body, SEO)| `article.updated` for each locale |
| Unpublish / delete                          | `article.deleted` for each locale |
| Add / rename / reorder a category           | `category.changed` per locale |
| New ranking snapshot generated              | `ranking.updated` per locale |
| Bulk import or migration                    | `purge` once at the end |

Hot lists (trending, ticker) refresh inside `article.published`/`updated`/
`deleted`, so they don't need a separate call.

## Examples

### Curl (sanity check)

```bash
curl -X POST https://indexai.news/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -d '{"event":"article.published","lang":"en","slug":"openai-launches-x"}'
```

### Node / TypeScript (admin backend)

```ts
type Locale = "en" | "es" | "pt";
type Event =
  | "article.published" | "article.updated" | "article.deleted"
  | "category.changed" | "ranking.updated" | "purge";

const SITE_URL = process.env.SITE_URL ?? "https://indexai.news";
const SECRET = process.env.REVALIDATE_SECRET!;

export async function revalidateSite(
  event: Event,
  opts: { lang?: Locale; slug?: string } = {},
): Promise<void> {
  const res = await fetch(`${SITE_URL}/api/revalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-revalidate-secret": SECRET,
    },
    body: JSON.stringify({ event, ...opts }),
    // Don't block the user-facing publish flow on a slow site.
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    // Log but don't throw — the page will still refresh when its ISR
    // window expires (5 min for news, 1 h for articles/categories).
    const body = await res.text().catch(() => "");
    console.warn(`[revalidate] ${event}`, res.status, body);
  }
}

// After publishing an article in three locales:
await Promise.all([
  revalidateSite("article.published", { lang: "en", slug }),
  revalidateSite("article.published", { lang: "es", slug }),
  revalidateSite("article.published", { lang: "pt", slug }),
]);
```

### Supabase Edge Function trigger

If the admin is Supabase, call the webhook from a database trigger or the
function that owns the `publish` action:

```ts
// supabase/functions/publish-article/index.ts
const SITE_URL = Deno.env.get("SITE_URL")!;
const SECRET = Deno.env.get("REVALIDATE_SECRET")!;

await fetch(`${SITE_URL}/api/revalidate`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-revalidate-secret": SECRET,
  },
  body: JSON.stringify({ event: "article.published", lang, slug }),
});
```

Set `SITE_URL` and `REVALIDATE_SECRET` in
`supabase secrets set --env-file ./functions.env`.

## Operational notes

- **Idempotent**: calling the webhook twice for the same event is safe —
  `revalidateTag` just marks tags stale.
- **Non-blocking**: don't make the admin's publish UI wait for this. Fire and
  forget (or use a queue/retry) so a transient network hiccup never blocks
  publishing.
- **Failure mode**: if the webhook fails entirely, content still appears on the
  site once the ISR window expires (max 1 h for articles, 10 min for sitemap
  & feed). The webhook only changes *how fast*, not *whether*.
- **Rotating the secret**: deploy the new value to Vercel **first** (it
  immediately rejects the old one), then update the admin. A few seconds of
  401s during the swap are harmless — see "Failure mode".
- **Sitemaps & feeds** (`/news-sitemap.xml`, `/{lang}/feed.xml`) consume the
  same tagged fetches, so they refresh inside `article.*` events too.
- **Search results** (`?q=...`) bypass the cache by design and need no
  webhook.
