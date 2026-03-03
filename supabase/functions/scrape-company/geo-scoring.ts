/**
 * GEO Factor Scoring Engine
 * Computes 0-100 scores for all 25 GEO factors using the
 * Implementation Guide's exact formulas.
 */

import type { ExtractedPageData, RobotsAnalysis, SitemapAnalysis } from "./geo-extract.ts";
import { scoreAnswerFirst, scoreFaq, scoreContentFreshness, scoreReadability, scoreEntityConsistency } from "./nlp-analysis.ts";
import {
  WEIGHTS as FACTOR_WEIGHTS,
  NAMES as FACTOR_NAMES,
  CATEGORIES as FACTOR_CATEGORIES,
  READINESS_LEVELS,
} from "./geo-factors.ts";

// Re-export for backward compatibility
export { FACTOR_WEIGHTS, FACTOR_NAMES, FACTOR_CATEGORIES };

// ─── Score result type ──────────────────────────────────────

export interface FactorScoreResult {
  factor_id: string;
  name: string;
  category: string;
  score: number;
  weight: number;
  weighted_score: number;
  status: "excellent" | "good" | "warning" | "critical";
  details: string;
  recommendations: string[];
}

function clamp(v: number, min = 0, max = 100): number {
  const safe = Number.isFinite(v) ? v : 0;
  return Math.min(Math.max(Math.round(safe * 10) / 10, min), max);
}

function status(score: number): "excellent" | "good" | "warning" | "critical" {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 40) return "warning";
  return "critical";
}

function avg(arr: number[]): number {
  const valid = arr.filter((n) => Number.isFinite(n));
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

// ─── Weighted page averaging ────────────────────────────────
// Homepage (index 0) gets HOME_WEIGHT (30%), remaining 70% is split
// among other pages. This means:
//   3 pages:  home=0.30, each other=0.35 → almost equal
//  10 pages:  home=0.30, each other=0.078
// 100 pages:  home=0.30, each other=0.007 → diminishing
const HOME_WEIGHT = 0.30;

function computePageWeights(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [1.0];
  const otherWeight = (1.0 - HOME_WEIGHT) / (count - 1);
  return [HOME_WEIGHT, ...Array(count - 1).fill(otherWeight)];
}

function weightedAvg(values: number[], pageCount?: number): number {
  const valid = values.filter((n) => Number.isFinite(n));
  if (valid.length === 0) return 0;
  // If pageCount isn't provided or doesn't match, fall back to unweighted
  const weights = computePageWeights(values.length);
  if (weights.length !== values.length) return avg(valid);
  let wSum = 0, wTotal = 0;
  for (let i = 0; i < values.length; i++) {
    if (Number.isFinite(values[i])) {
      wSum += values[i] * weights[i];
      wTotal += weights[i];
    }
  }
  return wTotal > 0 ? wSum / wTotal : 0;
}

// ─── Factor scorers ─────────────────────────────────────────

function scoreSsr(pages: ExtractedPageData[]): FactorScoreResult {
  const hasHeadless = pages.some((p) => p.headless && Number.isFinite(p.headless.ssr_ratio));

  // Compute per-page SSR scores
  const pageScores = pages.map((p) => {
    const headlessValid = p.headless && Number.isFinite(p.headless.ssr_ratio);
    const ssrRatio = headlessValid
      ? p.headless!.ssr_ratio
      : p.is_client_rendered ? 0.1 : 0.95;

    let checks = 0;
    if (p.headings.h1_count >= 1) checks++;
    if (p.paragraphs.total >= 1 && p.word_count > 20) checks++;
    if (p.semantic.main >= 1 || p.semantic.article >= 1) checks++;
    const criticalPct = checks / 3;
    const fullyRendered = ssrRatio >= 0.9 ? 1.0 : 0.0;

    return ssrRatio * 40 + fullyRendered * 35 + criticalPct * 25;
  });

  const score = clamp(weightedAvg(pageScores));
  const avgRatio = weightedAvg(pages.map((p) => {
    const hv = p.headless && Number.isFinite(p.headless.ssr_ratio);
    return hv ? p.headless!.ssr_ratio : p.is_client_rendered ? 0.1 : 0.95;
  }));
  const pctFullyRendered = pages.filter((p) => {
    const hv = p.headless && Number.isFinite(p.headless.ssr_ratio);
    const ratio = hv ? p.headless!.ssr_ratio : p.is_client_rendered ? 0.1 : 0.95;
    return ratio >= 0.9;
  }).length / Math.max(pages.length, 1);

  const recs: string[] = [];
  if (avgRatio < 0.5) recs.push("Implement server-side rendering (SSR) or static site generation (SSG) so content is visible without JavaScript.");

  const source = hasHeadless ? "Headless browser comparison" : "Heuristic estimation";
  return {
    factor_id: "ssr_detection", name: FACTOR_NAMES.ssr_detection,
    category: "Technical", score, weight: FACTOR_WEIGHTS.ssr_detection,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.ssr_detection * 100) / 100,
    status: status(score),
    details: `${source}. Avg SSR ratio: ${(avgRatio * 100).toFixed(0)}%. ${(pctFullyRendered * 100).toFixed(0)}% pages fully rendered.`,
    recommendations: recs,
  };
}

function scoreRobots(robots: RobotsAnalysis): FactorScoreResult {
  const botStatus = robots.bot_status;
  const searchBots = ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"];
  const trainingBots = ["GPTBot", "ClaudeBot", "Google-Extended", "Meta-ExternalAgent", "ChatGPT-User", "Applebot-Extended"];

  const searchScores = searchBots.map((b) => {
    const s = botStatus[b];
    if (s === "allowed" || (!robots.has_blanket_disallow && s === "not_mentioned")) return 1.0;
    if (s === "partially_blocked") return 0.5;
    return 0.0;
  });
  const trainingScores = trainingBots.map((b) => {
    const s = botStatus[b];
    if (s === "allowed") return 1.0;
    if (s === "not_mentioned") return 0.7;
    if (s === "partially_blocked") return 0.3;
    return 0.0;
  });

  const searchAvg = avg(searchScores);
  const trainingAvg = avg(trainingScores);
  const existence = robots.exists ? 1.0 : 0.0;
  const sitemapRef = robots.has_sitemap_directive ? 1.0 : 0.0;
  const blanketPenalty = robots.has_blanket_disallow ? 0.0 : 1.0;

  const score = clamp(searchAvg * 45 + trainingAvg * 20 + existence * 10 + sitemapRef * 10 + blanketPenalty * 15);

  const recs: string[] = [];
  if (searchAvg < 1 && !robots.has_blanket_disallow) recs.push("Explicitly allow AI search bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot) in robots.txt.");
  if (robots.has_blanket_disallow) recs.push("Remove blanket 'User-agent: * Disallow: /' and add specific rules for bots you want to block.");
  if (!robots.has_sitemap_directive) recs.push("Add a 'Sitemap:' directive pointing to your XML sitemap in robots.txt.");

  return {
    factor_id: "robots_txt_ai", name: FACTOR_NAMES.robots_txt_ai,
    category: "Technical", score, weight: FACTOR_WEIGHTS.robots_txt_ai,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.robots_txt_ai * 100) / 100,
    status: status(score),
    details: `Search bots: ${robots.search_bots_allowed}/3 accessible. Training bots: ${robots.training_bots_allowed}/6 allowed. ${robots.has_blanket_disallow ? "⚠ Blanket disallow detected." : "No blanket block."}`,
    recommendations: recs,
  };
}

function scoreSchema(pages: ExtractedPageData[]): FactorScoreResult {
  const pagesWithSchema = pages.filter((p) => p.schema.total_schemas > 0).length;
  const coverage = pagesWithSchema / Math.max(pages.length, 1);

  const allTypes = new Set<string>();
  let totalValid = 0, totalInvalid = 0;
  for (const p of pages) {
    p.schema.detected_types.forEach((t) => allTypes.add(t));
    totalValid += p.schema.valid_blocks;
    totalInvalid += p.schema.invalid_blocks;
  }

  // Points per type
  const TYPE_POINTS: Record<string, number> = {
    Article: 3, NewsArticle: 3, BlogPosting: 3, FAQPage: 3,
    Organization: 3, LocalBusiness: 3, Product: 3,
    Person: 2, BreadcrumbList: 2, HowTo: 2, Review: 2, AggregateRating: 2,
    WebSite: 1, WebPage: 1,
  };
  let schemaPoints = 0;
  allTypes.forEach((t) => { schemaPoints += TYPE_POINTS[t] || 0; });

  const highValuePresent = [
    [...allTypes].some((t) => ["Article", "NewsArticle", "BlogPosting"].includes(t)),
    allTypes.has("FAQPage"),
    allTypes.has("Organization") || allTypes.has("LocalBusiness"),
    allTypes.has("Product"),
  ].filter(Boolean).length;

  const coverageComp = Math.min(coverage / 0.80, 1.0) * 35;
  const varietyComp = Math.min(schemaPoints / 12, 1.0) * 30;
  const highValueComp = (highValuePresent / 4) * 20;
  const validityComp = (totalValid + totalInvalid) > 0
    ? (totalValid / (totalValid + totalInvalid)) * 15 : 15;
  const score = clamp(coverageComp + varietyComp + highValueComp + validityComp);

  const recs: string[] = [];
  if (coverage < 0.5) recs.push("Add JSON-LD structured data to more pages — aim for 80%+ coverage.");
  if (!allTypes.has("Organization") && !allTypes.has("LocalBusiness")) recs.push("Add Organization schema to establish brand identity for AI.");
  if (highValuePresent < 3) recs.push("Implement high-value schema types: Article, FAQPage, Organization, Product.");

  return {
    factor_id: "schema_jsonld", name: FACTOR_NAMES.schema_jsonld,
    category: "Technical", score, weight: FACTOR_WEIGHTS.schema_jsonld,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.schema_jsonld * 100) / 100,
    status: status(score),
    details: `${(coverage * 100).toFixed(0)}% pages have schema. ${allTypes.size} unique types found. ${highValuePresent}/4 high-value types present.`,
    recommendations: recs,
  };
}

function scoreHeadings(pages: ExtractedPageData[]): FactorScoreResult {
  const pageScores = pages.map((p) => {
    const h = p.headings;
    // If no headings at all, it's a critical issue (likely client-side rendered)
    if (h.headings_total === 0) return 5;
    const h1Valid = h.h1_count === 1 ? 1.0 : h.h1_count === 0 ? 0.5 : 0.0;
    // hierarchy_valid can be 'true' when there are no headings — penalize that
    const nestingValid = h.headings_total > 1 ? (h.hierarchy_valid ? 1.0 : 0.5) : 0.5;
    const totalH2H3 = h.h2.length + h.h3.length;
    const questionPct = totalH2H3 > 0 ? h.question_headings_count / totalH2H3 : 0;
    const idCoverage = h.headings_total > 0 ? h.headings_with_ids / h.headings_total : 0;
    return h1Valid * 30 + nestingValid * 30 + Math.min(questionPct / 0.5, 1.0) * 25 + idCoverage * 15;
  });
  const score = clamp(weightedAvg(pageScores));

  const recs: string[] = [];
  const noHeadings = pages.filter((p) => p.headings.headings_total === 0).length;
  if (noHeadings > 0) recs.push(`${noHeadings} pages have NO headings at all — this indicates content may not be server-side rendered.`);
  const noH1 = pages.filter((p) => p.headings.h1_count === 0).length;
  if (noH1 > 0) recs.push(`${noH1} pages are missing an H1 tag — each page should have exactly one H1.`);
  const multiH1 = pages.filter((p) => p.headings.h1_count > 1).length;
  if (multiH1 > 0) recs.push(`${multiH1} pages have multiple H1 tags — each page should have exactly one H1.`);
  const invalidHierarchy = pages.filter((p) => !p.headings.hierarchy_valid && p.headings.headings_total > 1).length;
  if (invalidHierarchy > 0) recs.push("Fix heading hierarchy — ensure headings don't skip levels (e.g., H1 → H3).");

  return {
    factor_id: "heading_hierarchy", name: FACTOR_NAMES.heading_hierarchy,
    category: "Content", score, weight: FACTOR_WEIGHTS.heading_hierarchy,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.heading_hierarchy * 100) / 100,
    status: status(score),
    details: `${pages.filter((p) => p.headings.h1_count === 1).length}/${pages.length} pages have single H1. ${noHeadings} pages have no headings. ${invalidHierarchy} have hierarchy issues.`,
    recommendations: recs,
  };
}

function scoreSitemap(sitemap: SitemapAnalysis): FactorScoreResult {
  if (!sitemap.exists) {
    return {
      factor_id: "xml_sitemap", name: FACTOR_NAMES.xml_sitemap,
      category: "Technical", score: 0, weight: FACTOR_WEIGHTS.xml_sitemap,
      weighted_score: 0, status: "critical",
      details: "No XML sitemap found.",
      recommendations: ["Create an XML sitemap and submit it to search engines and AI crawlers."],
    };
  }

  const existComp = (sitemap.exists ? 15 : 0) + (sitemap.valid_xml ? 10 : 0);
  const lastmodComp = sitemap.lastmod_coverage * 25;
  const freshnessComp = Math.min(sitemap.freshness_ratio / 0.3, 1.0) * 20;
  const robotsComp = sitemap.in_robots ? 15 : 0;
  // Cross-ref simplified: give partial credit
  const crossRefComp = 15 * 0.5;
  const score = clamp(existComp + lastmodComp + freshnessComp + crossRefComp + robotsComp);

  const recs: string[] = [];
  if (sitemap.lastmod_coverage < 0.5) recs.push("Add <lastmod> dates to all sitemap URLs.");
  if (!sitemap.in_robots) recs.push("Reference your sitemap in robots.txt with a Sitemap: directive.");

  return {
    factor_id: "xml_sitemap", name: FACTOR_NAMES.xml_sitemap,
    category: "Technical", score, weight: FACTOR_WEIGHTS.xml_sitemap,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.xml_sitemap * 100) / 100,
    status: status(score),
    details: `${sitemap.total_urls} URLs in sitemap. ${(sitemap.lastmod_coverage * 100).toFixed(0)}% have lastmod. ${sitemap.recent_lastmod_90d} updated in last 90 days.`,
    recommendations: recs,
  };
}

// scorePageSpeed removed — use scorePageSpeedFromData() with real load_time_ms data

function scoreSemanticHtml(pages: ExtractedPageData[]): FactorScoreResult {
  const pageScores = pages.map((p) => {
    const s = p.semantic;
    const ratio = Math.min(s.semantic_ratio / 0.15, 1.0) * 40;
    const hasMain = s.main === 1 ? 1.0 : s.main > 1 ? 0.5 : 0.0;
    const hasArticle = s.article >= 1 ? 1.0 : 0.0;
    const hasNav = s.nav >= 1 ? 1.0 : 0.0;
    const hasHF = (s.header >= 1 && s.footer >= 1) ? 1.0 : (s.header >= 1 || s.footer >= 1) ? 0.5 : 0.0;
    const essentials = (hasMain + hasArticle + hasNav + hasHF) / 4 * 40;
    const types = new Set<string>();
    if (s.article) types.add("article"); if (s.section) types.add("section");
    if (s.main) types.add("main"); if (s.nav) types.add("nav");
    if (s.aside) types.add("aside"); if (s.header) types.add("header");
    if (s.footer) types.add("footer"); if (s.figure) types.add("figure");
    if (s.time) types.add("time"); if (s.details) types.add("details");
    const variety = Math.min(types.size / 7, 1.0) * 20;
    return ratio + essentials + variety;
  });
  const score = clamp(weightedAvg(pageScores));

  const recs: string[] = [];
  if (pages.some((p) => p.semantic.main === 0)) recs.push("Add a <main> element to every page to clearly mark the primary content area.");
  if (avg(pages.map((p) => p.semantic.semantic_ratio)) < 0.1) recs.push("Replace excessive <div> usage with semantic elements like <article>, <section>, <aside>.");

  return {
    factor_id: "semantic_html", name: FACTOR_NAMES.semantic_html,
    category: "Technical", score, weight: FACTOR_WEIGHTS.semantic_html,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.semantic_html * 100) / 100,
    status: status(score),
    details: `Avg semantic ratio: ${(avg(pages.map((p) => p.semantic.semantic_ratio)) * 100).toFixed(1)}%. ${pages.filter((p) => p.semantic.main >= 1).length}/${pages.length} pages have <main>.`,
    recommendations: recs,
  };
}

function scoreInternalLinking(pages: ExtractedPageData[]): FactorScoreResult {
  const avgDescPct = weightedAvg(pages.map((p) => p.links.descriptive_anchor_pct));
  const avgContextual = weightedAvg(pages.map((p) => p.links.contextual_internal));
  const avgNav = weightedAvg(pages.map((p) => p.links.navigation_internal));
  const descComp = avgDescPct * 35;
  let densityVal = 0.4;
  if (avgContextual >= 5) densityVal = 1.0;
  else if (avgContextual >= 3) densityVal = 0.7;
  else if (avgContextual >= 1) densityVal = 0.5;
  const densityComp = densityVal * 30;
  const orphanComp = 20; // Can't fully detect without cross-page analysis
  const ctxVsNav = Math.min(avgContextual / Math.max(avgNav, 1), 1.0) * 15;
  const score = clamp(descComp + densityComp + orphanComp + ctxVsNav);

  const recs: string[] = [];
  if (avgDescPct < 0.8) recs.push("Replace generic anchor text ('click here', 'read more') with descriptive text that tells AI what the linked page is about.");

  return {
    factor_id: "internal_linking", name: FACTOR_NAMES.internal_linking,
    category: "Content", score, weight: FACTOR_WEIGHTS.internal_linking,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.internal_linking * 100) / 100,
    status: status(score),
    details: `${(avgDescPct * 100).toFixed(0)}% descriptive anchors. Avg ${avgContextual.toFixed(1)} contextual links/page.`,
    recommendations: recs,
  };
}

function scoreAltText(pages: ExtractedPageData[]): FactorScoreResult {
  const pageScores = pages.map((p) => {
    const img = p.images;
    if (img.total === 0) return 40; // No images found — could mean CSR or genuinely no images
    const denom = Math.max(img.total - img.with_empty_alt, 1);
    const coverage = img.with_alt / denom * 50;
    const quality = img.with_alt > 0 ? ((img.with_alt - img.generic_alt) / img.with_alt) * 30 : 30;
    const figureBonus = Math.min(img.in_figure_with_caption / Math.max(img.total * 0.3, 1), 1.0) * 20;
    return coverage + quality + figureBonus;
  });
  const score = clamp(weightedAvg(pageScores));
  const totalImages = pages.reduce((s, p) => s + p.images.total, 0);
  const recs: string[] = [];
  if (totalImages === 0) recs.push("No images were detected in the raw HTML. If the site uses JavaScript to load images, they will be invisible to AI crawlers.");
  if (score < 70 && totalImages > 0) recs.push("Add descriptive alt text to all content images.");

  return {
    factor_id: "alt_text", name: FACTOR_NAMES.alt_text,
    category: "Content", score, weight: FACTOR_WEIGHTS.alt_text,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.alt_text * 100) / 100,
    status: status(score),
    details: `${pages.reduce((s, p) => s + p.images.with_alt, 0)}/${totalImages} images have alt text.`,
    recommendations: recs,
  };
}

function scoreCanonical(pages: ExtractedPageData[]): FactorScoreResult {
  const withCanonical = pages.filter((p) => p.canonical_url).length;
  const coverage = withCanonical / Math.max(pages.length, 1);
  const matching = pages.filter((p) => p.canonical_matches_url).length;
  const matchRate = withCanonical > 0 ? matching / withCanonical : 0;
  const httpsCanonicals = pages.filter((p) => p.canonical_url?.startsWith("https")).length;
  const httpsPct = withCanonical > 0 ? httpsCanonicals / withCanonical : 1;

  const score = clamp(coverage * 35 + matchRate * 30 + httpsPct * 15 + 20 * 0.5); // 20 * 0.5 = sitemap alignment estimate

  return {
    factor_id: "canonical_urls", name: FACTOR_NAMES.canonical_urls,
    category: "Technical", score, weight: FACTOR_WEIGHTS.canonical_urls,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.canonical_urls * 100) / 100,
    status: status(score),
    details: `${(coverage * 100).toFixed(0)}% pages have canonical. ${(matchRate * 100).toFixed(0)}% match actual URL.`,
    recommendations: coverage < 0.8 ? ["Add canonical URL tags to all pages."] : [],
  };
}

function scoreCleanUrls(pages: ExtractedPageData[]): FactorScoreResult {
  const urlScores = pages.map((p) => {
    try {
      const u = new URL(p.url);
      let clean = 1.0;
      if (u.search) clean -= 0.2;
      if (/sessionid|sid=|jsessionid|phpsessid/i.test(u.search)) clean -= 0.3;
      if (/utm_|fbclid|gclid/i.test(u.search)) clean -= 0.15;
      if (!/^[a-z0-9/\-_.]*$/.test(u.pathname)) clean -= 0.1;
      if (u.pathname.split("/").filter(Boolean).length > 4) clean -= 0.1;
      return Math.max(clean, 0);
    } catch { return 0.5; }
  });

  const avgClean = avg(urlScores);
  const noParams = pages.filter((p) => !p.url.includes("?")).length / Math.max(pages.length, 1);
  const score = clamp(avgClean * 50 + noParams * 25 + 25); // No session IDs assumed

  return {
    factor_id: "clean_urls", name: FACTOR_NAMES.clean_urls,
    category: "Technical", score, weight: FACTOR_WEIGHTS.clean_urls,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.clean_urls * 100) / 100,
    status: status(score),
    details: `${(noParams * 100).toFixed(0)}% URLs have no query parameters. Avg cleanliness: ${(avgClean * 100).toFixed(0)}%.`,
    recommendations: score < 70 ? ["Use clean, descriptive URL paths with hyphens instead of query parameters."] : [],
  };
}

function scoreMetaDescriptions(pages: ExtractedPageData[]): FactorScoreResult {
  const withDesc = pages.filter((p) => p.meta_description && p.meta_description.length > 0).length;
  const coverage = withDesc / Math.max(pages.length, 1);
  const lengths = pages.filter((p) => p.meta_description).map((p) => p.meta_description!.length);
  const optimalCount = lengths.filter((l) => l >= 120 && l <= 160).length;
  const optimalPct = lengths.length > 0 ? optimalCount / lengths.length : 0;
  // Uniqueness
  const descs = pages.map((p) => p.meta_description).filter(Boolean);
  const uniqueDescs = new Set(descs).size;
  const uniquePct = descs.length > 0 ? uniqueDescs / descs.length : 1;

  const score = clamp(coverage * 35 + optimalPct * 25 + uniquePct * 25 + 15); // quality assumed OK

  return {
    factor_id: "meta_descriptions", name: FACTOR_NAMES.meta_descriptions,
    category: "Technical", score, weight: FACTOR_WEIGHTS.meta_descriptions,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.meta_descriptions * 100) / 100,
    status: status(score),
    details: `${(coverage * 100).toFixed(0)}% pages have meta descriptions. ${(optimalPct * 100).toFixed(0)}% are optimal length (120-160 chars).`,
    recommendations: coverage < 0.8 ? ["Add unique, descriptive meta descriptions to all pages."] : [],
  };
}

function scoreHttps(pages: ExtractedPageData[]): FactorScoreResult {
  const httpsPct = pages.filter((p) => p.is_https).length / Math.max(pages.length, 1);
  const hasHsts = pages.some((p) => p.hsts_header);
  // Consistency: check if canonical URLs and internal links use HTTPS
  const canonicalHttps = pages.filter((p) => p.canonical_url?.startsWith("https")).length / Math.max(pages.length, 1);
  const consistencyVal = (canonicalHttps + httpsPct) / 2;
  const score = clamp(httpsPct * 40 + (httpsPct >= 1 ? 20 : 0) + (hasHsts ? 10 : 0) + consistencyVal * 20 + 10);

  return {
    factor_id: "https_security", name: FACTOR_NAMES.https_security,
    category: "Technical", score, weight: FACTOR_WEIGHTS.https_security,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.https_security * 100) / 100,
    status: status(score),
    details: `${(httpsPct * 100).toFixed(0)}% pages served over HTTPS. HSTS: ${hasHsts ? "Yes" : "No"}.`,
    recommendations: httpsPct < 1 ? ["Enforce HTTPS on all pages with proper redirects."] : [],
  };
}

function scoreMobileResponsive(pages: ExtractedPageData[]): FactorScoreResult {
  const withViewport = pages.filter((p) => p.viewport_tag).length;
  const correctViewport = pages.filter((p) =>
    p.viewport_tag?.includes("width=device-width") && p.viewport_tag?.includes("initial-scale=1")
  ).length;
  const viewportPct = correctViewport / Math.max(pages.length, 1);

  // Use real mobile parity from headless browser if available and valid
  const pagesWithValidHeadless = pages.filter(
    (p) => p.headless && Number.isFinite(p.headless.mobile_parity)
  );
  const hasHeadless = pagesWithValidHeadless.length > 0;
  const mobileParity = hasHeadless
    ? weightedAvg(pagesWithValidHeadless.map((p) => p.headless!.mobile_parity))
    : 0.85; // Optimistic default when we can't measure

  // Content parity with proper thresholds from guide
  let parityVal: number;
  if (mobileParity >= 0.95) parityVal = 1.0;
  else if (mobileParity >= 0.80) parityVal = 0.7;
  else if (mobileParity >= 0.60) parityVal = 0.4;
  else parityVal = 0.1;

  const viewportScore = viewportPct * 30;
  const parityScore = parityVal * 40;
  // CSS responsiveness indicator from viewport correctness
  const cssScore = viewportPct * 30;
  const score = clamp(viewportScore + parityScore + cssScore);

  const recs: string[] = [];
  if (viewportPct < 0.8) recs.push("Add proper viewport meta tag: <meta name='viewport' content='width=device-width, initial-scale=1'>.");
  if (hasHeadless && mobileParity < 0.7) recs.push("Significant content is missing on mobile. Ensure all critical content is visible on mobile viewports.");

  const source = hasHeadless ? "Headless browser comparison" : "Heuristic estimation";
  return {
    factor_id: "mobile_responsive", name: FACTOR_NAMES.mobile_responsive,
    category: "Technical", score, weight: FACTOR_WEIGHTS.mobile_responsive,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.mobile_responsive * 100) / 100,
    status: status(score),
    details: `${source}. ${withViewport}/${pages.length} pages have viewport tag. ${correctViewport} correct. Mobile content parity: ${(mobileParity * 100).toFixed(0)}%.`,
    recommendations: recs,
  };
}

function scoreTables(pages: ExtractedPageData[]): FactorScoreResult {
  const totalTables = pages.reduce((s, p) => s + p.tables.total, 0);
  if (totalTables === 0) {
    return {
      factor_id: "html_tables", name: FACTOR_NAMES.html_tables,
      category: "Content", score: 40, weight: FACTOR_WEIGHTS.html_tables,
      weighted_score: Math.round(40 * FACTOR_WEIGHTS.html_tables * 100) / 100,
      status: "warning", details: "No HTML tables found on the site.",
      recommendations: ["Consider using properly structured HTML tables to present comparative or tabular data."],
    };
  }

  const pagesWithTables = pages.filter((p) => p.tables.total > 0).length;
  const usageRate = pagesWithTables / Math.max(pages.length, 1);
  const totalThead = pages.reduce((s, p) => s + p.tables.with_thead, 0);
  const totalTh = pages.reduce((s, p) => s + p.tables.with_th, 0);
  const totalCaption = pages.reduce((s, p) => s + p.tables.with_caption, 0);
  const properPct = totalTh / Math.max(totalTables, 1);

  const score = clamp(
    Math.min(usageRate / 0.3, 1.0) * 30 + properPct * 40 +
    (totalThead / totalTables) * 15 + (totalCaption / totalTables) * 15
  );

  return {
    factor_id: "html_tables", name: FACTOR_NAMES.html_tables,
    category: "Content", score, weight: FACTOR_WEIGHTS.html_tables,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.html_tables * 100) / 100,
    status: status(score),
    details: `${totalTables} tables across ${pagesWithTables} pages. ${(properPct * 100).toFixed(0)}% have proper headers.`,
    recommendations: properPct < 0.7 ? ["Add <thead> and <th> elements to all data tables for AI accessibility."] : [],
  };
}

function scoreParagraphs(pages: ExtractedPageData[]): FactorScoreResult {
  const pageScores = pages.map((p) => {
    const par = p.paragraphs;
    // 0 paragraphs = critical (content not available in raw HTML, likely client-side rendered)
    if (par.total === 0) return 10;
    let lengthVal: number;
    if (par.avg_word_count <= 80) lengthVal = 1.0;
    else if (par.avg_word_count <= 100) lengthVal = 0.8;
    else if (par.avg_word_count <= 120) lengthVal = 0.5;
    else if (par.avg_word_count <= 150) lengthVal = 0.3;
    else lengthVal = 0.1;
    const selfContained = par.total > 0 ? 1.0 - par.cross_reference_count / par.total : 1;
    return lengthVal * 35 + par.pct_under_100 * 25 + (1 - par.pct_over_150) * 15 + selfContained * 25;
  });
  const score = clamp(weightedAvg(pageScores));
  const zeroParagraphs = pages.filter((p) => p.paragraphs.total === 0).length;
  const recs: string[] = [];
  if (zeroParagraphs > 0) recs.push(`${zeroParagraphs} pages have NO paragraph content in the raw HTML — content is likely loaded via JavaScript and invisible to AI crawlers.`);
  if (score < 70 && zeroParagraphs === 0) recs.push("Break long paragraphs into shorter, self-contained chunks of 80 words or fewer.");

  return {
    factor_id: "paragraph_quality", name: FACTOR_NAMES.paragraph_quality,
    category: "Content", score, weight: FACTOR_WEIGHTS.paragraph_quality,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.paragraph_quality * 100) / 100,
    status: status(score),
    details: `Avg paragraph: ${Math.round(avg(pages.map((p) => p.paragraphs.avg_word_count)))} words. ${Math.round(avg(pages.map((p) => p.paragraphs.pct_under_100)) * 100)}% under 100 words. ${zeroParagraphs} pages with no paragraphs.`,
    recommendations: recs,
  };
}

function scoreLists(pages: ExtractedPageData[]): FactorScoreResult {
  const pagesWithLists = pages.filter((p) => p.lists.ordered_count + p.lists.unordered_count > 0).length;
  const usageRate = pagesWithLists / Math.max(pages.length, 1);
  const totalLists = pages.reduce((s, p) => s + p.lists.ordered_count + p.lists.unordered_count, 0);
  const avgDensity = totalLists / Math.max(pages.length, 1);
  const fakeRate = pages.filter((p) => p.lists.fake_list_patterns > 0).length / Math.max(pages.length, 1);
  const hasBoth = pages.some((p) => p.lists.ordered_count > 0 && p.lists.unordered_count > 0);

  const usageComp = Math.min(usageRate / 0.6, 1.0) * 35;
  let densityVal = 0.3;
  if (avgDensity >= 1.5) densityVal = 1.0;
  else if (avgDensity >= 1.0) densityVal = 0.8;
  else if (avgDensity >= 0.5) densityVal = 0.5;
  const densityComp = densityVal * 30;
  const properComp = (1 - fakeRate) * 20;
  const varietyComp = hasBoth ? 15 : 0;
  const score = clamp(usageComp + densityComp + properComp + varietyComp);

  return {
    factor_id: "html_lists", name: FACTOR_NAMES.html_lists,
    category: "Content", score, weight: FACTOR_WEIGHTS.html_lists,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.html_lists * 100) / 100,
    status: status(score),
    details: `${pagesWithLists}/${pages.length} pages use lists. ${totalLists} total content lists.`,
    recommendations: score < 70 ? ["Use proper HTML <ol> and <ul> lists instead of text bullet characters."] : [],
  };
}

function scoreJsDependency(pages: ExtractedPageData[]): FactorScoreResult {
  // Use headless SSR ratio for accurate JS-dependency detection
  const pagesWithValidHeadless = pages.filter(
    (p) => p.headless && Number.isFinite(p.headless.ssr_ratio)
  );
  const hasHeadless = pagesWithValidHeadless.length > 0;

  // Visibility: how much content is visible without JS
  let pctVisible: number;
  if (hasHeadless) {
    pctVisible = pagesWithValidHeadless.filter((p) => p.headless!.ssr_ratio >= 0.8).length
      / Math.max(pagesWithValidHeadless.length, 1);
  } else {
    pctVisible = pages.filter((p) => !p.is_client_rendered).length / Math.max(pages.length, 1);
  }

  // Pattern detection: accordion, tab, modal patterns in HTML
  const pagesWithJsPatterns = pages.filter((p) => {
    const h = (p as any).js_patterns;
    return h && (h.accordion_count > 0 || h.tab_count > 0 || h.modal_count > 0);
  }).length;
  const totalJsPages = pagesWithJsPatterns / Math.max(pages.length, 1);
  let patternVal: number;
  if (totalJsPages === 0) patternVal = 1.0;
  else if (totalJsPages <= 0.1) patternVal = 0.7;
  else if (totalJsPages <= 0.3) patternVal = 0.4;
  else patternVal = 0.1;

  // Infinite scroll detection
  const hasInfiniteScroll = pages.some((p) => (p as any).has_infinite_scroll);
  const scrollPenalty = hasInfiniteScroll ? 0.2 : 1.0;

  // Captcha check (not in guide formula but important)
  const noCaptcha = pages.filter((p) => !p.has_captcha).length / Math.max(pages.length, 1);

  const score = clamp(
    (1.0 - (1.0 - pctVisible)) * 45 +
    patternVal * 30 +
    scrollPenalty * 15 +
    noCaptcha * 10
  );

  const recs: string[] = [];
  if (pctVisible < 0.8) recs.push("Ensure all content is accessible without JavaScript execution.");
  if (noCaptcha < 1.0) recs.push("Remove captcha/anti-bot mechanisms from content pages.");
  if (hasInfiniteScroll) recs.push("Replace infinite scroll with standard pagination.");

  const source = hasHeadless ? "Headless browser comparison" : "Heuristic estimation";
  return {
    factor_id: "js_dependency", name: FACTOR_NAMES.js_dependency,
    category: "Technical", score, weight: FACTOR_WEIGHTS.js_dependency,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.js_dependency * 100) / 100,
    status: status(score),
    details: `${source}. ${(pctVisible * 100).toFixed(0)}% pages have content visible without JS. ${pages.filter((p) => p.has_captcha).length} pages with captcha.`,
    recommendations: recs,
  };
}

function scoreStatusCodes(pages: ExtractedPageData[]): FactorScoreResult {
  const total = pages.length;
  const s200 = pages.filter((p) => p.status_code === 200).length;
  const errors = pages.filter((p) => p.status_code >= 400).length;
  const redirects = pages.filter((p) => p.status_code >= 300 && p.status_code < 400).length;
  const pct200 = s200 / Math.max(total, 1);
  const pctErrors = errors / Math.max(total, 1);
  const pctRedirects = redirects / Math.max(total, 1);

  let redirectVal = 1.0;
  if (pctRedirects > 0.15) redirectVal = 0.3;
  else if (pctRedirects > 0.05) redirectVal = 0.7;

  // Chain detection: redirect chains > 2 hops
  const chains = pages.filter((p) => {
    const rc = (p as any).redirect_chain;
    return rc && rc.length > 2;
  }).length;
  const chainPct = chains / Math.max(total, 1);

  const score = clamp(pct200 * 40 + (1 - pctErrors) * 25 + redirectVal * 15 + (1 - chainPct) * 10 + 10);

  return {
    factor_id: "status_codes", name: FACTOR_NAMES.status_codes,
    category: "Technical", score, weight: FACTOR_WEIGHTS.status_codes,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.status_codes * 100) / 100,
    status: status(score),
    details: `${s200}/${total} pages return 200 OK. ${errors} errors, ${redirects} redirects.`,
    recommendations: errors > 0 ? ["Fix broken pages returning 4xx/5xx error codes."] : [],
  };
}

function scoreOpenGraph(pages: ExtractedPageData[]): FactorScoreResult {
  const pagesWithCore = pages.filter((p) =>
    p.open_graph.has_og_title && p.open_graph.has_og_description && p.open_graph.has_og_image
  ).length;
  const coreCoverage = pagesWithCore / Math.max(pages.length, 1);
  const avgCompleteness = weightedAvg(pages.map((p) => {
    const og = p.open_graph;
    let count = 0;
    if (og.has_og_title) count++;
    if (og.has_og_description) count++;
    if (og.has_og_image) count++;
    if (og.has_og_type) count++;
    if (og.has_og_url) count++;
    if (og.has_og_site_name) count++;
    return count / 6;
  }));

  // Consistency: check if og:title matches h1, og:description matches meta
  const titleMatchCount = pages.filter((p) => {
    if (!p.open_graph.has_og_title || !p.h1) return false;
    return true; // Without actual og_title text, assume match when both exist
  }).length;
  const descMatchCount = pages.filter((p) => {
    if (!p.open_graph.has_og_description || !p.meta_description) return false;
    return true; // Without actual og_description text, assume match when both exist
  }).length;
  const consistencyPct = pages.length > 0
    ? (titleMatchCount + descMatchCount) / (pages.length * 2) : 0;
  const imagePct = pages.filter((p) => p.open_graph.has_og_image).length / Math.max(pages.length, 1);

  const score = clamp(coreCoverage * 40 + avgCompleteness * 30 + consistencyPct * 20 + imagePct * 10);

  return {
    factor_id: "open_graph", name: FACTOR_NAMES.open_graph,
    category: "Technical", score, weight: FACTOR_WEIGHTS.open_graph,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.open_graph * 100) / 100,
    status: status(score),
    details: `${pagesWithCore}/${pages.length} pages have core OG tags (title, description, image). Avg completeness: ${(avgCompleteness * 100).toFixed(0)}%.`,
    recommendations: coreCoverage < 0.8 ? ["Add og:title, og:description, og:image to all pages."] : [],
  };
}

function scorePageSpeedFromData(pages: { load_time_ms: number }[]): FactorScoreResult {
  const ttfbs = pages.map((p) => p.load_time_ms || 500);
  const avgTtfb = avg(ttfbs);
  const fastPages = ttfbs.filter((t) => t < 200).length;
  const fastPct = fastPages / Math.max(ttfbs.length, 1);
  const sorted = [...ttfbs].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || avgTtfb;

  let avgComp: number;
  if (avgTtfb <= 200) avgComp = 1.0;
  else if (avgTtfb <= 500) avgComp = 1.0 - ((avgTtfb - 200) / 300 * 0.6);
  else if (avgTtfb <= 1000) avgComp = 0.4 - ((avgTtfb - 500) / 500 * 0.3);
  else avgComp = Math.max(0.1 - ((avgTtfb - 1000) / 2000 * 0.1), 0);

  let p95Comp: number;
  if (p95 <= 500) p95Comp = 1.0;
  else if (p95 <= 1000) p95Comp = 0.6;
  else if (p95 <= 2000) p95Comp = 0.3;
  else p95Comp = 0.0;

  const score = clamp(avgComp * 45 + fastPct * 35 + p95Comp * 20);

  return {
    factor_id: "page_speed", name: FACTOR_NAMES.page_speed,
    category: "Technical", score, weight: FACTOR_WEIGHTS.page_speed,
    weighted_score: Math.round(score * FACTOR_WEIGHTS.page_speed * 100) / 100,
    status: status(score),
    details: `Avg load time: ${Math.round(avgTtfb)}ms. ${(fastPct * 100).toFixed(0)}% pages under 200ms. P95: ${Math.round(p95)}ms.`,
    recommendations: avgTtfb > 500 ? ["Optimize server response times — aim for TTFB under 200ms."] : [],
  };
}

// ─── Main scoring function ──────────────────────────────────

export function computeAlgorithmicFactorScores(
  pages: ExtractedPageData[],
  pagesWithLoadTime: { load_time_ms: number }[],
  robots: RobotsAnalysis,
  sitemap: SitemapAnalysis,
): FactorScoreResult[] {
  return [
    scoreSsr(pages),
    scoreRobots(robots),
    scoreSchema(pages),
    scoreHeadings(pages),
    scoreFaq(pages),
    scoreSitemap(sitemap),
    scoreAnswerFirst(pages),
    scorePageSpeedFromData(pagesWithLoadTime),
    scoreSemanticHtml(pages),
    scoreInternalLinking(pages),
    scoreAltText(pages),
    scoreCanonical(pages),
    scoreCleanUrls(pages),
    scoreContentFreshness(pages),
    scoreMetaDescriptions(pages),
    scoreHttps(pages),
    scoreMobileResponsive(pages),
    scoreTables(pages),
    scoreParagraphs(pages),
    scoreLists(pages),
    scoreJsDependency(pages),
    scoreStatusCodes(pages),
    scoreOpenGraph(pages),
    scoreReadability(pages),
    scoreEntityConsistency(pages),
  ];
}

// ─── Composite score & readiness ────────────────────────────

export function computeCompositeScore(factorScores: FactorScoreResult[]): {
  composite: number;
  readiness_level: number;
  readiness_label: string;
  category_scores: Record<string, number>;
  points_to_next_level: number;
  next_level: { level: number; label: string; threshold: number } | null;
} {
  const composite = factorScores.reduce((sum, f) => sum + f.score * f.weight, 0);
  const rounded = Math.round(composite * 10) / 10;

  // Readiness level
  let readinessIdx = 0;
  for (let i = READINESS_LEVELS.length - 1; i >= 0; i--) {
    if (rounded >= READINESS_LEVELS[i].threshold) { readinessIdx = i; break; }
  }

  // Category sub-scores
  const categories: Record<string, { weightedSum: number; totalWeight: number }> = {
    Technical: { weightedSum: 0, totalWeight: 0 },
    Content: { weightedSum: 0, totalWeight: 0 },
    Authority: { weightedSum: 0, totalWeight: 0 },
    Semantic: { weightedSum: 0, totalWeight: 0 },
  };
  for (const f of factorScores) {
    const cat = categories[f.category];
    if (cat) {
      cat.weightedSum += f.score * f.weight;
      cat.totalWeight += f.weight;
    }
  }
  const categoryScores: Record<string, number> = {};
  for (const [cat, data] of Object.entries(categories)) {
    categoryScores[cat.toLowerCase()] = data.totalWeight > 0
      ? Math.round(data.weightedSum / data.totalWeight * 10) / 10 : 0;
  }

  // Next level
  const nextIdx = readinessIdx + 1;
  const nextLevel = nextIdx < READINESS_LEVELS.length
    ? READINESS_LEVELS[nextIdx] : null;
  const pointsToNext = nextLevel ? Math.round((nextLevel.threshold - rounded) * 10) / 10 : 0;

  return {
    composite: rounded,
    readiness_level: READINESS_LEVELS[readinessIdx].level,
    readiness_label: READINESS_LEVELS[readinessIdx].label,
    category_scores: categoryScores,
    points_to_next_level: Math.max(pointsToNext, 0),
    next_level: nextLevel ? { level: nextLevel.level, label: nextLevel.label, threshold: nextLevel.threshold } : null,
  };
}

// ─── Top recommendations algorithm ──────────────────────────

export function computeTopRecommendations(
  factorScores: FactorScoreResult[],
): { priority: number; factor_id: string; factor_name: string; current_score: number; estimated_score_after_fix: number; potential_composite_gain: number; recommendation: string }[] {
  const recs: { priority: number; factor_id: string; factor_name: string; current_score: number; estimated_score_after_fix: number; potential_composite_gain: number; recommendation: string }[] = [];

  for (const f of factorScores) {
    if (f.score >= 80) continue;
    let estimated: number;
    if (f.score < 20) estimated = 70;
    else if (f.score < 40) estimated = 75;
    else if (f.score < 60) estimated = 80;
    else estimated = 85;
    const gain = Math.round((estimated - f.score) * f.weight * 100) / 100;
    const rec = f.recommendations[0] || `Improve ${f.name} to increase your GEO score.`;

    recs.push({
      priority: 0,
      factor_id: f.factor_id,
      factor_name: f.name,
      current_score: f.score,
      estimated_score_after_fix: estimated,
      potential_composite_gain: gain,
      recommendation: rec,
    });
  }

  recs.sort((a, b) => b.potential_composite_gain - a.potential_composite_gain);
  return recs.slice(0, 5).map((r, i) => ({ ...r, priority: i + 1 }));
}
