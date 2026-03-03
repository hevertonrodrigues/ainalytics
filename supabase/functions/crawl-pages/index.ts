import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, serverError, unauthorized } from "../_shared/response.ts";
import { extractFromHtml } from "../scrape-company/geo-extract.ts";
import { fetchWithRedirectChain, extractLinksFromHtml, MAX_PAGES_TO_SCRAPE } from "../scrape-company/fetch-utils.ts";
import { fetchHeadlessBatch, computeSsrRatio, computeMobileParity } from "../scrape-company/headless-fetch.ts";

/**
 * Crawl Pages Worker Edge Function
 *
 * Invoked by pg_cron (via pg_net) every 1 minute.
 * Processes batches of pending pages from geo_analyses_pages.
 *
 * Flow:
 * 1. Find analyses with status = 'scraping'
 * 2. For each, checkout a batch of pending pages
 * 3. Crawl each page, save results
 * 4. Update analysis progress
 * 5. When all pages done → rebuild crawled_pages snapshot, set status = 'scraping_done'
 */

const BATCH_SIZE = 7;
const CRAWL_DELAY_MS = 300;
const MAX_HEADLESS_PAGES = 2;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    // ── Auth: verify cron secret or service-role key ──────────
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("authorization") || "";
    const incomingSecret = req.headers.get("x-cron-secret") || "";

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    const isCronAuth = cronSecret && incomingSecret === cronSecret;

    // Allow unauthenticated in local dev (no CRON_SECRET configured)
    const isLocal = !cronSecret;

    if (!isServiceRole && !isCronAuth && !isLocal) {
      return withCors(req, unauthorized("Invalid authorization"));
    }

    const db = createAdminClient();

    // ── Find analyses that need page crawling ────────────────
    const { data: activeAnalyses, error: fetchErr } = await db
      .from("geo_analyses")
      .select("id, company_id, status")
      .eq("status", "scraping")
      .limit(3); // Process up to 3 analyses at once

    if (fetchErr) {
      console.error("[crawl-pages] Error fetching active analyses:", fetchErr);
      return withCors(req, serverError(fetchErr.message));
    }

    if (!activeAnalyses || activeAnalyses.length === 0) {
      return withCors(req, ok({ message: "No active analyses", processed: 0 }));
    }

    console.log(`[crawl-pages] Found ${activeAnalyses.length} active analyses`);

    let totalProcessed = 0;

    for (const analysis of activeAnalyses) {
      const analysisId = analysis.id;

      // ── Checkout next batch of pages ─────────────────────────
      const { data: pages, error: checkoutErr } = await db.rpc(
        "checkout_crawl_pages",
        { p_analysis_id: analysisId, p_batch_size: BATCH_SIZE }
      );

      if (checkoutErr) {
        console.error(`[crawl-pages] Checkout error for ${analysisId}:`, checkoutErr);
        continue;
      }

      if (!pages || pages.length === 0) {
        // No pending pages — check if all are done
        const { data: progress } = await db.rpc("get_crawl_progress", { p_analysis_id: analysisId });

        if (progress && progress.length > 0) {
          const p = progress[0];
          if (p.pending === 0) {
            console.log(`[crawl-pages] Analysis ${analysisId}: All ${p.total} pages done (${p.completed} ok, ${p.errors} errors). Finalizing…`);
            await finalizeAnalysis(db, analysisId, p);
          }
        }
        continue;
      }

      console.log(`[crawl-pages] Analysis ${analysisId}: Processing ${pages.length} pages`);

      // ── Crawl each page ────────────────────────────────────
      const crawledPages: { url: string; pageData: any; pageId: string; html: string }[] = [];

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const startTime = Date.now();

        if (i > 0) await sleep(CRAWL_DELAY_MS);

        try {
          const { response: res, redirect_chain } = await fetchWithRedirectChain(page.url, 8000);
          const loadTime = Date.now() - startTime;

          if (!res) {
            console.log(`[crawl-pages] ${page.url} → timeout (${loadTime}ms)`);
            await db.rpc("complete_crawl_page", {
              p_page_id: page.id,
              p_status: "error",
              p_load_time_ms: loadTime,
              p_redirect_chain: JSON.stringify(redirect_chain),
              p_error_message: "Timeout or unreachable",
            });
            continue;
          }

          const statusCode = res.status;
          if (statusCode !== 200) {
            console.log(`[crawl-pages] ${page.url} → HTTP ${statusCode} (${loadTime}ms)`);
            await db.rpc("complete_crawl_page", {
              p_page_id: page.id,
              p_status: statusCode >= 400 ? "error" : "completed",
              p_status_code: statusCode,
              p_load_time_ms: loadTime,
              p_redirect_chain: JSON.stringify(redirect_chain),
              p_error_message: `HTTP ${statusCode}`,
            });
            continue;
          }

          const html = await res.text();
          const extracted = extractFromHtml(html, page.url, res.headers);

          const pageData = {
            ...extracted,
            load_time_ms: loadTime,
            ttfb_ms: loadTime,
            status_code: statusCode,
            redirect_chain,
          };

          await db.rpc("complete_crawl_page", {
            p_page_id: page.id,
            p_status: "completed",
            p_status_code: statusCode,
            p_load_time_ms: loadTime,
            p_redirect_chain: JSON.stringify(redirect_chain),
            p_page_data: pageData,
          });

          crawledPages.push({ url: page.url, pageData, pageId: page.id, html });
          console.log(`[crawl-pages] ${page.url} → ${loadTime}ms, ${extracted.word_count} words`);

        } catch (err) {
          const loadTime = Date.now() - startTime;
          console.warn(`[crawl-pages] ${page.url} → error: ${(err as Error).message}`);
          await db.rpc("complete_crawl_page", {
            p_page_id: page.id,
            p_status: "error",
            p_load_time_ms: loadTime,
            p_redirect_chain: JSON.stringify([page.url]),
            p_error_message: (err as Error).message,
          });
        }
      }

      // ── Discover new links from crawled pages ──────────────
      // Check current total for this analysis
      const { count: currentCount } = await db
        .from("geo_analyses_pages")
        .select("id", { count: "exact", head: true })
        .eq("analysis_id", analysisId);

      let totalNow = currentCount || 0;

      if (totalNow < MAX_PAGES_TO_SCRAPE) {
        // Get all existing URLs to deduplicate
        const { data: existingRows } = await db
          .from("geo_analyses_pages")
          .select("url")
          .eq("analysis_id", analysisId);

        const existingUrls = new Set(
          (existingRows || []).map((r: any) => r.url.replace(/\/$/, ""))
        );

        const newRows: { analysis_id: string; url: string; status: string; page_order: number }[] = [];

        for (const crawled of crawledPages) {
          if (!crawled.html || totalNow + newRows.length >= MAX_PAGES_TO_SCRAPE) break;
          const discovered = extractLinksFromHtml(crawled.html, crawled.url);
          for (const link of discovered) {
            if (totalNow + newRows.length >= MAX_PAGES_TO_SCRAPE) break;
            const clean = link.replace(/\/$/, "");
            if (existingUrls.has(clean)) continue;
            existingUrls.add(clean);
            newRows.push({
              analysis_id: analysisId,
              url: link,
              status: "pending",
              page_order: totalNow + newRows.length,
            });
          }
        }

        if (newRows.length > 0) {
          console.log(`[crawl-pages] Discovered ${newRows.length} new URLs from crawled pages`);
          const batchSize = 50;
          for (let i = 0; i < newRows.length; i += batchSize) {
            const batch = newRows.slice(i, i + batchSize);
            await db.from("geo_analyses_pages").insert(batch);
          }
          // Update total_pages on the analysis
          await db
            .from("geo_analyses")
            .update({ total_pages: totalNow + newRows.length })
            .eq("id", analysisId);
        }
      }

      // ── Headless rendering for successfully crawled pages ──
      const browserlessKey = Deno.env.get("BROWSERLESS_API_KEY");
      if (browserlessKey && crawledPages.length > 0) {
        const headlessUrls = crawledPages
          .filter(p => p.pageData?.headings)
          .slice(0, MAX_HEADLESS_PAGES)
          .map(p => p.url);

        if (headlessUrls.length > 0) {
          try {
            console.log(`[crawl-pages] Headless rendering ${headlessUrls.length} pages…`);
            const headlessResults = await fetchHeadlessBatch(headlessUrls, browserlessKey, 2);

            for (const crawled of crawledPages) {
              const hr = headlessResults.get(crawled.url);
              if (!hr) continue;

              if (hr.desktop_html) {
                const rawHtml = crawled.pageData?.content_text || "";
                const ssrRatio = computeSsrRatio(rawHtml, hr.desktop_html);
                const mobileParity = computeMobileParity(hr.desktop_text_length, hr.mobile_text_length);

                const headlessData = {
                  ssr_ratio: ssrRatio,
                  mobile_parity: mobileParity,
                  rendered_text_length: hr.desktop_text_length,
                  raw_text_length: rawHtml.length,
                  mobile_text_length: hr.mobile_text_length,
                };

                console.log(`[crawl-pages] Headless OK: ${crawled.url} — SSR ${ssrRatio.toFixed(2)}, mobile parity ${mobileParity.toFixed(2)}`);
                await db
                  .from("geo_analyses_pages")
                  .update({ headless_data: headlessData })
                  .eq("id", crawled.pageId);
              } else if (hr.error) {
                console.warn(`[crawl-pages] Headless FAILED: ${crawled.url} — ${hr.error}`);
                await db
                  .from("geo_analyses_pages")
                  .update({ headless_data: { error: hr.error } })
                  .eq("id", crawled.pageId);
              }
            }
          } catch (err) {
            console.warn("[crawl-pages] Headless rendering failed (non-fatal):", (err as Error).message);
          }
        }
      }

      totalProcessed += pages.length;

      // ── Update analysis progress ─────────────────────────
      const { data: progress } = await db.rpc("get_crawl_progress", { p_analysis_id: analysisId });

      if (progress && progress.length > 0) {
        const p = progress[0];
        const pct = p.total > 0
          ? 15 + Math.round(((p.completed + p.errors) / p.total) * 33)
          : 15;

        const shortUrl = pages[pages.length - 1]?.url?.replace(/https?:\/\/[^/]+/, '') || '';

        await db
          .from("geo_analyses")
          .update({
            progress: pct,
            pages_crawled: p.completed + p.errors,
            status_message: p.pending > 0
              ? `Crawling page ${p.completed + p.errors} of ${p.total} — ${shortUrl}`
              : `All ${p.total} pages crawled. Preparing for AI analysis…`,
          })
          .eq("id", analysisId);

        // Check if all pages are done
        if (p.pending === 0) {
          console.log(`[crawl-pages] Analysis ${analysisId}: All done! Finalizing…`);
          await finalizeAnalysis(db, analysisId, p);
        }
      }
    }

    return withCors(req, ok({
      message: `Processed ${totalProcessed} pages across ${activeAnalyses.length} analyses`,
      processed: totalProcessed,
    }));

  } catch (err: unknown) {
    console.error("[crawl-pages] Fatal error:", err);
    const e = err as { message?: string };
    return withCors(req, serverError(e.message || "Internal server error"));
  }
});


/**
 * Finalize an analysis after all pages are crawled:
 * 1. Rebuild crawled_pages JSONB snapshot from individual page rows
 * 2. Set status = 'scraping_done'
 */
async function finalizeAnalysis(
  db: any,
  analysisId: string,
  progress: { total: number; completed: number; errors: number },
) {
  // Fetch all page data to rebuild crawled_pages snapshot
  const { data: allPages, error: fetchErr } = await db
    .from("geo_analyses_pages")
    .select("url, status, status_code, load_time_ms, redirect_chain, page_data, headless_data, error_message")
    .eq("analysis_id", analysisId)
    .order("page_order", { ascending: true });

  if (fetchErr) {
    console.error(`[crawl-pages] Failed to fetch pages for snapshot:`, fetchErr);
    return;
  }

  // Build the crawled_pages array (same format as before for compatibility)
  const crawledPages = (allPages || []).map((p: any) => {
    if (p.page_data) {
      const merged = {
        ...p.page_data,
        url: p.url,
        status_code: p.status_code,
        load_time_ms: p.load_time_ms,
        redirect_chain: p.redirect_chain,
      };
      if (p.headless_data) {
        merged.headless = p.headless_data;
      }
      return merged;
    }
    return {
      url: p.url,
      status_code: p.status_code || 0,
      load_time_ms: p.load_time_ms || 0,
      redirect_chain: p.redirect_chain || [p.url],
      error: p.error_message || "Unknown error",
    };
  });

  await db
    .from("geo_analyses")
    .update({
      crawled_pages: crawledPages,
      pages_crawled: progress.completed + progress.errors,
      status: "scraping_done",
      progress: 48,
      status_message: `Scraping complete — ${progress.completed} pages crawled successfully. Starting AI analysis…`,
    })
    .eq("id", analysisId);

  console.log(`[crawl-pages] Analysis ${analysisId}: Finalized with ${crawledPages.length} pages in snapshot`);
}


function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
