// blog-news
// GET /blog-news/:lang                       — list with optional q, category, sort, limit, cursor
// GET /blog-news/:lang/:slug                 — single article detail
//
// Response shape: { data, seo }
//   - List: data = { lang, locale, items[], page }
//   - Detail: data = { ...article }, seo includes article structuredData
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handlePublicCors, withPublicCors } from "../_shared/blog-cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { errors, jsonResponse } from "../_shared/blog-response.ts";
import { absoluteUrl, isSupportedLang, type Lang } from "../_shared/blog-langs.ts";
import { encodeCursor, resolvePagination } from "../_shared/blog-pagination.ts";
import { buildNewsArticleLd, buildSeo, loadLocaleMeta } from "../_shared/blog-seo.ts";
import { createRequestLogger } from "../_shared/logger.ts";

const ALLOWED_SORTS = new Set([
  "published_at:desc",
  "published_at:asc",
  "title:asc",
  "title:desc",
]);

// deno-lint-ignore no-explicit-any
type Db = any;

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-news", req);
  if (req.method === "OPTIONS") return handlePublicCors();
  if (req.method !== "GET") {
    return logger.done(withPublicCors(errors.badRequest(`Method ${req.method} not allowed`)));
  }

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    // segments: ["blog-news", lang, slug?]
    const lang = segments[1];
    const slug = segments[2];

    if (!isSupportedLang(lang)) {
      return logger.done(withPublicCors(errors.unsupportedLang(String(lang ?? ""))));
    }

    const db = createAdminClient();
    const meta = await loadLocaleMeta(db, lang as Lang);

    if (slug) return logger.done(withPublicCors(await handleDetail(req, db, lang as Lang, slug, meta)));
    return logger.done(withPublicCors(await handleList(req, db, lang as Lang, url, meta)));
  } catch (err) {
    console.error("[blog-news]", err);
    return logger.done(withPublicCors(errors.internal()));
  }
});

// ─── List ───────────────────────────────────────────────────────────────────

async function handleList(
  req: Request,
  db: Db,
  lang: Lang,
  url: URL,
  // deno-lint-ignore no-explicit-any
  meta: any,
): Promise<Response> {
  const { limit, cursor } = resolvePagination(url.searchParams);
  const q = (url.searchParams.get("q") || "").trim();
  const category = url.searchParams.get("category");
  const sort = url.searchParams.get("sort") || "published_at:desc";

  if (!ALLOWED_SORTS.has(sort)) {
    return errors.invalidFilter("sort", sort);
  }
  const [sortField, sortDir] = sort.split(":");
  const ascending = sortDir === "asc";

  let query = db
    .from("blog_articles")
    .select(`
      id, category_id, read_time_minutes, image_url, image_width, image_height,
      published_at, modified_at,
      blog_article_translations!inner(slug, title, dek, image_alt, lang),
      blog_article_authors(author_id, position),
      blog_article_tags(tag_id)
    `)
    .eq("status", "published")
    .eq("blog_article_translations.lang", lang)
    .limit(limit + 1);

  if (category) query = query.eq("category_id", category);
  if (q) {
    // Search across translation title + dek (case-insensitive partial)
    const escaped = q.replace(/[%_]/g, "\\$&");
    query = query.or(
      `title.ilike.%${escaped}%,dek.ilike.%${escaped}%`,
      { foreignTable: "blog_article_translations" },
    );
  }

  // Apply sort + cursor
  if (sortField === "title") {
    query = query.order("title", { ascending, foreignTable: "blog_article_translations" })
                 .order("id", { ascending });
  } else {
    // published_at
    query = query.order("published_at", { ascending }).order("id", { ascending });
    if (cursor) {
      query = ascending
        ? query.or(`published_at.gt.${cursor.v},and(published_at.eq.${cursor.v},id.gt.${cursor.i})`)
        : query.or(`published_at.lt.${cursor.v},and(published_at.eq.${cursor.v},id.lt.${cursor.i})`);
    }
  }

  const { data: rows, error } = await query;
  if (error) throw error;
  const all = (rows || []) as Array<{
    id: string; category_id: string; read_time_minutes: number;
    image_url: string | null; image_width: number | null; image_height: number | null;
    published_at: string; modified_at: string;
    // deno-lint-ignore no-explicit-any
    blog_article_translations: any;
    // deno-lint-ignore no-explicit-any
    blog_article_authors: any;
    // deno-lint-ignore no-explicit-any
    blog_article_tags: any;
  }>;

  // Resolve author/category/tag labels
  const authorIds = new Set<string>();
  const categoryIds = new Set<string>();
  const tagIds = new Set<string>();
  for (const r of all) {
    for (const aa of r.blog_article_authors || []) authorIds.add(aa.author_id);
    categoryIds.add(r.category_id);
    for (const tt of r.blog_article_tags || []) tagIds.add(tt.tag_id);
  }

  const authorMap = new Map<string, { name: string; role: string; image: string | null }>();
  if (authorIds.size > 0) {
    const [trRes, base] = await Promise.all([
      db.from("blog_author_translations").select("author_id, name, role").eq("lang", lang).in("author_id", Array.from(authorIds)),
      db.from("blog_authors").select("id, image_url").in("id", Array.from(authorIds)),
    ]);
    const imgMap = new Map<string, string | null>();
    for (const r of base.data || []) imgMap.set((r as { id: string }).id, (r as { image_url: string | null }).image_url);
    for (const r of trRes.data || []) {
      const tr = r as { author_id: string; name: string; role: string };
      authorMap.set(tr.author_id, { name: tr.name, role: tr.role, image: imgMap.get(tr.author_id) || null });
    }
  }

  const catMap = new Map<string, { id: string; slug: string; label: string }>();
  if (categoryIds.size > 0) {
    const { data: catRows } = await db
      .from("blog_category_translations")
      .select("category_id, slug, label")
      .eq("lang", lang)
      .in("category_id", Array.from(categoryIds));
    for (const r of catRows || []) {
      const c = r as { category_id: string; slug: string; label: string };
      catMap.set(c.category_id, { id: c.category_id, slug: c.slug, label: c.label });
    }
  }

  const tagMap = new Map<string, { id: string; slug: string; label: string }>();
  if (tagIds.size > 0) {
    const { data: tagRows } = await db
      .from("blog_tag_translations")
      .select("tag_id, slug, label")
      .eq("lang", lang)
      .in("tag_id", Array.from(tagIds));
    for (const r of tagRows || []) {
      const t = r as { tag_id: string; slug: string; label: string };
      tagMap.set(t.tag_id, { id: t.tag_id, slug: t.slug, label: t.label });
    }
  }

  const items = all.slice(0, limit).map((a) => {
    const tr = Array.isArray(a.blog_article_translations) ? a.blog_article_translations[0] : a.blog_article_translations;
    // deno-lint-ignore no-explicit-any
    const aas = (a.blog_article_authors as any[] || []).slice().sort((x, y) => (x.position || 0) - (y.position || 0));
    const firstAuthor = aas[0] ? authorMap.get(aas[0].author_id) : null;
    const path = `/${lang}/${tr.slug}`;
    const cat = catMap.get(a.category_id) || { id: a.category_id, slug: "", label: "" };
    return {
      id: a.id,
      slug: tr.slug,
      title: tr.title,
      dek: tr.dek,
      // Localized section label for display.
      section: cat.label,
      // Stable id for routing/joins (CHANGES.md §2.1).
      categoryId: a.category_id,
      category: cat,
      // deno-lint-ignore no-explicit-any
      tags: ((a.blog_article_tags as any[]) || []).map((t) => tagMap.get(t.tag_id)).filter(Boolean),
      author: firstAuthor ? {
        id: aas[0].author_id,
        name: firstAuthor.name,
        role: firstAuthor.role,
        image: firstAuthor.image,
        url: null as string | null,
      } : null,
      publishedAt: a.published_at,
      modifiedAt: a.modified_at,
      readTimeMinutes: a.read_time_minutes,
      image: a.image_url ? {
        url: a.image_url,
        width: a.image_width || 1200,
        height: a.image_height || 630,
        alt: tr.image_alt || tr.title,
      } : null,
      canonicalPath: path,
      canonicalUrl: absoluteUrl(path),
    };
  });

  const nextCursor = (sortField === "published_at" && all.length > limit)
    ? encodeCursor({ v: all[limit - 1].published_at, i: all[limit - 1].id })
    : null;

  // SEO for the news listing page (e.g. /pt/news or /pt/categoria/X)
  const path = category
    ? `/${lang}/${meta.category_segment}/${(catMap.get(category) || { slug: category }).slug}`
    : `/${lang}`;
  const pageTitle = category
    ? `${(catMap.get(category) || { label: category }).label} — ${meta.site_title}`
    : meta.site_title;
  const pageDesc = q
    ? `${meta.site_description}` // q is ephemeral
    : (category
        ? `${(catMap.get(category) || { label: category }).label} · ${meta.site_description}`
        : meta.site_description);

  const seo = buildSeo({
    lang,
    meta,
    path,
    title: pageTitle,
    description: pageDesc,
    ogType: "website",
  });

  return await jsonResponse(
    {
      data: {
        lang,
        locale: seo.locale,
        items,
        page: {
          limit,
          cursor: url.searchParams.get("cursor") || null,
          nextCursor,
          totalEstimate: items.length,
        },
        filters: { q: q || null, category: category || null, sort },
      },
      seo,
    },
    {
      locale: seo.locale,
      canonicalUrl: seo.canonical,
      cacheControl: q
        ? "public, s-maxage=0, stale-while-revalidate=60"
        : "public, s-maxage=300, stale-while-revalidate=86400",
      ifNoneMatch: req.headers.get("if-none-match"),
    },
  );
}

// ─── Detail ─────────────────────────────────────────────────────────────────

async function handleDetail(
  req: Request,
  db: Db,
  lang: Lang,
  slug: string,
  // deno-lint-ignore no-explicit-any
  meta: any,
): Promise<Response> {
  const { data: tr, error: trErr } = await db
    .from("blog_article_translations")
    .select("article_id, slug, title, dek, body, toc, image_alt, meta_keywords, display_date, read_time_label, updated_at")
    .eq("lang", lang)
    .eq("slug", slug)
    .single();

  if (trErr || !tr) return errors.notFound(`Article '${slug}' not found in '${lang}'`);

  const articleId = tr.article_id as string;

  const { data: article, error: aErr } = await db
    .from("blog_articles")
    .select("id, category_id, read_time_minutes, image_url, image_width, image_height, status, published_at, modified_at")
    .eq("id", articleId)
    .single();
  if (aErr || !article) return errors.notFound("Article not found");
  if (article.status === "retracted") return errors.gone("Article has been retracted");
  if (article.status !== "published") return errors.notFound("Article not published");

  // Sibling translations (for hreflang)
  const { data: altRows } = await db
    .from("blog_article_translations")
    .select("lang, slug")
    .eq("article_id", articleId);
  const alternatePaths: Partial<Record<Lang, string>> = {};
  for (const r of altRows || []) {
    const row = r as { lang: string; slug: string };
    if (row.lang === "pt" || row.lang === "es" || row.lang === "en") {
      alternatePaths[row.lang as Lang] = `/${row.lang}/${row.slug}`;
    }
  }

  // Author (first one)
  const { data: authorJoins } = await db
    .from("blog_article_authors")
    .select("author_id, position")
    .eq("article_id", articleId)
    .order("position");
  const authorIds = (authorJoins || []).map((a: { author_id: string }) => a.author_id);
  let author: { id: string; name: string; role: string; image: string | null; url: string | null } | null = null;
  if (authorIds.length) {
    const [trRes, base] = await Promise.all([
      db.from("blog_author_translations").select("author_id, name, role").eq("lang", lang).in("author_id", authorIds),
      db.from("blog_authors").select("id, image_url").in("id", authorIds),
    ]);
    const firstId = (authorJoins![0] as { author_id: string }).author_id;
    const trRow = (trRes.data || []).find((r: { author_id: string }) => r.author_id === firstId) as
      { author_id: string; name: string; role: string } | undefined;
    const baseRow = (base.data || []).find((r: { id: string }) => r.id === firstId) as
      { id: string; image_url: string | null } | undefined;
    if (trRow) {
      author = {
        id: firstId,
        name: trRow.name,
        role: trRow.role,
        image: baseRow?.image_url || null,
        // CHANGES.md §1.4 — populated when the authors API ships; null until then.
        url: null,
      };
    }
  }

  // Category
  const { data: catRow } = await db
    .from("blog_category_translations")
    .select("category_id, slug, label")
    .eq("category_id", article.category_id)
    .eq("lang", lang)
    .single();

  // Tags
  const { data: tagJoins } = await db
    .from("blog_article_tags")
    .select("tag_id")
    .eq("article_id", articleId);
  const tagIds = (tagJoins || []).map((r: { tag_id: string }) => r.tag_id);
  const { data: tagRows } = tagIds.length
    ? await db.from("blog_tag_translations").select("tag_id, slug, label").eq("lang", lang).in("tag_id", tagIds)
    : { data: [] };
  const tags = (tagRows || []).map((r: { tag_id: string; slug: string; label: string }) =>
    ({ id: r.tag_id, slug: r.slug, label: r.label }),
  );

  // Keywords (article-level, locale-agnostic) — fall back to translation-level meta_keywords
  const articleKeywords: string[] = (() => {
    if (Array.isArray(tr.meta_keywords) && tr.meta_keywords.length > 0) return tr.meta_keywords;
    return [];
  })();
  if (articleKeywords.length === 0) {
    const { data: kwRows } = await db
      .from("blog_article_keywords")
      .select("keyword, position")
      .eq("article_id", articleId)
      .order("position");
    for (const r of kwRows || []) articleKeywords.push((r as { keyword: string }).keyword);
  }

  // Sources — external/academic citations, locale-agnostic (CHANGES.md §1.1)
  const { data: sourceRows } = await db
    .from("blog_article_sources")
    .select("name, url, position")
    .eq("article_id", articleId)
    .order("position");
  const sources = (sourceRows || []).map((r: { name: string; url: string }) => ({ name: r.name, url: r.url }));

  const path = `/${lang}/${tr.slug}`;
  const canonicalUrl = absoluteUrl(path);
  const imageUrl = article.image_url || `${canonicalUrl}/opengraph-image`;

  const data = {
    id: article.id,
    slug: tr.slug,
    lang,
    title: tr.title,
    dek: tr.dek,
    body: tr.body,
    toc: tr.toc,
    categoryId: article.category_id,
    category: catRow ? { id: catRow.category_id, slug: catRow.slug, label: catRow.label } : null,
    tags,
    author,
    sources,
    publishedAt: article.published_at,
    modifiedAt: article.modified_at,
    readTimeMinutes: article.read_time_minutes,
    readTimeLabel: tr.read_time_label,
    displayDate: tr.display_date,
    image: {
      url: imageUrl,
      width: article.image_width || 1200,
      height: article.image_height || 630,
      alt: tr.image_alt || tr.title,
    },
    canonicalPath: path,
    canonicalUrl,
  };

  const structuredData = buildNewsArticleLd({
    url: canonicalUrl,
    headline: tr.title,
    description: tr.dek,
    imageUrls: [imageUrl],
    datePublished: article.published_at,
    dateModified: article.modified_at,
    author: { name: author?.name || meta.publisher_name, url: author?.url ?? null },
    publisher: {
      name: meta.publisher_name,
      url: meta.publisher_url,
      logo: { url: meta.publisher_logo_url, width: meta.publisher_logo_width, height: meta.publisher_logo_height },
    },
    keywords: articleKeywords,
    section: catRow?.label || article.category_id,
    sources,
  });

  const seo = buildSeo({
    lang,
    meta,
    path,
    title: tr.title,
    description: tr.dek,
    keywords: articleKeywords,
    ogImage: imageUrl,
    ogImageAlt: tr.image_alt || tr.title,
    ogType: "article",
    twitterCard: "summary_large_image",
    publishedTime: article.published_at,
    modifiedTime: article.modified_at,
    alternatePaths,
    structuredData,
  });

  return await jsonResponse(
    { data, seo },
    {
      locale: seo.locale,
      canonicalUrl,
      cacheControl: "public, s-maxage=3600, stale-while-revalidate=86400",
      lastModified: article.modified_at,
      ifNoneMatch: req.headers.get("if-none-match"),
    },
  );
}
