// blog-engine-profiles — GET /blog-engine-profiles/:lang
//
// Per-engine cards for the rankings page: id, label, color, localized tags
// and bias paragraph. Pure editorial copy, refreshed at the same cadence as
// the rankings.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handlePublicCors, withPublicCors } from "../_shared/blog-cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { errors, jsonResponse } from "../_shared/blog-response.ts";
import { isSupportedLang, type Lang } from "../_shared/blog-langs.ts";
import { buildSeo, loadLocaleMeta } from "../_shared/blog-seo.ts";
import { createRequestLogger } from "../_shared/logger.ts";

interface EngineProfile {
  id: string;
  label: string;
  color: string;
  tags: string[];
  bias: string;
}

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-engine-profiles", req);
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

    const { data: profileRows, error } = await db
      .from("blog_engine_profiles")
      .select("id, label, color, position")
      .eq("is_active", true)
      .order("position", { ascending: true });
    if (error) throw error;

    const ids = (profileRows || []).map((p: { id: string }) => p.id);
    let tagsBias = new Map<string, { tags: string[]; bias: string }>();
    if (ids.length > 0) {
      const { data: trRows } = await db
        .from("blog_engine_profile_translations")
        .select("engine_id, lang, tags, bias")
        .in("engine_id", ids)
        .in("lang", [lang, "en"]);
      type Tr = { engine_id: string; lang: string; tags: string[]; bias: string };
      const byKey = new Map<string, Tr>();
      for (const r of (trRows || []) as Tr[]) byKey.set(`${r.engine_id}::${r.lang}`, r);
      for (const id of ids) {
        const tr = byKey.get(`${id}::${lang}`) || byKey.get(`${id}::en`);
        tagsBias.set(id, { tags: tr?.tags ?? [], bias: tr?.bias ?? "" });
      }
    }

    const profiles: EngineProfile[] = (profileRows as Array<{ id: string; label: string; color: string }>).map((p) => {
      const tb = tagsBias.get(p.id) || { tags: [], bias: "" };
      return { id: p.id, label: p.label, color: p.color, tags: tb.tags, bias: tb.bias };
    });

    const seo = buildSeo({
      lang: lang as Lang,
      meta,
      path: `/${lang}/rankings`,
      title: `${meta.rankings_title} — ${meta.site_title}`,
      description: meta.rankings_description,
    });

    const response = await jsonResponse(
      { data: { items: profiles }, seo },
      {
        locale: seo.locale,
        canonicalUrl: seo.canonical,
        cacheControl: "public, s-maxage=3600, stale-while-revalidate=86400",
        ifNoneMatch: req.headers.get("if-none-match"),
      },
    );
    return logger.done(withPublicCors(response));
  } catch (err) {
    console.error("[blog-engine-profiles]", err);
    return logger.done(withPublicCors(errors.internal()));
  }
});
