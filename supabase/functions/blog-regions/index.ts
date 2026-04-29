// blog-regions — GET /blog-regions/:lang
//
// Lean public endpoint that returns the list of geographic markets covered
// by the rankings (br / es / us / global), localized for the requested
// language. Use this to populate region filter dropdowns on the front end.
//
// For richer per-region data (currently none), use rankings endpoints
// directly with `?region=...`.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handlePublicCors, withPublicCors } from "../_shared/blog-cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { errors, jsonResponse } from "../_shared/blog-response.ts";
import { isSupportedLang, type Lang } from "../_shared/blog-langs.ts";
import { buildSeo, loadLocaleMeta } from "../_shared/blog-seo.ts";
import { createRequestLogger } from "../_shared/logger.ts";

interface Region {
  id: string;
  label: string;
  description: string;
  position: number;
}

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-regions", req);
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
      .from("blog_regions")
      .select("id, position")
      .eq("is_active", true)
      .order("position", { ascending: true });
    if (error) throw error;

    const ids = (rows || []).map((r: { id: string }) => r.id);
    const trMap = new Map<string, { label: string; description: string }>();
    if (ids.length > 0) {
      const { data: trRows } = await db
        .from("blog_region_translations")
        .select("region_id, lang, label, description")
        .in("region_id", ids)
        .in("lang", [lang, "en"]);
      type Tr = { region_id: string; lang: string; label: string; description: string };
      const byKey = new Map<string, Tr>();
      for (const r of (trRows || []) as Tr[]) byKey.set(`${r.region_id}::${r.lang}`, r);
      for (const id of ids) {
        const tr = byKey.get(`${id}::${lang}`) || byKey.get(`${id}::en`);
        trMap.set(id, { label: tr?.label ?? id, description: tr?.description ?? "" });
      }
    }

    const items: Region[] = (rows as Array<{ id: string; position: number }>).map((r) => {
      const tr = trMap.get(r.id) || { label: r.id, description: "" };
      return { id: r.id, label: tr.label, description: tr.description, position: r.position };
    });

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
    console.error("[blog-regions]", err);
    return logger.done(withPublicCors(errors.internal()));
  }
});
