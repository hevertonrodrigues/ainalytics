// blog-engines — GET /blog-engines/:lang
//
// Lean public endpoint that returns the flat list of AI engines tracked by
// the platform. Use this to populate engine filter dropdowns / chips on the
// front end. For the rich per-engine cards (with localized tags + bias
// paragraph used on the rankings page), use `/blog-engine-profiles/{lang}`.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handlePublicCors, withPublicCors } from "../_shared/blog-cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { errors, jsonResponse } from "../_shared/blog-response.ts";
import { isSupportedLang, type Lang } from "../_shared/blog-langs.ts";
import { buildSeo, loadLocaleMeta } from "../_shared/blog-seo.ts";
import { createRequestLogger } from "../_shared/logger.ts";

interface Engine {
  id: string;
  label: string;
  color: string;
  position: number;
}

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-engines", req);
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

    const { data: rows, error } = await db
      .from("blog_engines")
      .select("id, label, color, position")
      .eq("is_active", true)
      .order("position", { ascending: true });
    if (error) throw error;

    // The lean list keeps the parent label as-is (engine names like "ChatGPT"
    // are universal). The locale-specific tags+bias live on /blog-engine-profiles.
    const items: Engine[] = (rows as Array<{ id: string; label: string; color: string; position: number }>).map((r) => ({
      id: r.id, label: r.label, color: r.color, position: r.position,
    }));

    const seo = buildSeo({
      lang: lang as Lang,
      meta,
      path: `/${lang}/rankings`,
      title: `${meta.rankings_title} — ${meta.site_title}`,
      description: meta.rankings_description,
    });

    const response = await jsonResponse(
      { data: { items }, seo },
      {
        locale: seo.locale,
        canonicalUrl: seo.canonical,
        cacheControl: "public, s-maxage=3600, stale-while-revalidate=86400",
        ifNoneMatch: req.headers.get("if-none-match"),
      },
    );
    return logger.done(withPublicCors(response));
  } catch (err) {
    console.error("[blog-engines]", err);
    return logger.done(withPublicCors(errors.internal()));
  }
});
