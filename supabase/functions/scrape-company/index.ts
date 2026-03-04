import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import {
  extractFromHtml,
  parseRobotsTxt,
  analyzeSitemap,
  type ExtractedPageData,
} from "./geo-extract.ts";
import {
  fetchHeadlessBatch,
  computeSsrRatio,
  computeMobileParity,
} from "./headless-fetch.ts";
import {
  computeAlgorithmicFactorScores,
  computeCompositeScore,
  computeTopRecommendations,
} from "./geo-scoring.ts";

const SCRAPE_TIMEOUT_MS = 8_000;
const CRAWL_DELAY_MS = 300;

/**
 * Scrape Company Edge Function
 * Two-phase background processing:
 * - POST { action: 'scrape' }  → Phase 1: Fetch robots.txt, sitemap, scrape pages
 * - POST { action: 'analyze' } → Phase 2: Compute factor scores + AI analysis
 */

// ─── Helpers ────────────────────────────────────────────────

import { fetchSafe, fetchWithRedirectChain, extractLinksFromHtml, MAX_PAGES_TO_SCRAPE } from "./fetch-utils.ts";

// extractLinksFromHtml is imported from fetch-utils.ts

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractUrlsFromSitemap(xml: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>([\s\S]*?)<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url.endsWith(".xml") || url.endsWith(".xml.gz")) continue;
    if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|mp4|mp3)$/i.test(url)) continue;
    urls.push(url);
  }
  return urls;
}

async function updateCompany(
  db: any,
  companyId: string,
  data: Record<string, unknown>,
) {
  const { error } = await db
    .from("companies")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", companyId);
  if (error) console.error("[scrape-company] DB company update error:", error);
}

async function updateAnalysis(
  db: any,
  analysisId: string,
  data: Record<string, unknown>,
) {
  const { error } = await db
    .from("geo_analyses")
    .update(data)
    .eq("id", analysisId);
  if (error) console.error("[scrape-company] DB analysis update error:", error);
}

async function createAnalysis(
  db: any,
  companyId: string,
): Promise<string> {
  const { data, error } = await db
    .from("geo_analyses")
    .insert({ company_id: companyId, status: "pending", progress: 0 })
    .select("id")
    .single();
  if (error) {
    console.error("[scrape-company] Failed to create analysis:", error);
    throw new Error("Failed to create analysis record");
  }
  return data.id;
}

async function getLatestAnalysis(
  db: any,
  companyId: string,
): Promise<any | null> {
  const { data, error } = await db
    .from("geo_analyses")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

// ─── Main Handler ───────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId, user } = await verifyAuth(req);
    const db = createAdminClient();

    if (req.method !== "POST") {
      return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }

    // Verify tenant membership + role
    const { data: tenantUser, error: tuErr } = await db
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single();

    if (tuErr || !tenantUser) {
      return withCors(req, badRequest("User not found in tenant."));
    }

    if (tenantUser.role !== "owner" && tenantUser.role !== "admin") {
      return withCors(
        req,
        badRequest("Only owners and admins can perform this action."),
      );
    }

    // Find company belonging to tenant
    const { data: company, error: cErr } = await db
      .from("companies")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    if (cErr || !company) {
      return withCors(req, badRequest("No company linked to this tenant."));
    }

    const body = await req.json().catch(() => ({ action: "scrape" }));
    const { action } = body;

    if (action !== "scrape" && action !== "analyze" && action !== "reset" && action !== "pre-analyze") {
      return withCors(
        req,
        badRequest("Invalid action. Must be 'scrape', 'analyze', 'reset', or 'pre-analyze'."),
      );
    }

    // ─── ACTION: PRE-ANALYZE ─────────────────────────────
    // Quick homepage-only crawl + algorithmic GEO scores.
    // Returns everything synchronously, no DB writes.
    // Used by the onboarding flow to show a GEO preview.

    if (action === "pre-analyze") {
      const preAnalyzeDomain = (body.domain || company.domain || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!preAnalyzeDomain) {
        return withCors(req, badRequest("Domain is required for pre-analyze."));
      }

      const baseUrl = `https://${preAnalyzeDomain}`;
      console.log(`[pre-analyze] ▶ Starting quick analysis for ${preAnalyzeDomain}`);

      // 1. robots.txt
      let robotsTxt: string | null = null;
      const robotsRes = await fetchSafe(`${baseUrl}/robots.txt`);
      if (robotsRes?.ok) {
        robotsTxt = await robotsRes.text();
      }

      // 2. sitemap.xml
      let sitemapXml: string | null = null;
      const sitemapRes = await fetchSafe(`${baseUrl}/sitemap.xml`);
      if (sitemapRes?.ok) {
        sitemapXml = await sitemapRes.text();
      }

      // 3. llms.txt
      let llmsTxt: string | null = null;
      const llmsRes = await fetchSafe(`${baseUrl}/llms.txt`);
      if (llmsRes?.ok) {
        llmsTxt = await llmsRes.text();
      }

      // 4. Homepage crawl
      let homePageData: Record<string, unknown> | null = null;
      try {
        const homeStartTime = Date.now();
        const { response: homeRes, redirect_chain: homeRedirects } = await fetchWithRedirectChain(`${baseUrl}/`, 8000);
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
      } catch (err) {
        homePageData = {
          url: `${baseUrl}/`,
          status_code: 0,
          load_time_ms: 0,
          redirect_chain: [`${baseUrl}/`],
          error: "Scraping error",
        };
      }

      // 5. Compute algorithmic factor scores from homepage data
      const extractedPages: ExtractedPageData[] = homePageData && (homePageData as any).headings
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

      console.log(`[pre-analyze] ✓ Quick analysis complete. GEO Score: ${compositeResult.composite}/100`);

      return withCors(
        req,
        ok({
          domain: preAnalyzeDomain,
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
          home_page: homePageData,
        }),
      );
    }

    const domain = company.domain;

    // ─── ACTION: RESET ────────────────────────────────────
    // Clears all extracted data so analysis can restart from scratch.
    // SA-only access is enforced on the frontend.

    if (action === "reset") {

      // Reset company profile fields
      await updateCompany(db, company.id, {
        website_title: null,
        meta_description: null,
        meta_keywords: null,
        og_image: null,
        favicon_url: null,
        language: null,
        company_name: null,
        industry: null,
        country: null,
        tags: [],
      });

      // Create a fresh analysis record
      await createAnalysis(db, company.id);

      return withCors(
        req,
        ok({
          success: true,
          message: "Company data reset successfully. Ready for re-analysis.",
        }),
      );
    }

    // ─── ACTION: SCRAPE ───────────────────────────────────
    // Foreground-only: homepage + URL discovery.
    // Background crawling of remaining pages is handled by crawl-pages cron.

    if (action === "scrape") {
      const t0 = Date.now();
      console.log(`[scrape] ▶ Starting foreground scrape for ${domain}`);

      // Create or reuse a pending analysis record
      let analysis = await getLatestAnalysis(db, company.id);
      
      // Enforce 7-day cooldown for non-admins if an analysis exists and is completed
      if (analysis && analysis.status === 'completed' && analysis.completed_at) {
        // Query the profile to check for system administrator access
        const { data: profile } = await db
          .from("profiles")
          .select("is_sa")
          .eq("id", user.id)
          .single();
          
        const isSuperadmin = profile?.is_sa === true;
        const msSinceAnalysis = Date.now() - new Date(analysis.completed_at).getTime();
        const daysSinceAnalysis = msSinceAnalysis / (1000 * 60 * 60 * 24);
        
        if (daysSinceAnalysis < 7 && !isSuperadmin) {
          return withCors(
            req,
            badRequest("Please wait at least 7 days between analyses.")
          );
        }
      }

      let analysisId: string;
      if (!analysis || analysis.status === 'completed' || analysis.status === 'error') {
        analysisId = await createAnalysis(db, company.id);
        console.log(`[scrape] Created new analysis record: ${analysisId}`);
      } else {
        analysisId = analysis.id;
        console.log(`[scrape] Reusing analysis record: ${analysisId}`);
      }

      await updateAnalysis(db, analysisId, {
        status: "scraping",
        progress: 2,
        error_message: null,
        status_message: `Starting analysis for ${domain}…`,
      });

      const baseUrl = `https://${domain}`;

      // ── Step 1: robots.txt ─────────────────────────────
      console.log(`[scrape] Step 1: Fetching robots.txt…`);
      await updateAnalysis(db, analysisId, {
        progress: 3,
        status_message: `Checking robots.txt for AI crawler permissions…`,
      });
      let robotsTxt: string | null = null;
      const robotsRes = await fetchSafe(`${baseUrl}/robots.txt`);
      if (robotsRes?.ok) {
        robotsTxt = await robotsRes.text();
        console.log(`[scrape] robots.txt found (${robotsTxt.length} bytes)`);
      } else {
        console.log(`[scrape] robots.txt not found`);
      }
      await updateAnalysis(db, analysisId, {
        robots_txt: robotsTxt,
        progress: 5,
        status_message: robotsTxt
          ? `robots.txt found — checking AI bot access rules…`
          : `No robots.txt found — AI bots have full access by default`,
      });

      // ── Step 2: sitemap.xml ────────────────────────────
      console.log(`[scrape] Step 2: Fetching sitemap.xml…`);
      await updateAnalysis(db, analysisId, {
        progress: 6,
        status_message: `Looking for XML sitemap…`,
      });
      let sitemapXml: string | null = null;
      const sitemapRes = await fetchSafe(`${baseUrl}/sitemap.xml`);
      if (sitemapRes?.ok) {
        sitemapXml = await sitemapRes.text();
        console.log(`[scrape] sitemap.xml found (${sitemapXml.length} bytes)`);
      } else {
        console.log(`[scrape] sitemap.xml not found`);
      }
      await updateAnalysis(db, analysisId, {
        sitemap_xml: sitemapXml,
        progress: 8,
        status_message: sitemapXml
          ? `Sitemap found — extracting page URLs…`
          : `No sitemap found — will discover pages from links`,
      });

      // ── Step 3: llms.txt ───────────────────────────────
      console.log(`[scrape] Step 3: Fetching llms.txt…`);
      let llmsTxt: string | null = null;
      const llmsRes = await fetchSafe(`${baseUrl}/llms.txt`);
      if (llmsRes?.ok) {
        llmsTxt = await llmsRes.text();
        console.log(`[scrape] llms.txt found (${llmsTxt.length} bytes)`);
      }
      await updateAnalysis(db, analysisId, {
        llms_txt: llmsTxt,
        progress: 10,
        status_message: llmsTxt
          ? `LLMs.txt found — AI-specific instructions detected`
          : `No llms.txt file found`,
      });

      // ── Step 4: Homepage crawl + URL discovery ─────────
      console.log(`[scrape] Step 4: Crawling homepage for URL discovery…`);
      await updateAnalysis(db, analysisId, {
        progress: 12,
        status_message: `Analyzing homepage and discovering page URLs…`,
      });

      let pageUrls: string[] = [];
      // Start with sitemap URLs — capped at MAX_PAGES_TO_SCRAPE
      if (sitemapXml) {
        const allSitemapUrls = extractUrlsFromSitemap(sitemapXml);
        pageUrls = allSitemapUrls.slice(0, MAX_PAGES_TO_SCRAPE);
        console.log(`[scrape] Extracted ${allSitemapUrls.length} URLs from sitemap, using ${pageUrls.length} (max ${MAX_PAGES_TO_SCRAPE})`);
      }
      // Ensure homepage is first
      if (
        !pageUrls.includes(baseUrl) &&
        !pageUrls.includes(`${baseUrl}/`)
      ) {
        pageUrls.unshift(`${baseUrl}/`);
      }

      // Crawl homepage directly to extract links
      let homePageData: Record<string, unknown> | null = null;
      let homeHtml: string | null = null;
      try {
        const homeStartTime = Date.now();
        const { response: homeRes, redirect_chain: homeRedirects } = await fetchWithRedirectChain(`${baseUrl}/`, 8000);
        const homeLoadTime = Date.now() - homeStartTime;
        console.log(`[scrape] Homepage direct fetch: ${homeLoadTime}ms, status=${homeRes?.status || 'timeout'}`);

        if (homeRes?.ok) {
          homeHtml = await homeRes.text();
          const extracted = extractFromHtml(homeHtml, `${baseUrl}/`, homeRes.headers);

          // Save company profile from homepage
          await updateCompany(db, company.id, {
            website_title: extracted.title,
            meta_description: extracted.meta_description,
            meta_keywords: extracted.meta_keywords,
            og_image: extracted.og_image,
            favicon_url: null,
            language: extracted.language,
          });

          homePageData = {
            ...extracted,
            load_time_ms: homeLoadTime,
            ttfb_ms: homeLoadTime,
            status_code: homeRes.status,
            redirect_chain: homeRedirects,
          };

          // Discover links from homepage (capped at MAX_PAGES_TO_SCRAPE total)
          const discoveredLinks = extractLinksFromHtml(homeHtml, baseUrl);
          console.log(`[scrape] Discovered ${discoveredLinks.length} links from homepage`);
          const existing = new Set(pageUrls.map(u => u.replace(/\/$/, "")));
          for (const link of discoveredLinks) {
            if (pageUrls.length >= MAX_PAGES_TO_SCRAPE) break;
            const clean = link.replace(/\/$/, "");
            if (!existing.has(clean)) {
              pageUrls.push(link);
              existing.add(clean);
            }
          }
        } else {
          homePageData = {
            url: `${baseUrl}/`,
            status_code: homeRes?.status || 0,
            load_time_ms: homeLoadTime,
            redirect_chain: homeRedirects,
            error: homeRes ? `HTTP ${homeRes.status}` : "Timeout or unreachable",
          };
        }
      } catch (err) {
        console.warn(`[scrape] Homepage fetch failed:`, (err as Error).message);
        homePageData = {
          url: `${baseUrl}/`,
          status_code: 0,
          load_time_ms: 0,
          redirect_chain: [`${baseUrl}/`],
          error: "Scraping error",
        };
      }

      // Also try homepage via Browserless for link discovery + SSR comparison
      const browserlessKey = Deno.env.get("BROWSERLESS_API_KEY");
      if (browserlessKey && homeHtml) {
        console.log(`[scrape] Fetching homepage via Browserless for SSR comparison…`);
        try {
          const headlessResults = await fetchHeadlessBatch([`${baseUrl}/`], browserlessKey, 1);
          const hr = headlessResults.get(`${baseUrl}/`);
          if (hr?.desktop_html) {
            const rawTextLen = homeHtml.length;
            const ssrRatio = computeSsrRatio(homeHtml, hr.desktop_html);
            const mobileParity = computeMobileParity(hr.desktop_text_length, hr.mobile_text_length);
            (homePageData as any).headless = {
              ssr_ratio: ssrRatio,
              mobile_parity: mobileParity,
              rendered_text_length: hr.desktop_text_length,
              raw_text_length: rawTextLen,
              mobile_text_length: hr.mobile_text_length,
            };
            console.log(`[scrape] Homepage SSR ratio: ${ssrRatio.toFixed(2)}`);

            // Discover links from rendered HTML too
            const renderedLinks = extractLinksFromHtml(hr.desktop_html, baseUrl);
            console.log(`[scrape] Discovered ${renderedLinks.length} links from rendered homepage`);
            const existingSet = new Set(pageUrls.map(u => u.replace(/\/$/, "")));
            for (const link of renderedLinks) {
              if (pageUrls.length >= MAX_PAGES_TO_SCRAPE) break;
              const clean = link.replace(/\/$/, "");
              if (!existingSet.has(clean)) {
                pageUrls.push(link);
                existingSet.add(clean);
              }
            }
          }
        } catch (err) {
          console.warn(`[scrape] Browserless homepage failed (non-fatal):`, (err as Error).message);
        }
      }

      // Final cap — ensure we never exceed MAX_PAGES_TO_SCRAPE
      pageUrls = pageUrls.slice(0, MAX_PAGES_TO_SCRAPE);
      const totalPages = pageUrls.length;
      console.log(`[scrape] Total pages to scrape: ${totalPages} (max ${MAX_PAGES_TO_SCRAPE})`);

      // ── Step 6: Insert all URLs into geo_analyses_pages ──
      console.log(`[scrape] Step 6: Saving ${totalPages} page URLs to database…`);
      await updateAnalysis(db, analysisId, {
        progress: 14,
        status_message: `Discovered ${totalPages} pages. Saving and scheduling background crawl…`,
      });

      // Insert homepage as completed (page_order = 0)
      await db.from("geo_analyses_pages").insert({
        analysis_id: analysisId,
        url: pageUrls[0],
        status: "completed",
        page_order: 0,
        status_code: (homePageData as any)?.status_code || 0,
        load_time_ms: (homePageData as any)?.load_time_ms || 0,
        redirect_chain: (homePageData as any)?.redirect_chain || [pageUrls[0]],
        page_data: homePageData,
        headless_data: (homePageData as any)?.headless || null,
        error_message: (homePageData as any)?.error || null,
        crawled_at: new Date().toISOString(),
      });

      // Insert remaining URLs as pending
      if (pageUrls.length > 1) {
        const pendingRows = pageUrls.slice(1).map((url, idx) => ({
          analysis_id: analysisId,
          url,
          status: "pending",
          page_order: idx + 1,
        }));
        const batchSize = 50;
        for (let i = 0; i < pendingRows.length; i += batchSize) {
          const batch = pendingRows.slice(i, i + batchSize);
          const { error: insertErr } = await db.from("geo_analyses_pages").insert(batch);
          if (insertErr) console.error(`[scrape] Error inserting page batch:`, insertErr);
        }
      }

      // ── Step 7: Update analysis and return fast ────────
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[scrape] ✓ Foreground scrape complete in ${elapsed}s. ${totalPages} pages queued.`);

      await updateAnalysis(db, analysisId, {
        crawled_pages: homePageData ? [homePageData] : [],
        pages_crawled: 1,
        total_pages: totalPages,
        progress: 15,
        status_message: totalPages > 1
          ? `Homepage analyzed. Crawling ${totalPages - 1} remaining pages in the background…`
          : `Homepage analyzed. Starting AI analysis…`,
      });

      // If only homepage, go straight to scraping_done
      if (totalPages <= 1) {
        await updateAnalysis(db, analysisId, {
          status: "scraping_done",
          progress: 48,
          status_message: `Scraping complete — 1 page crawled. Starting AI analysis…`,
        });
      }

      return withCors(
        req,
        ok({
          success: true,
          message: `Homepage analyzed. ${totalPages - 1} pages queued for background crawling.`,
          data: { total_pages: totalPages, pages_scraped: 1 },
        }),
      );
    }

    // ─── ACTION: ANALYZE ──────────────────────────────────

    if (action === "analyze") {
      // Find the latest analysis record
      const analysis = await getLatestAnalysis(db, company.id);
      if (!analysis) {
        return withCors(req, badRequest("No analysis record found. Run 'scrape' first."));
      }

      // Allow retry from 'error' or stale 'analyzing' (edge function timeout)
      if (
        analysis.status !== "scraping_done" &&
        analysis.status !== "error" &&
        analysis.status !== "analyzing"
      ) {
        return withCors(
          req,
          badRequest(
            "Analysis must be in 'scraping_done' or 'error' status to analyze.",
          ),
        );
      }

      const analysisId = analysis.id;

      await updateAnalysis(db, analysisId, {
        status: "analyzing",
        progress: 50,
        error_message: null,
        status_message: `Computing algorithmic GEO factor scores…`,
      });
      console.log(`[analyze] ▶ Starting AI analysis for ${domain}`);

      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        await updateAnalysis(db, analysisId, {
          status: "error",
          error_message: "ANTHROPIC_API_KEY not configured",
        });
        return withCors(
          req,
          serverError("ANTHROPIC_API_KEY is not configured"),
        );
      }

      // 1. Compute algorithmic factor scores for all 25 GEO factors

      const pagesData = Array.isArray(analysis.crawled_pages) ? analysis.crawled_pages : [];
      const extractedPages: ExtractedPageData[] = pagesData
        .filter((p: any) => !p.error && p.headings)
        .map((p: any) => p as ExtractedPageData);

      const robotsAnalysis = parseRobotsTxt(analysis.robots_txt);
      const sitemapAnalysis = analyzeSitemap(
        analysis.sitemap_xml,
        robotsAnalysis,
        pagesData.map((p: any) => p.url),
      );

      const algorithmicScores = computeAlgorithmicFactorScores(
        extractedPages,
        pagesData.map((p: any) => ({
          load_time_ms: p.load_time_ms || 500,
        })),
        robotsAnalysis,
        sitemapAnalysis,
      );

      await updateAnalysis(db, analysisId, {
        progress: 58,
        status_message: `Computed ${algorithmicScores.length} factor scores. Preparing AI analysis…`,
      });
      console.log(`[analyze] Computed ${algorithmicScores.length} algorithmic factor scores`);

      // 3. Build AI prompt for content-quality factors + business intelligence
      const targetLang = company.target_language || "en";
      const langNames: Record<string, string> = {
        en: "English", pt: "Portuguese", es: "Spanish", fr: "French",
        de: "German", it: "Italian", nl: "Dutch", pl: "Polish",
        ru: "Russian", ja: "Japanese", ko: "Korean", zh: "Chinese",
        ar: "Arabic", hi: "Hindi", tr: "Turkish", sv: "Swedish",
        da: "Danish", no: "Norwegian", fi: "Finnish",
      };
      const targetLangName = langNames[targetLang] || targetLang;

      const pagesContext = pagesData
        .slice(0, 10)
        .map((p: any) => {
          return `URL: ${p.url}\nTitle: ${p.title || "N/A"}\nH1: ${p.h1 || "N/A"}\nMeta: ${p.meta_description || "N/A"}\nContent: ${(p.content_summary || "").slice(0, 1000)}\nWord Count: ${p.word_count || 0}\nStructured Data: ${p.has_structured_data ? "Yes" : "No"}`;
        })
        .join("\n---\n");



      // Pre-computed scores summary for AI context
      const algoSummary = algorithmicScores
        .map(
          (f) =>
            `${f.name}: ${f.score}/100 (${f.status})`,
        )
        .join("\n");

      const bilingualBlock =
        targetLang === "en"
          ? `All text fields must be in English. Output format: { "en": { <full response> } }`
          : `Output in TWO languages. ALL text fields (summary, strengths, weaknesses) must be fully translated.\nOutput format: { "en": { <response in English> }, "${targetLang}": { <response in ${targetLangName}> } }`;

      const prompt = `You are an expert GEO (Generative Engine Optimization) analyst. Analyze this website and provide business intelligence.

WEBSITE: ${company.domain}
TITLE: ${company.website_title || "N/A"}
META: ${company.meta_description || "N/A"}
LANG: ${company.language || "N/A"}

ROBOTS.TXT: ${analysis.robots_txt ? "Present" : "Not found"}
AI BOT ACCESS: ${JSON.stringify(robotsAnalysis.bot_status, null, 2)}
SITEMAP: ${analysis.sitemap_xml ? "Present" : "Not found"}

ALREADY COMPUTED GEO FACTOR SCORES (25 factors, do NOT re-evaluate these — they are algorithmically computed):
${algoSummary}

PAGES (${pagesData.length} total):
${pagesContext}

INSTRUCTIONS:
1. Based on the pre-computed factor scores above and the page content, derive strengths and weaknesses. The strengths MUST justify the factors that scored Excellent/Good. The weaknesses MUST justify and provide context for the factors that scored Warning/Critical. Do NOT generate new recommendations, these are handled algorithmically.
2. Generate a company summary with industry classification and business intelligence.
3. Identify competitors and products/services.

Each language version must follow this EXACT JSON structure:
{
  "summary": "2-3 paragraph company summary with GEO findings",
  "company_name": "Brand name",
  "industry": "Primary industry",
  "country": "Country of operation",
  "market": "Target market",
  "tags": ["up to 10 tags"],
  "categories": ["up to 5 categories"],
  "products_services": [{"name": "...", "description": "...", "type": "product|service"}],
  "competitors": ["..."],
  "content_quality": "excellent|good|fair|poor",
  "structured_data_coverage": "comprehensive|partial|none",
  "ai_bot_access": ${JSON.stringify(robotsAnalysis.bot_status)},
  "schema_markup_types": ${JSON.stringify([...new Set(extractedPages.flatMap((p) => p.schema.detected_types))])},
  "strengths": ["Derived directly from the high-scoring factors in the scorecard to explain why they are good..."],
  "weaknesses": ["Derived directly from the low-scoring factors in the scorecard to explain the impact of these issues..."]
}

${bilingualBlock}

Respond with ONLY the JSON object, no markdown fences.`;

      await updateAnalysis(db, analysisId, {
        progress: 62,
        status_message: `Sending data to AI for company analysis and recommendations…`,
      });
      console.log(`[analyze] Sending prompt to Anthropic API…`);

      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8192,
            temperature: 0,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("[scrape-company] Anthropic API error:", errText);
          await updateAnalysis(db, analysisId, {
            status: "error",
            error_message: "AI analysis failed",
          });
          return withCors(req, serverError("AI analysis failed."));
        }

        const data = await res.json();
        const assistantMsg = data.content?.[0]?.text;

        if (!assistantMsg) {
          await updateAnalysis(db, analysisId, {
            status: "error",
            error_message: "AI returned empty response",
          });
          return withCors(
            req,
            serverError("AI returned empty response."),
          );
        }

        await updateAnalysis(db, analysisId, {
          progress: 78,
          status_message: `AI response received — processing results…`,
        });
        console.log(`[analyze] AI response received, parsing…`);

        let bilingualReport: any;
        try {
          bilingualReport = JSON.parse(assistantMsg.trim());
        } catch {
          const jsonMatch = assistantMsg.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            bilingualReport = JSON.parse(jsonMatch[0]);
          } else {
            await updateAnalysis(db, analysisId, {
              status: "error",
              error_message: "AI produced invalid JSON",
            });
            return withCors(
              req,
              serverError("AI produced invalid JSON output."),
            );
          }
        }

        // Extract English report
        const enReport = bilingualReport.en || bilingualReport;
        if (!bilingualReport.en) {
          bilingualReport = { en: bilingualReport };
          if (targetLang !== "en") {
            bilingualReport[targetLang] = bilingualReport.en;
          }
        }

        await updateAnalysis(db, analysisId, {
          progress: 85,
          status_message: `Computing composite GEO score and readiness level…`,
        });

        // 4. All 25 factor scores are algorithmically computed
        const allFactorScores = algorithmicScores;

        const compositeResult = computeCompositeScore(allFactorScores);
        const topRecommendations =
          computeTopRecommendations(allFactorScores);

        // 7. Inject factor scores into bilingual report
        for (const lang of Object.keys(bilingualReport)) {
          if (bilingualReport[lang]) {
            bilingualReport[lang].geo_score =
              compositeResult.composite;
            bilingualReport[lang].factor_scores = allFactorScores;
            bilingualReport[lang].composite_score =
              compositeResult.composite;
            bilingualReport[lang].readiness_level =
              compositeResult.readiness_level;
            bilingualReport[lang].readiness_label =
              compositeResult.readiness_label;
            bilingualReport[lang].category_scores =
              compositeResult.category_scores;
            bilingualReport[lang].points_to_next_level =
              compositeResult.points_to_next_level;
            bilingualReport[lang].next_level =
              compositeResult.next_level;
            bilingualReport[lang].top_recommendations =
              topRecommendations;
          }
        }

        await updateAnalysis(db, analysisId, {
          progress: 92,
          status_message: `Finalizing report and saving results…`,
        });

        // 8. Save analysis results
        await updateAnalysis(db, analysisId, {
          ai_report: bilingualReport,
          geo_score: compositeResult.composite,
          readiness_level: compositeResult.readiness_level,
          status: "completed",
          progress: 100,
          completed_at: new Date().toISOString(),
          status_message: `Analysis complete! GEO Score: ${compositeResult.composite}/100`,
        });
        console.log(`[analyze] ✓ Analysis complete. GEO Score: ${compositeResult.composite}/100`);

        // Auto-fill LLM columns from analyzed data (no extra API calls)
        if (company.domain && !company.llm_txt) {
          try {
            console.log(`[analyze] Building LLM data from analysis results for ${company.domain}...`);

            // Build metatags from company metadata
            const metaParts: string[] = [];
            if (company.meta_description) metaParts.push(`Description: ${company.meta_description}`);
            if (company.meta_keywords) metaParts.push(`Keywords: ${company.meta_keywords}`);
            if (enReport.tags?.length) metaParts.push(`Tags: ${enReport.tags.join(', ')}`);
            if (enReport.categories?.length) metaParts.push(`Categories: ${enReport.categories.join(', ')}`);
            const metatags = metaParts.join('\n') || null;

            // Build extracted_content from AI report + page summaries
            const contentParts: string[] = [];
            if (enReport.summary) contentParts.push(enReport.summary);
            if (enReport.products_services?.length) {
              const psList = enReport.products_services
                .map((ps: any) => `- ${ps.name}: ${ps.description} (${ps.type})`)
                .join('\n');
              contentParts.push(`\nProducts & Services:\n${psList}`);
            }
            if (enReport.strengths?.length) {
              contentParts.push(`\nStrengths: ${enReport.strengths.join(', ')}`);
            }
            // Add top page content summaries
            const pageSummaries = pagesData
              .filter((p: any) => p.content_summary && !p.error)
              .slice(0, 10)
              .map((p: any) => `- ${p.title || p.url}: ${p.content_summary}`)
              .join('\n');
            if (pageSummaries) contentParts.push(`\nKey Pages:\n${pageSummaries}`);
            const extracted_content = contentParts.join('\n') || null;

            // Build llm.txt markdown from all available data
            const llmParts: string[] = [];
            llmParts.push(`# ${enReport.company_name || company.website_title || company.domain}`);
            llmParts.push('');
            if (enReport.summary) {
              llmParts.push(`> ${enReport.summary}`);
              llmParts.push('');
            }
            llmParts.push(`- **Website**: https://${company.domain}`);
            if (enReport.industry) llmParts.push(`- **Industry**: ${enReport.industry}`);
            if (enReport.country) llmParts.push(`- **Country**: ${enReport.country}`);
            if (enReport.market) llmParts.push(`- **Market**: ${enReport.market}`);
            llmParts.push('');

            if (enReport.products_services?.length) {
              llmParts.push('## Products & Services');
              llmParts.push('');
              for (const ps of enReport.products_services) {
                llmParts.push(`### ${ps.name}`);
                llmParts.push(`${ps.description}`);
                llmParts.push('');
              }
            }

            if (enReport.strengths?.length) {
              llmParts.push('## Strengths');
              llmParts.push('');
              for (const s of enReport.strengths) llmParts.push(`- ${s}`);
              llmParts.push('');
            }

            if (enReport.categories?.length) {
              llmParts.push('## Categories');
              llmParts.push('');
              for (const c of enReport.categories) llmParts.push(`- ${c}`);
              llmParts.push('');
            }

            // Key pages section
            const topPages = pagesData
              .filter((p: any) => p.title && !p.error)
              .slice(0, 15);
            if (topPages.length > 0) {
              llmParts.push('## Key Pages');
              llmParts.push('');
              for (const p of topPages) {
                llmParts.push(`- [${p.title}](${p.url}): ${p.meta_description || p.content_summary || ''}`);
              }
              llmParts.push('');
            }

            if (enReport.tags?.length) {
              llmParts.push(`## Tags`);
              llmParts.push('');
              llmParts.push(enReport.tags.join(', '));
              llmParts.push('');
            }

            const llm_txt = llmParts.join('\n');

            // Save all LLM data to companies table
            await updateCompany(db, company.id, {
              metatags,
              extracted_content,
              llm_txt,
              llm_txt_status: 'outdated',
            });
            console.log(`[analyze] ✓ LLM data filled for company ${company.id}`);
          } catch (llmErr: any) {
            console.error(`[analyze] LLM data generation failed (non-fatal):`, llmErr?.message || llmErr);
          }
        }

        // Update company profile with denormalized fields
        await updateCompany(db, company.id, {
          company_name: enReport.company_name || null,
          industry: enReport.industry || null,
          country: enReport.country || null,
          tags: enReport.tags || [],
        });

        return withCors(
          req,
          ok({
            success: true,
            message: "AI analysis completed successfully.",
            data: bilingualReport,
          }),
        );
      } catch (err) {
        console.error("[scrape-company] AI analysis error:", err);
        // Fallback: save algorithmic scores even if AI fails
        console.log(`[analyze] AI failed, saving algorithmic scores as fallback…`);
        try {
          const compositeResult = computeCompositeScore(algorithmicScores);
          const topRecs = computeTopRecommendations(algorithmicScores);
          const fallbackReport = {
            en: {
              summary: `AI analysis timed out. The 25 GEO factor scores were computed algorithmically.`,
              geo_score: compositeResult.composite,
              factor_scores: algorithmicScores,
              composite_score: compositeResult.composite,
              readiness_level: compositeResult.readiness_level,
              readiness_label: compositeResult.readiness_label,
              category_scores: compositeResult.category_scores,
              points_to_next_level: compositeResult.points_to_next_level,
              next_level: compositeResult.next_level,
              top_recommendations: topRecs,
              strengths: [],
              weaknesses: [],
            },
          };
          await updateAnalysis(db, analysisId, {
            ai_report: fallbackReport,
            geo_score: compositeResult.composite,
            readiness_level: compositeResult.readiness_level,
            status: "completed",
            progress: 100,
            completed_at: new Date().toISOString(),
            status_message: `Analysis complete (AI insights limited). GEO Score: ${compositeResult.composite}/100`,
          });

          // Auto-fill basic LLM data on fallback path (limited without AI insights)
          if (company.domain && !company.llm_txt) {
            try {
              const metaParts: string[] = [];
              if (company.meta_description) metaParts.push(`Description: ${company.meta_description}`);
              if (company.meta_keywords) metaParts.push(`Keywords: ${company.meta_keywords}`);
              const metatags = metaParts.join('\n') || null;

              const pageSummaries = pagesData
                .filter((p: any) => p.content_summary && !p.error)
                .slice(0, 10)
                .map((p: any) => `- ${p.title || p.url}: ${p.content_summary}`)
                .join('\n');
              const extracted_content = pageSummaries || null;

              const llmParts: string[] = [];
              llmParts.push(`# ${company.website_title || company.domain}`);
              llmParts.push('');
              llmParts.push(`- **Website**: https://${company.domain}`);
              llmParts.push('');
              if (pageSummaries) {
                llmParts.push('## Key Pages');
                llmParts.push('');
                const topPages = pagesData.filter((p: any) => p.title && !p.error).slice(0, 15);
                for (const p of topPages) {
                  llmParts.push(`- [${p.title}](${p.url}): ${p.meta_description || p.content_summary || ''}`);
                }
              }
              const llm_txt = llmParts.join('\n');

              await updateCompany(db, company.id, { metatags, extracted_content, llm_txt, llm_txt_status: 'outdated' });
              console.log(`[analyze] ✓ LLM data filled for company ${company.id} (fallback)`);
            } catch (llmErr: any) {
              console.error(`[analyze] LLM data generation failed on fallback (non-fatal):`, llmErr?.message || llmErr);
            }
          }

          return withCors(req, ok({
            success: true,
            message: "Analysis completed with algorithmic scores (AI timed out).",
            data: fallbackReport,
          }));
        } catch (fallbackErr) {
          console.error("[analyze] Fallback save also failed:", fallbackErr);
        }
        await updateAnalysis(db, analysisId, {
          status: "error",
          error_message: "Analysis failed unexpectedly",
        });
        return withCors(
          req,
          serverError("Analysis failed unexpectedly."),
        );
      }
    }
  } catch (err: unknown) {
    console.error("[scrape-company]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return withCors(
        req,
        new Response(
          JSON.stringify({
            success: false,
            error: {
              message: e.message,
              code:
                e.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
            },
          }),
          {
            status: e.status,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }
    return withCors(
      req,
      serverError(e.message || "Internal server error"),
    );
  }
});
