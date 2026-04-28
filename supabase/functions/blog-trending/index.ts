// blog-trending — GET /blog-trending/:lang
// Homepage payload: featured + trending news + meta + newsletter copy.
// Response shape: { data, seo }
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handlePublicCors, withPublicCors } from "../_shared/blog-cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { errors, jsonResponse } from "../_shared/blog-response.ts";
import { absoluteUrl, isSupportedLang, type Lang } from "../_shared/blog-langs.ts";
import { buildSeo, buildWebSiteLd, loadLocaleMeta } from "../_shared/blog-seo.ts";
import { createRequestLogger } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-trending", req);
  if (req.method === "OPTIONS") return handlePublicCors();
  if (req.method !== "GET") {
    return logger.done(withPublicCors(errors.badRequest(`Method ${req.method} not allowed`)));
  }

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const lang = segments[1];
    if (!isSupportedLang(lang)) {
      return logger.done(withPublicCors(errors.unsupportedLang(String(lang ?? ""))));
    }

    const db = createAdminClient();
    const meta = await loadLocaleMeta(db, lang as Lang);

    const limit = Math.max(1, Math.min(20, Number(url.searchParams.get("limit") || 10)));

    // Articles flagged for trending, ordered by trending_position ASC.
    // If we have fewer than `limit`, fill in with the most recent published.
    const { data: trendingRows, error } = await db
      .from("blog_articles")
      .select(`
        id, category_id, read_time_minutes, image_url, image_width, image_height,
        published_at, modified_at, trending_position,
        blog_article_translations!inner(slug, title, dek, image_alt, lang),
        blog_article_authors(author_id, position)
      `)
      .eq("status", "published")
      .eq("blog_article_translations.lang", lang)
      .not("trending_position", "is", null)
      .order("trending_position")
      .limit(limit);
    if (error) throw error;

    let pool = (trendingRows || []) as Array<TrendingRow>;

    if (pool.length < limit) {
      const have = new Set(pool.map((r) => r.id));
      const fillCount = limit - pool.length;
      const { data: fillRows } = await db
        .from("blog_articles")
        .select(`
          id, category_id, read_time_minutes, image_url, image_width, image_height,
          published_at, modified_at, trending_position,
          blog_article_translations!inner(slug, title, dek, image_alt, lang),
          blog_article_authors(author_id, position)
        `)
        .eq("status", "published")
        .eq("blog_article_translations.lang", lang)
        .order("published_at", { ascending: false })
        .limit(fillCount + pool.length);
      for (const f of (fillRows || []) as TrendingRow[]) {
        if (!have.has(f.id)) {
          pool.push(f);
          if (pool.length >= limit) break;
        }
      }
    }

    // Resolve author + category labels
    const authorIds = new Set<string>();
    const categoryIds = new Set<string>();
    for (const r of pool) {
      // deno-lint-ignore no-explicit-any
      for (const aa of (r.blog_article_authors as any[]) || []) authorIds.add(aa.author_id);
      categoryIds.add(r.category_id);
    }
    const authorMap = new Map<string, { id: string; name: string; role: string; image: string | null }>();
    if (authorIds.size > 0) {
      const [trRes, baseRes] = await Promise.all([
        db.from("blog_author_translations").select("author_id, name, role").eq("lang", lang).in("author_id", Array.from(authorIds)),
        db.from("blog_authors").select("id, image_url").in("id", Array.from(authorIds)),
      ]);
      const imgMap = new Map<string, string | null>();
      for (const r of baseRes.data || []) imgMap.set((r as { id: string }).id, (r as { image_url: string | null }).image_url);
      for (const r of trRes.data || []) {
        const tr = r as { author_id: string; name: string; role: string };
        authorMap.set(tr.author_id, { id: tr.author_id, name: tr.name, role: tr.role, image: imgMap.get(tr.author_id) || null });
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

    const teasers = pool.map((a) => {
      const tr = Array.isArray(a.blog_article_translations) ? a.blog_article_translations[0] : a.blog_article_translations;
      // deno-lint-ignore no-explicit-any
      const aas = ((a.blog_article_authors as any[]) || []).slice().sort((x, y) => (x.position || 0) - (y.position || 0));
      const firstAuthor = aas[0] ? authorMap.get(aas[0].author_id) : null;
      const path = `/${lang}/${tr.slug}`;
      return {
        id: a.id,
        slug: tr.slug,
        title: tr.title,
        dek: tr.dek,
        category: catMap.get(a.category_id) || { id: a.category_id, slug: "", label: "" },
        author: firstAuthor,
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
        trendingPosition: a.trending_position,
      };
    });

    const featured = teasers[0] || null;
    const items = teasers.slice(1);

    const path = `/${lang}`;
    const canonicalUrl = absoluteUrl(path);

    const seo = buildSeo({
      lang: lang as Lang,
      meta,
      path,
      title: meta.site_title,
      description: meta.site_description,
      ogType: "website",
      structuredData: buildWebSiteLd({
        url: canonicalUrl,
        name: meta.site_title,
        description: meta.site_description,
        publisher: {
          name: meta.publisher_name,
          url: meta.publisher_url,
          logo: { url: meta.publisher_logo_url, width: meta.publisher_logo_width, height: meta.publisher_logo_height },
        },
      }),
    });

    const data = {
      lang,
      locale: seo.locale,
      eyebrow: meta.trending_eyebrow,
      title: meta.trending_title,
      description: meta.trending_description,
      featured,
      items,
      newsletter: {
        eyebrow: meta.newsletter_eyebrow,
        title: meta.newsletter_title,
        text: meta.newsletter_text,
        placeholder: meta.newsletter_placeholder,
        button: meta.newsletter_button,
      },
      lastModified: pool[0]?.modified_at || null,
    };

    const response = await jsonResponse(
      { data, seo },
      {
        locale: seo.locale,
        canonicalUrl,
        cacheControl: "public, s-maxage=300, stale-while-revalidate=86400",
        lastModified: pool[0]?.modified_at,
        ifNoneMatch: req.headers.get("if-none-match"),
      },
    );
    return logger.done(withPublicCors(response));
  } catch (err) {
    console.error("[blog-trending]", err);
    return logger.done(withPublicCors(errors.internal()));
  }
});

interface TrendingRow {
  id: string;
  category_id: string;
  read_time_minutes: number;
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  published_at: string;
  modified_at: string;
  trending_position: number | null;
  // deno-lint-ignore no-explicit-any
  blog_article_translations: any;
  // deno-lint-ignore no-explicit-any
  blog_article_authors: any;
}
