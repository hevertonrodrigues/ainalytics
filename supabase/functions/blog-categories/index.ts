// blog-categories — GET /blog-categories/:lang
// Returns the localized category list with item counts.
// Response shape: { data, seo }
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handlePublicCors, withPublicCors } from "../_shared/blog-cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { errors, jsonResponse } from "../_shared/blog-response.ts";
import { absoluteUrl, isSupportedLang, type Lang } from "../_shared/blog-langs.ts";
import { buildSeo, loadLocaleMeta } from "../_shared/blog-seo.ts";
import { createRequestLogger } from "../_shared/logger.ts";

interface CategoryTransRow {
  category_id: string;
  lang: string;
  slug: string;
  label: string;
  description: string;
}

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-categories", req);
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
    const meta = await loadLocaleMeta(createAdminClient(), lang as Lang);

    const db = createAdminClient();
    const { data: rows, error } = await db
      .from("blog_category_translations")
      .select("category_id, lang, slug, label, description")
      .eq("lang", lang);
    if (error) throw error;

    // Sort by parent category position
    const ids = (rows || []).map((r: CategoryTransRow) => r.category_id);
    const positions = new Map<string, number>();
    if (ids.length) {
      const { data: cats } = await db.from("blog_categories").select("id, position").in("id", ids);
      for (const c of cats || []) positions.set((c as { id: string }).id, (c as { position: number }).position);
    }
    const sorted = [...((rows as CategoryTransRow[]) || [])].sort(
      (a, b) => (positions.get(a.category_id) || 0) - (positions.get(b.category_id) || 0),
    );

    // Per-category item counts (published articles)
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: artRows } = await db
        .from("blog_articles")
        .select("category_id")
        .eq("status", "published");
      for (const r of artRows || []) {
        const id = (r as { category_id: string }).category_id;
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }

    const segment = meta.category_segment;
    const items = sorted.map((r) => ({
      id: r.category_id,
      slug: r.slug,
      label: r.label,
      description: r.description,
      itemCount: counts.get(r.category_id) || 0,
      canonicalPath: `/${lang}/${segment}/${r.slug}`,
      canonicalUrl: absoluteUrl(`/${lang}/${segment}/${r.slug}`),
    }));

    const path = `/${lang}/${segment}`;
    const seo = buildSeo({
      lang: lang as Lang,
      meta,
      path,
      title: `${meta.categories_title} — ${meta.site_title}`,
      description: meta.categories_description || meta.site_description,
    });

    const response = await jsonResponse(
      { data: { lang, locale: seo.locale, segment, items }, seo },
      {
        locale: seo.locale,
        canonicalUrl: seo.canonical,
        cacheControl: "public, s-maxage=3600, stale-while-revalidate=604800",
        ifNoneMatch: req.headers.get("if-none-match"),
      },
    );
    return logger.done(withPublicCors(response));
  } catch (err) {
    console.error("[blog-categories]", err);
    return logger.done(withPublicCors(errors.internal()));
  }
});
