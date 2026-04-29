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
import { buildWeekLabel, formatIntDelta, formatPctDelta } from "../_shared/blog-ranking-helpers.ts";

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
      const methodology = await loadMethodology(db, lang as Lang);
      const seo = buildSeo({
        lang: lang as Lang, meta, path: `/${lang}/rankings`,
        title: `${meta.rankings_title} — ${meta.site_title}`,
        description: meta.rankings_description,
      });
      return logger.done(withPublicCors(await jsonResponse(
        {
          data: {
            lang, locale: seo.locale,
            period: { label: period, from: null, to: null, weekNumber: null, weekLabel: null },
            filters: { region, sector, subsector, q: q || null, sort },
            items: [],
            stats: null,
            methodology,
            insights: [],
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
      .select("rank, brand_id, score, delta, direction, snapshot_id, engine_scores, sector_id, region_id")
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

    let items = (itemRows || []).map((r: { rank: number; brand_id: string; score: number; delta: string; direction: string; snapshot_id: number; engine_scores: Record<string, number> | null; sector_id: string; region_id: string }) => {
      const brand = brandMap.get(r.brand_id);
      // Per-item sector_id / region_id are the source of truth (denormalized
      // from the parent snapshot, with room for per-item overrides). Fall
      // back to the brand-level classification only if the row pre-dates
      // the 20260429050000 migration.
      const sectorId = r.sector_id || brand?.sector || null;
      const regionId = r.region_id || (brand?.country ? brand.country.toLowerCase() : null);
      return {
        rank: r.rank,
        brandId: r.brand_id,
        name: brand?.name || r.brand_id,
        country: brand?.country || null,
        regionId,
        sectorId,
        sectorLabel: sectorLabel.get(sectorId || "") || sectorId || "",
        subsectorId: brand?.subsector_id || null,
        subsectorLabel: subsectorLabel.get(brand?.subsector_id || "") || null,
        homepageDomain: brand?.homepage_domain || null,
        entityType: brand?.entity_type || "company",
        score: r.score,
        delta: r.delta,
        direction: r.direction,
        engineScores: r.engine_scores ?? {},
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

    const firstSnap = snapshots[0] as { id: number; period_from: string; period_to: string; period_label: string; queries_analyzed: number; sectors_covered: number; engines_monitored: string[]; generated_at: string; sector: string };

    // ── Derived stats ──────────────────────────────────────────────────────
    // brandsIndexed = distinct brands across all current latest-by-sector snapshots.
    const brandsIndexed = brandMap.size;

    // Pull the previous snapshot for the same (region, sector(of firstSnap), period_label)
    // to compute KPI deltas. We compare using the first snapshot only (the
    // multi-sector "global" view falls back to whatever sector firstSnap is).
    const { data: prevSnaps } = await db
      .from("blog_ranking_snapshots")
      .select("id, period_from, queries_analyzed, sectors_covered, engines_monitored")
      .eq("region", region)
      .eq("sector", firstSnap.sector)
      .eq("period_label", period)
      .lt("period_from", firstSnap.period_from)
      .order("period_from", { ascending: false })
      .limit(1);
    const prevSnap = (prevSnaps && prevSnaps[0]) as
      | { id: number; queries_analyzed: number; sectors_covered: number; engines_monitored: string[] }
      | undefined;

    let prevBrandsIndexed: number | null = null;
    if (prevSnap) {
      const { count } = await db
        .from("blog_ranking_items")
        .select("brand_id", { count: "exact", head: true })
        .eq("snapshot_id", prevSnap.id);
      prevBrandsIndexed = typeof count === "number" ? count : null;
    }

    const { weekNumber, weekLabel } = buildWeekLabel(lang as Lang, firstSnap.period_from, firstSnap.period_to);

    // Methodology + insights run in parallel with the FAQ load below.
    const [faq, methodology, insights] = await Promise.all([
      loadRankingFaq(db, lang as Lang, region, sector),
      loadMethodology(db, lang as Lang),
      loadInsights(db, firstSnap.id, lang as Lang),
    ]);

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
          period: {
            label: period,
            from: firstSnap.period_from,
            to: firstSnap.period_to,
            weekNumber,
            weekLabel,
          },
          filters: { region, sector, subsector, q: q || null, sort },
          stats: {
            queriesAnalyzed: firstSnap.queries_analyzed,
            queriesAnalyzedDelta: formatPctDelta(firstSnap.queries_analyzed, prevSnap?.queries_analyzed ?? null),
            sectorsCovered: firstSnap.sectors_covered,
            sectorsCoveredDelta: formatIntDelta(firstSnap.sectors_covered, prevSnap?.sectors_covered ?? null),
            enginesMonitored: firstSnap.engines_monitored,
            enginesMonitoredDelta: formatIntDelta(
              firstSnap.engines_monitored?.length ?? null,
              prevSnap?.engines_monitored?.length ?? null,
            ),
            brandsIndexed,
            brandsIndexedDelta: formatIntDelta(brandsIndexed, prevBrandsIndexed),
          },
          items,
          methodology,
          insights,
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

// ─── Methodology + Insights loaders ─────────────────────────────────────────

interface MethodologyPillar {
  id: string;
  name: string;
  description: string;
  weight: number;
  position: number;
}

/**
 * Load AVI methodology pillars with translations for the requested locale.
 * Falls back to English if a translation is missing for the requested lang.
 */
async function loadMethodology(
  // deno-lint-ignore no-explicit-any
  db: any,
  lang: Lang,
): Promise<{ pillars: MethodologyPillar[] }> {
  const { data: pillarRows, error } = await db
    .from("blog_methodology_pillars")
    .select("id, weight, position")
    .eq("is_active", true)
    .order("position", { ascending: true });
  if (error) {
    console.error("[blog-ranking] loadMethodology", error);
    return { pillars: [] };
  }
  const ids = (pillarRows || []).map((p: { id: string }) => p.id);
  if (ids.length === 0) return { pillars: [] };

  const { data: trRows } = await db
    .from("blog_methodology_pillar_translations")
    .select("pillar_id, lang, name, description")
    .in("pillar_id", ids)
    .in("lang", [lang, "en"]);

  type Tr = { pillar_id: string; lang: string; name: string; description: string };
  const byIdLang = new Map<string, Tr>();
  for (const r of (trRows || []) as Tr[]) byIdLang.set(`${r.pillar_id}::${r.lang}`, r);

  return {
    pillars: (pillarRows as Array<{ id: string; weight: number; position: number }>).map((p) => {
      const tr = byIdLang.get(`${p.id}::${lang}`) || byIdLang.get(`${p.id}::en`);
      return {
        id: p.id,
        name: tr?.name ?? p.id,
        description: tr?.description ?? "",
        weight: p.weight,
        position: p.position,
      };
    }),
  };
}

interface InsightCard {
  position: number;
  tag: string;
  title: string;
  text: string;
}

/** Load editorial insights bound to a snapshot+lang; returns [] when none. */
async function loadInsights(
  // deno-lint-ignore no-explicit-any
  db: any,
  snapshotId: number,
  lang: Lang,
): Promise<InsightCard[]> {
  const { data, error } = await db
    .from("blog_ranking_insights")
    .select("position, tag, title, text")
    .eq("snapshot_id", snapshotId)
    .eq("lang", lang)
    .order("position", { ascending: true });
  if (error) {
    console.error("[blog-ranking] loadInsights", error);
    return [];
  }
  return (data || []) as InsightCard[];
}
