// blog-ranking — GET /blog-ranking/:lang
// AI Visibility Index. Filterable by sector, subsector, search, sort.
//   ?q=...        — case-insensitive partial match on brand name
//   ?sector=...   — sector id (financial-services, healthcare, ...)
//   ?subsector=...— subsector id (banks, fintech-neobanks, hospitals, ...)
//   ?sort=...     — rank:asc (default), rank:desc, score:desc, score:asc, name:asc, name:desc, delta:desc
//   ?limit=...    — max 100
//   ?period=...   — defaults to 'weekly'
//   ?region=...   — br | es | us | global (defaults to per-locale; falls back to 'global' if no snapshot found)
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handlePublicCors, withPublicCors } from "../_shared/blog-cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { errors, jsonResponse } from "../_shared/blog-response.ts";
import { isSupportedLang, type Lang } from "../_shared/blog-langs.ts";
import { buildSeo, loadLocaleMeta } from "../_shared/blog-seo.ts";
import { createRequestLogger } from "../_shared/logger.ts";

const DEFAULT_REGION_BY_LANG: Record<Lang, string> = { pt: "br", es: "es", en: "us" };
const ALLOWED_SORTS = new Set([
  "rank:asc", "rank:desc",
  "score:desc", "score:asc",
  "name:asc", "name:desc",
  "delta:desc",
]);

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-ranking", req);
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

    const requestedRegion = (url.searchParams.get("region") || DEFAULT_REGION_BY_LANG[lang as Lang]).toLowerCase();
    const sector = url.searchParams.get("sector")?.toLowerCase() || null;
    const subsector = url.searchParams.get("subsector")?.toLowerCase() || null;
    const period = (url.searchParams.get("period") || "weekly").toLowerCase();
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 50)));
    const q = (url.searchParams.get("q") || "").trim();
    const sort = url.searchParams.get("sort") || "rank:asc";

    if (!ALLOWED_SORTS.has(sort)) return logger.done(withPublicCors(errors.invalidFilter("sort", sort)));

    const db = createAdminClient();
    const meta = await loadLocaleMeta(db, lang as Lang);

    // Snapshots are scoped at the (region, sector) level. If a sector filter
    // is provided we constrain to that sector; otherwise we keep all sectors
    // for the region. If the requested region has no rows we fall back to
    // 'global'.
    let region = requestedRegion;
    async function fetchSnapshots(targetRegion: string) {
      let snapQ = db
        .from("blog_ranking_snapshots")
        .select("id, period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored, generated_at")
        .eq("region", targetRegion)
        .eq("period_label", period)
        .order("period_from", { ascending: false });
      if (sector) snapQ = snapQ.eq("sector", sector);
      const res = await snapQ.limit(20);
      if (res.error) throw res.error;
      return res.data || [];
    }

    let snapshots = await fetchSnapshots(region);
    if (snapshots.length === 0 && region !== "global") {
      region = "global";
      snapshots = await fetchSnapshots(region);
    }

    if (!snapshots || snapshots.length === 0) {
      const faq = await loadRankingFaq(db, lang as Lang, region, sector);
      const seo = buildSeo({
        lang: lang as Lang, meta, path: `/${lang}/rankings`,
        title: `${meta.rankings_title} — ${meta.site_title}`,
        description: meta.rankings_description,
      });
      return logger.done(withPublicCors(await jsonResponse(
        {
          data: {
            lang, locale: seo.locale,
            period: { label: period, from: null, to: null },
            filters: { region, sector, subsector, q: q || null, sort },
            items: [],
            stats: null,
            faq,
          },
          seo,
        },
        { locale: seo.locale, cacheControl: "public, s-maxage=300, stale-while-revalidate=86400" },
      )));
    }

    // For each region+sector, take only the latest snapshot
    const latestBySector = new Map<string, typeof snapshots[number]>();
    for (const s of snapshots) {
      const key = (s as { sector: string }).sector;
      if (!latestBySector.has(key)) latestBySector.set(key, s);
    }
    const snapshotIds = Array.from(latestBySector.values()).map((s) => (s as { id: number }).id);

    const { data: itemRows, error: iErr } = await db
      .from("blog_ranking_items")
      .select("rank, brand_id, score, delta, direction, snapshot_id")
      .in("snapshot_id", snapshotIds);
    if (iErr) throw iErr;

    const brandIds = (itemRows || []).map((r: { brand_id: string }) => r.brand_id);
    const { data: brands } = brandIds.length ? await db
      .from("blog_brands")
      .select("id, name, country, sector, subsector_id, homepage_domain, entity_type, labels")
      .in("id", brandIds) : { data: [] };
    type BrandRow = {
      id: string; name: string; country: string | null;
      sector: string; subsector_id: string | null;
      homepage_domain: string | null; entity_type: string;
      labels: Record<string, string>;
    };
    const brandMap = new Map<string, BrandRow>();
    for (const b of brands || []) brandMap.set((b as BrandRow).id, b as BrandRow);

    // Localized subsector labels
    const subsectorLabel = new Map<string, string>();
    if (brandMap.size > 0) {
      const ids = Array.from(brandMap.values()).map((b) => b.subsector_id).filter(Boolean) as string[];
      if (ids.length > 0) {
        const { data: subTr } = await db
          .from("blog_subsector_translations")
          .select("subsector_id, label")
          .eq("lang", lang)
          .in("subsector_id", ids);
        for (const r of subTr || []) {
          subsectorLabel.set((r as { subsector_id: string }).subsector_id, (r as { label: string }).label);
        }
      }
    }

    // Localized sector labels
    const { data: sectorTr } = await db
      .from("blog_sector_translations")
      .select("sector, label")
      .eq("lang", lang);
    const sectorLabel = new Map<string, string>();
    for (const r of sectorTr || []) sectorLabel.set((r as { sector: string }).sector, (r as { label: string }).label);

    let items = (itemRows || []).map((r: { rank: number; brand_id: string; score: number; delta: string; direction: string; snapshot_id: number }) => {
      const brand = brandMap.get(r.brand_id);
      return {
        rank: r.rank,
        brandId: r.brand_id,
        name: brand?.name || r.brand_id,
        country: brand?.country || null,
        sectorId: brand?.sector || null,
        sectorLabel: sectorLabel.get(brand?.sector || "") || brand?.sector || "",
        subsectorId: brand?.subsector_id || null,
        subsectorLabel: subsectorLabel.get(brand?.subsector_id || "") || null,
        homepageDomain: brand?.homepage_domain || null,
        entityType: brand?.entity_type || "company",
        score: r.score,
        delta: r.delta,
        direction: r.direction,
        snapshotId: r.snapshot_id,
      };
    });

    // Subsector filter (brand-level)
    if (subsector) {
      items = items.filter((i: { subsectorId: string | null }) => i.subsectorId === subsector);
    }

    // Search filter
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter((i: { name: string; sectorLabel: string; subsectorLabel: string | null }) =>
        i.name.toLowerCase().includes(needle) ||
        i.sectorLabel.toLowerCase().includes(needle) ||
        (i.subsectorLabel || "").toLowerCase().includes(needle),
      );
    }

    // Sort
    const [sortField, sortDir] = sort.split(":");
    const ascending = sortDir === "asc";
    items.sort((a, b) => {
      let cmp = 0;
      if (sortField === "rank") cmp = a.rank - b.rank;
      else if (sortField === "score") cmp = a.score - b.score;
      else if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "delta") {
        const ad = parseInt(a.delta, 10) || 0;
        const bd = parseInt(b.delta, 10) || 0;
        cmp = ad - bd;
      }
      return ascending ? cmp : -cmp;
    });

    items = items.slice(0, limit);

    const firstSnap = snapshots[0] as { period_from: string; period_to: string; period_label: string; queries_analyzed: number; sectors_covered: number; engines_monitored: string[]; generated_at: string };

    // FAQ — try the most-specific (region, sector) combo, then progressively
    // less specific until we hit the (NULL, NULL) global default. Always
    // returns an array; empty when nothing matches (CHANGES.md §3.1).
    const faq = await loadRankingFaq(db, lang as Lang, region, sector);

    const seo = buildSeo({
      lang: lang as Lang,
      meta,
      path: `/${lang}/rankings`,
      title: `${meta.rankings_title} — ${meta.site_title}`,
      description: meta.rankings_description,
      keywords: ["ranking", "AVI", "AI Visibility Index", ...(sector ? [sector] : []), ...(subsector ? [subsector] : []), region],
    });

    const response = await jsonResponse(
      {
        data: {
          lang,
          locale: seo.locale,
          title: meta.rankings_title,
          description: meta.rankings_description,
          period: { label: period, from: firstSnap.period_from, to: firstSnap.period_to },
          filters: { region, sector, subsector, q: q || null, sort },
          stats: {
            queriesAnalyzed: firstSnap.queries_analyzed,
            sectorsCovered: firstSnap.sectors_covered,
            enginesMonitored: firstSnap.engines_monitored,
          },
          items,
          faq,
        },
        seo,
      },
      {
        locale: seo.locale,
        canonicalUrl: seo.canonical,
        cacheControl: "public, s-maxage=300, stale-while-revalidate=86400",
        lastModified: firstSnap.generated_at,
        ifNoneMatch: req.headers.get("if-none-match"),
      },
    );
    return logger.done(withPublicCors(response));
  } catch (err) {
    console.error("[blog-ranking]", err);
    return logger.done(withPublicCors(errors.internal()));
  }
});

// ─── FAQ loader ─────────────────────────────────────────────────────────────

interface FaqRow {
  region: string | null;
  sector: string | null;
  position: number;
  question: string;
  answer: string;
}

/**
 * Load the FAQ for a (lang, region, sector) tuple. Picks the most-specific
 * group available:
 *   1. region + sector exact
 *   2. region only (sector NULL)
 *   3. sector only (region NULL)
 *   4. global (region NULL AND sector NULL)
 * Returns `[]` when nothing matches.
 */
async function loadRankingFaq(
  // deno-lint-ignore no-explicit-any
  db: any,
  lang: Lang,
  region: string | null,
  sector: string | null,
): Promise<Array<{ question: string; answer: string }>> {
  // Pull every row that *could* match — much cheaper than 4 round-trips.
  let q = db
    .from("blog_ranking_faq")
    .select("region, sector, position, question, answer")
    .eq("lang", lang);
  if (region) q = q.or(`region.is.null,region.eq.${region}`);
  else q = q.is("region", null);
  if (sector) q = q.or(`sector.is.null,sector.eq.${sector}`);
  else q = q.is("sector", null);
  q = q.order("position");

  const { data, error } = await q;
  if (error) {
    console.error("[blog-ranking] loadRankingFaq", error);
    return [];
  }
  const rows = (data || []) as FaqRow[];
  if (rows.length === 0) return [];

  function specificity(r: FaqRow): number {
    return (r.region ? 2 : 0) + (r.sector ? 1 : 0);
  }
  let best = -1;
  for (const r of rows) best = Math.max(best, specificity(r));
  return rows
    .filter((r) => specificity(r) === best)
    .sort((a, b) => a.position - b.position)
    .map((r) => ({ question: r.question, answer: r.answer }));
}
