import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { ok, badRequest, forbidden, serverError } from "../_shared/response.ts";
import { verifyRecaptcha } from "../_shared/verify-recaptcha.ts";
import { createRequestLogger } from "../_shared/logger.ts";
import {
  extractFromHtml,
  parseRobotsTxt,
  analyzeSitemap,
  type ExtractedPageData,
} from "../scrape-company/geo-extract.ts";
import {
  computeAlgorithmicFactorScores,
  computeCompositeScore,
  computeTopRecommendations,
} from "../scrape-company/geo-scoring.ts";
import { fetchSafe, fetchWithRedirectChain } from "../scrape-company/fetch-utils.ts";

/**
 * free-analyze — PUBLIC endpoint (no auth required).
 * Lightweight homepage-only GEO analysis for the free landing page.
 * Accepts POST with { domain, recaptcha_token }.
 * Returns algorithmic GEO scores without AI suggestions or DB writes.
 */

serve(async (req: Request) => {
  const logger = createRequestLogger("free-analyze", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    if (req.method !== "POST") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)));
    }

    const body = await req.json();

    // ── Validate domain ──
    const rawDomain = (body.domain || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!rawDomain) {
      return logger.done(withCors(req, badRequest("domain is required")));
    }

    // ── Verify reCAPTCHA ──
    const recaptcha = await verifyRecaptcha(body.recaptcha_token, "free_analyze");
    if (!recaptcha.valid) {
      console.warn("[free-analyze] reCAPTCHA rejected — score:", recaptcha.score);
      return logger.done(withCors(req, forbidden("Security verification failed")));
    }

    const baseUrl = `https://${rawDomain}`;
    console.log(`[free-analyze] ▶ Starting free analysis for ${rawDomain}`);

    // ── 1. robots.txt ──
    let robotsTxt: string | null = null;
    const robotsRes = await fetchSafe(`${baseUrl}/robots.txt`);
    if (robotsRes?.ok) {
      robotsTxt = await robotsRes.text();
    }

    // ── 2. sitemap.xml ──
    let sitemapXml: string | null = null;
    const sitemapRes = await fetchSafe(`${baseUrl}/sitemap.xml`);
    if (sitemapRes?.ok) {
      sitemapXml = await sitemapRes.text();
    }

    // ── 3. llms.txt ──
    let llmsTxt: string | null = null;
    const llmsRes = await fetchSafe(`${baseUrl}/llms.txt`);
    if (llmsRes?.ok) {
      llmsTxt = await llmsRes.text();
    }

    // ── 4. Homepage crawl ──
    let homePageData: Record<string, unknown> | null = null;
    try {
      const homeStartTime = Date.now();
      const { response: homeRes, redirect_chain: homeRedirects } =
        await fetchWithRedirectChain(`${baseUrl}/`, 8000);
      const homeLoadTime = Date.now() - homeStartTime;

      if (homeRes?.ok) {
        const homeHtml = await homeRes.text();
        const extracted = extractFromHtml(homeHtml, `${baseUrl}/`, homeRes.headers);
        homePageData = {
          ...extracted,
          load_time_ms: homeLoadTime,
          ttfb_ms: homeLoadTime,
          status_code: homeRes.status,
          redirect_chain: homeRedirects,
        };
      } else {
        homePageData = {
          url: `${baseUrl}/`,
          status_code: homeRes?.status || 0,
          load_time_ms: 0,
          redirect_chain: [],
          error: homeRes ? `HTTP ${homeRes.status}` : "Timeout or unreachable",
        };
      }
    } catch {
      homePageData = {
        url: `${baseUrl}/`,
        status_code: 0,
        load_time_ms: 0,
        redirect_chain: [`${baseUrl}/`],
        error: "Scraping error",
      };
    }

    // ── 5. Compute algorithmic factor scores ──
    const extractedPages: ExtractedPageData[] =
      homePageData && (homePageData as any).headings
        ? [homePageData as unknown as ExtractedPageData]
        : [];

    const robotsAnalysis = parseRobotsTxt(robotsTxt);
    const sitemapAnalysis = analyzeSitemap(
      sitemapXml,
      robotsAnalysis,
      homePageData ? [(homePageData as any).url] : [],
    );

    const algorithmicScores = computeAlgorithmicFactorScores(
      extractedPages,
      homePageData ? [{ load_time_ms: (homePageData as any).load_time_ms || 500 }] : [],
      robotsAnalysis,
      sitemapAnalysis,
    );

    const compositeResult = computeCompositeScore(algorithmicScores);
    const topRecommendations = computeTopRecommendations(algorithmicScores);

    console.log(
      `[free-analyze] ✓ Analysis complete for ${rawDomain}. GEO Score: ${compositeResult.composite}/100`,
    );

    return logger.done(
      withCors(
        req,
        ok({
          domain: rawDomain,
          website_title: (homePageData as any)?.title || null,
          meta_description: (homePageData as any)?.meta_description || null,
          language: (homePageData as any)?.language || null,
          og_image: (homePageData as any)?.og_image || null,
          robots_txt: !!robotsTxt,
          sitemap_xml: !!sitemapXml,
          llms_txt: !!llmsTxt,
          geo_score: compositeResult.composite,
          readiness_level: compositeResult.readiness_level,
          readiness_label: compositeResult.readiness_label,
          category_scores: compositeResult.category_scores,
          points_to_next_level: compositeResult.points_to_next_level,
          next_level: compositeResult.next_level,
          factor_scores: algorithmicScores,
          top_recommendations: topRecommendations,
        }),
      ),
    );
  } catch (err) {
    console.error("[free-analyze]", err);
    return logger.done(
      withCors(req, serverError("Internal server error")),
    );
  }
});
