// blog-ranking-timeline — GET /blog-ranking-timeline/:lang?weeks=12&top=5
//
// Historical AVI lines for the rankings page chart. Returns the score of the
// top-N brands across the last `weeks` weekly snapshots for a region.
//
// Query params:
//   ?weeks=12       — how many weekly snapshots to look back (default 12, max 52)
//   ?top=5          — how many top brands to expose (default 5, max 20)
//   ?region=br      — defaults per-locale (pt→br, es→es, en→us); falls back to global
//   ?sector=...     — optional sector filter
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handlePublicCors, withPublicCors } from "../_shared/blog-cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { errors, jsonResponse } from "../_shared/blog-response.ts";
import { isSupportedLang, type Lang } from "../_shared/blog-langs.ts";
import { buildSeo, loadLocaleMeta } from "../_shared/blog-seo.ts";
import { createRequestLogger } from "../_shared/logger.ts";
import { isoWeek } from "../_shared/blog-ranking-helpers.ts";

const DEFAULT_REGION_BY_LANG: Record<Lang, string> = { pt: "br", es: "es", en: "us" };
const DEFAULT_BRAND_COLORS = [
  "#10A37F", "#4285F4", "#D97757", "#1FB8CD", "#0F0F10",
  "#0078D4", "#7C3AED", "#F97316", "#0EA5E9", "#16A34A",
  "#E11D48", "#A855F7", "#EAB308", "#06B6D4", "#84CC16",
  "#F43F5E", "#3B82F6", "#22C55E", "#A855F7", "#FACC15",
];

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-ranking-timeline", req);
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

    const weeks  = Math.max(1, Math.min(52, Number(url.searchParams.get("weeks") || 12)));
    const top    = Math.max(1, Math.min(20, Number(url.searchParams.get("top")   || 5)));
    const requestedRegion = (url.searchParams.get("region") || DEFAULT_REGION_BY_LANG[lang as Lang]).toLowerCase();
    const sector = url.searchParams.get("sector")?.toLowerCase() || null;

    const db = createAdminClient();
    const meta = await loadLocaleMeta(db, lang as Lang);

    // Fetch the most recent N weekly snapshots for the region (with global fallback).
    async function fetchSnapshots(targetRegion: string) {
      let q = db
        .from("blog_ranking_snapshots")
        .select("id, period_from, period_to, region, sector")
        .eq("region", targetRegion)
        .eq("period_label", "weekly")
        .order("period_from", { ascending: false });
      if (sector) q = q.eq("sector", sector);
      const res = await q.limit(weeks * 6); // headroom for multi-sector regions
      if (res.error) throw res.error;
      return res.data || [];
    }

    let region = requestedRegion;
    let rawSnapshots = await fetchSnapshots(region);
    if (rawSnapshots.length === 0 && region !== "global") {
      region = "global";
      rawSnapshots = await fetchSnapshots(region);
    }

    if (rawSnapshots.length === 0) {
      const seo = buildSeo({
        lang: lang as Lang, meta, path: `/${lang}/rankings`,
        title: `${meta.rankings_title} — ${meta.site_title}`,
        description: meta.rankings_description,
      });
      return logger.done(withPublicCors(await jsonResponse(
        { data: { weeks: [], lines: [], region, sector, top }, seo },
        { locale: seo.locale, cacheControl: "public, s-maxage=600, stale-while-revalidate=86400" },
      )));
    }

    // Group by period_from; keep the most recent `weeks` periods. When the
    // region has multiple sector snapshots per week, keep the one for the
    // requested sector (or the first found when sector is null).
    type Snap = { id: number; period_from: string; period_to: string; region: string; sector: string };
    const periodMap = new Map<string, Snap>();
    for (const s of rawSnapshots as Snap[]) {
      if (!periodMap.has(s.period_from)) periodMap.set(s.period_from, s);
    }
    const orderedPeriods = Array.from(periodMap.values())
      .sort((a, b) => b.period_from.localeCompare(a.period_from))
      .slice(0, weeks)
      .reverse(); // ascending → oldest first for the chart

    // Pick top brands from the most recent snapshot.
    const lastSnap = orderedPeriods[orderedPeriods.length - 1];
    if (!lastSnap) {
      const seo = buildSeo({
        lang: lang as Lang, meta, path: `/${lang}/rankings`,
        title: `${meta.rankings_title} — ${meta.site_title}`,
        description: meta.rankings_description,
      });
      return logger.done(withPublicCors(await jsonResponse(
        { data: { weeks: [], lines: [], region, sector, top }, seo },
        { locale: seo.locale, cacheControl: "public, s-maxage=600, stale-while-revalidate=86400" },
      )));
    }

    const { data: topItems, error: tErr } = await db
      .from("blog_ranking_items")
      .select("brand_id, score")
      .eq("snapshot_id", lastSnap.id)
      .order("rank", { ascending: true })
      .limit(top);
    if (tErr) throw tErr;
    const topBrandIds = (topItems || []).map((r: { brand_id: string }) => r.brand_id);
    if (topBrandIds.length === 0) {
      const seo = buildSeo({
        lang: lang as Lang, meta, path: `/${lang}/rankings`,
        title: `${meta.rankings_title} — ${meta.site_title}`,
        description: meta.rankings_description,
      });
      return logger.done(withPublicCors(await jsonResponse(
        { data: { weeks: [], lines: [], region, sector, top }, seo },
        { locale: seo.locale, cacheControl: "public, s-maxage=600, stale-while-revalidate=86400" },
      )));
    }

    // Pull every score for those brands across the selected snapshots.
    const snapIds = orderedPeriods.map((p) => p.id);
    const { data: scoreRows, error: sErr } = await db
      .from("blog_ranking_items")
      .select("snapshot_id, brand_id, score")
      .in("snapshot_id", snapIds)
      .in("brand_id", topBrandIds);
    if (sErr) throw sErr;

    type ScoreRow = { snapshot_id: number; brand_id: string; score: number };
    const scoreLookup = new Map<string, number>(); // `${snap}|${brand}` → score
    for (const r of (scoreRows || []) as ScoreRow[]) {
      scoreLookup.set(`${r.snapshot_id}|${r.brand_id}`, r.score);
    }

    // Brand name lookup
    const { data: brandRows } = await db
      .from("blog_brands")
      .select("id, name")
      .in("id", topBrandIds);
    const nameById = new Map<string, string>();
    for (const b of (brandRows || []) as Array<{ id: string; name: string }>) nameById.set(b.id, b.name);

    // Compose lines: one per brand, score per period (null when missing).
    const lines = topBrandIds.map((brandId, i) => ({
      brandId,
      name: nameById.get(brandId) || brandId,
      color: DEFAULT_BRAND_COLORS[i % DEFAULT_BRAND_COLORS.length],
      data: orderedPeriods.map((p) => scoreLookup.get(`${p.id}|${brandId}`) ?? null),
    }));

    // ISO week labels for the X axis: "2026-W17"
    const weekLabels = orderedPeriods.map((p) => {
      const d = new Date(`${p.period_from}T00:00:00Z`);
      const wn = isoWeek(d);
      return `${d.getUTCFullYear()}-W${String(wn).padStart(2, "0")}`;
    });

    const seo = buildSeo({
      lang: lang as Lang,
      meta,
      path: `/${lang}/rankings`,
      title: `${meta.rankings_title} — ${meta.site_title}`,
      description: meta.rankings_description,
    });

    const response = await jsonResponse(
      {
        data: {
          region,
          sector,
          top,
          weeks: weekLabels,
          periods: orderedPeriods.map((p) => ({ from: p.period_from, to: p.period_to })),
          lines,
        },
        seo,
      },
      {
        locale: seo.locale,
        canonicalUrl: seo.canonical,
        cacheControl: "public, s-maxage=600, stale-while-revalidate=86400",
        ifNoneMatch: req.headers.get("if-none-match"),
      },
    );
    return logger.done(withPublicCors(response));
  } catch (err) {
    console.error("[blog-ranking-timeline]", err);
    return logger.done(withPublicCors(errors.internal()));
  }
});
