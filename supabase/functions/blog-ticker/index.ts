// blog-ticker — GET /blog-ticker/:lang
// Real-time engine signals shown at the top of every page.
// Response shape: { data, seo }
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handlePublicCors, withPublicCors } from "../_shared/blog-cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { errors, jsonResponse } from "../_shared/blog-response.ts";
import { isSupportedLang, type Lang } from "../_shared/blog-langs.ts";
import { buildSeo, loadLocaleMeta } from "../_shared/blog-seo.ts";
import { createRequestLogger } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-ticker", req);
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

    const { data, error } = await db
      .from("blog_ticker_items")
      .select("engine_id, label, value, trend, link_url, updated_at")
      .eq("lang", lang)
      .eq("is_active", true)
      .order("position");
    if (error) throw error;

    const items = (data || []).map((r: { engine_id: string | null; label: string; value: string; trend: string; link_url: string | null }) => ({
      engineId: r.engine_id,
      label: r.label,
      value: r.value,
      trend: r.trend,
      linkUrl: r.link_url,
    }));

    const lastUpdated = ((data || []) as Array<{ updated_at: string }>).reduce(
      (acc: string, r) => r.updated_at > acc ? r.updated_at : acc,
      "1970-01-01T00:00:00Z",
    );

    const seo = buildSeo({
      lang: lang as Lang,
      meta,
      path: `/${lang}`,
      title: meta.site_title,
      description: meta.site_description,
    });

    const response = await jsonResponse(
      { data: { lang, locale: seo.locale, lastUpdated, items }, seo },
      {
        locale: seo.locale,
        cacheControl: "public, s-maxage=60, stale-while-revalidate=300",
        lastModified: lastUpdated,
        ifNoneMatch: req.headers.get("if-none-match"),
      },
    );
    return logger.done(withPublicCors(response));
  } catch (err) {
    console.error("[blog-ticker]", err);
    return logger.done(withPublicCors(errors.internal()));
  }
});
