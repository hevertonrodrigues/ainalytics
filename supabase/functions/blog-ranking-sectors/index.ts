// blog-ranking-sectors — GET /blog-ranking-sectors/:lang
// Returns the canonical 10-sector × 5-subsector taxonomy in the requested
// locale, with brand counts per sector and per subsector.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handlePublicCors, withPublicCors } from "../_shared/blog-cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { errors, jsonResponse } from "../_shared/blog-response.ts";
import { isSupportedLang, type Lang } from "../_shared/blog-langs.ts";
import { buildSeo, loadLocaleMeta } from "../_shared/blog-seo.ts";
import { createRequestLogger } from "../_shared/logger.ts";

interface SectorRow { id: string; position: number }
interface SubsectorRow { id: string; sector_id: string; position: number }
interface SectorTrRow { sector_id: string; label: string; description: string | null }
interface SubTrRow { subsector_id: string; label: string; description: string | null }
interface BrandRow { sector: string; subsector_id: string | null }

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-ranking-sectors", req);
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

    const [sectorsRes, subsectorsRes, sectorTrRes, subTrRes, brandsRes] = await Promise.all([
      db.from("blog_sectors").select("id, position").eq("is_active", true).order("position"),
      db.from("blog_subsectors").select("id, sector_id, position").eq("is_active", true).order("position"),
      db.from("blog_sector_translations").select("sector_id, label, description").eq("lang", lang),
      db.from("blog_subsector_translations").select("subsector_id, label, description").eq("lang", lang),
      db.from("blog_brands").select("sector, subsector_id"),
    ]);

    const sectors = (sectorsRes.data || []) as SectorRow[];
    const subsectors = (subsectorsRes.data || []) as SubsectorRow[];
    const sectorTr = new Map<string, SectorTrRow>();
    for (const r of sectorTrRes.data || []) sectorTr.set((r as SectorTrRow).sector_id, r as SectorTrRow);
    const subTr = new Map<string, SubTrRow>();
    for (const r of subTrRes.data || []) subTr.set((r as SubTrRow).subsector_id, r as SubTrRow);

    // Counts
    const brandPerSector = new Map<string, number>();
    const brandPerSubsector = new Map<string, number>();
    for (const r of (brandsRes.data || []) as BrandRow[]) {
      brandPerSector.set(r.sector, (brandPerSector.get(r.sector) || 0) + 1);
      if (r.subsector_id) brandPerSubsector.set(r.subsector_id, (brandPerSubsector.get(r.subsector_id) || 0) + 1);
    }

    const subsectorsBySector = new Map<string, SubsectorRow[]>();
    for (const s of subsectors) {
      const list = subsectorsBySector.get(s.sector_id) || [];
      list.push(s);
      subsectorsBySector.set(s.sector_id, list);
    }

    const items = sectors.map((s) => {
      const tr = sectorTr.get(s.id);
      const subs = (subsectorsBySector.get(s.id) || []).map((sub) => {
        const stTr = subTr.get(sub.id);
        return {
          id: sub.id,
          label: stTr?.label || sub.id,
          description: stTr?.description || null,
          brandCount: brandPerSubsector.get(sub.id) || 0,
        };
      });
      return {
        id: s.id,
        label: tr?.label || s.id,
        description: tr?.description || null,
        brandCount: brandPerSector.get(s.id) || 0,
        subsectors: subs,
      };
    });

    const seo = buildSeo({
      lang: lang as Lang,
      meta,
      path: `/${lang}/rankings`,
      title: `${meta.rankings_title} — ${meta.site_title}`,
      description: meta.rankings_description,
    });

    const response = await jsonResponse(
      { data: { lang, locale: seo.locale, items }, seo },
      {
        locale: seo.locale,
        cacheControl: "public, s-maxage=3600, stale-while-revalidate=604800",
        ifNoneMatch: req.headers.get("if-none-match"),
      },
    );
    return logger.done(withPublicCors(response));
  } catch (err) {
    console.error("[blog-ranking-sectors]", err);
    return logger.done(withPublicCors(errors.internal()));
  }
});
