import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, created, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * Admin Meta Ads Edge Function
 *
 * Manages Meta (Facebook/Instagram) Ads API integration for
 * tracking paid media costs and calculating ROI metrics.
 *
 * GET  ?view=overview   → Aggregated KPIs (spend, CPC, CPM, CTR, conversions)
 * GET  ?view=daily      → Daily spend breakdown for charting
 * GET  ?view=campaigns  → Campaign-level performance breakdown
 * GET  ?view=roi        → ROI/CAC/ROAS cross-referenced with subscription data
 * GET  ?view=config     → Current Meta Ads configuration
 * POST ?action=save_config → Save/update Meta API credentials
 * POST ?action=sync     → Trigger manual sync from Meta API
 * POST ?action=test     → Test Meta API connection
 */

const META_API_BASE = "https://graph.facebook.com";

// ─── Meta API Helpers ────────────────────────────────────────

interface MetaInsightRow {
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  clicks: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  account_currency?: string;
}

async function fetchMetaInsights(
  adAccountId: string,
  accessToken: string,
  apiVersion: string,
  opts: {
    level?: string;
    fields?: string;
    timeRange?: { since: string; until: string };
    datePreset?: string;
    limit?: number;
  },
): Promise<MetaInsightRow[]> {
  const params = new URLSearchParams();
  params.set("access_token", accessToken);
  params.set(
    "fields",
    opts.fields ||
      "spend,impressions,clicks,cpc,cpm,ctr,actions,account_currency",
  );
  if (opts.level) params.set("level", opts.level);
  if (opts.timeRange) {
    params.set(
      "time_range",
      JSON.stringify(opts.timeRange),
    );
  }
  if (opts.datePreset) params.set("date_preset", opts.datePreset);
  if (opts.limit) params.set("limit", String(opts.limit));
  // Always break by day for granular snapshots
  params.set("time_increment", "1");

  const url = `${META_API_BASE}/${apiVersion}/act_${adAccountId}/insights?${params.toString()}`;
  const allData: MetaInsightRow[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const resp = await fetch(nextUrl);
    if (!resp.ok) {
      const error = await resp.json();
      throw new Error(
        `Meta API error: ${error?.error?.message || resp.statusText}`,
      );
    }
    const json = await resp.json();
    if (json.data) allData.push(...json.data);
    nextUrl = json.paging?.next || null;
    // Safety: cap at 500 rows to avoid runaway pagination
    if (allData.length > 500) break;
  }

  return allData;
}

async function testMetaConnection(
  adAccountId: string,
  accessToken: string,
  apiVersion: string,
): Promise<{ success: boolean; accountName?: string; error?: string }> {
  try {
    const url = `${META_API_BASE}/${apiVersion}/act_${adAccountId}?fields=name,account_status,currency&access_token=${accessToken}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const error = await resp.json();
      return {
        success: false,
        error: error?.error?.message || resp.statusText,
      };
    }
    const data = await resp.json();
    return { success: true, accountName: data.name };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Main Handler ────────────────────────────────────────────

serve(async (req: Request) => {
  const logger = createRequestLogger("admin-meta-ads", req);
  if (req.method === "OPTIONS") return handleCors(req);

  // deno-lint-ignore no-explicit-any
  let authCtx: any = {};

  try {
    const { user } = await verifySuperAdmin(req);
    authCtx = { user_id: user.id };

    const url = new URL(req.url);
    const db = createAdminClient();

    // ═══════════════════════════════════════════════════════════
    // GET routes
    // ═══════════════════════════════════════════════════════════
    if (req.method === "GET") {
      const view = url.searchParams.get("view") || "overview";
      const months = parseInt(url.searchParams.get("months") || "1", 10);

      // Date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      // ─── CONFIG ───────────────────────────────────────────
      if (view === "config") {
        const { data, error } = await db
          .from("meta_ads_config")
          .select(
            "id, ad_account_id, token_expires_at, api_version, is_active, last_sync_at, last_sync_status, last_sync_error, created_at, updated_at",
          )
          .eq("is_active", true)
          .maybeSingle();

        if (error) throw error;

        // Never return the access_token itself, only masked version
        const result = data
          ? {
              ...data,
              has_token: true,
              token_preview: "••••••••",
            }
          : null;

        return logger.done(withCors(req, ok(result)), authCtx);
      }

      // ─── OVERVIEW ─────────────────────────────────────────
      if (view === "overview") {
        const { data, error } = await db.rpc("get_meta_ads_overview", {
          p_start_date: startDateStr,
          p_end_date: endDateStr,
        });

        if (error) throw error;
        return logger.done(withCors(req, ok(data)), authCtx);
      }

      // ─── DAILY ────────────────────────────────────────────
      if (view === "daily") {
        const { data, error } = await db.rpc("get_meta_ads_daily", {
          p_start_date: startDateStr,
          p_end_date: endDateStr,
        });

        if (error) throw error;
        return logger.done(withCors(req, ok(data || [])), authCtx);
      }

      // ─── CAMPAIGNS ────────────────────────────────────────
      if (view === "campaigns") {
        const { data, error } = await db.rpc("get_meta_ads_campaigns", {
          p_start_date: startDateStr,
          p_end_date: endDateStr,
        });

        if (error) throw error;
        return logger.done(withCors(req, ok(data || [])), authCtx);
      }

      // ─── ROI ──────────────────────────────────────────────
      if (view === "roi") {
        const { data, error } = await db.rpc("get_meta_ads_roi", {
          p_start_date: startDateStr,
          p_end_date: endDateStr,
        });

        if (error) throw error;
        return logger.done(withCors(req, ok(data)), authCtx);
      }

      return logger.done(
        withCors(req, badRequest(`Unknown view: ${view}`)),
        authCtx,
      );
    }

    // ═══════════════════════════════════════════════════════════
    // POST routes
    // ═══════════════════════════════════════════════════════════
    if (req.method === "POST") {
      const action = url.searchParams.get("action");

      // ─── SAVE CONFIG ──────────────────────────────────────
      if (action === "save_config") {
        const body = await req.json();
        const { ad_account_id, access_token, api_version, token_expires_at } =
          body;

        if (!ad_account_id || !access_token) {
          return logger.done(
            withCors(
              req,
              badRequest("ad_account_id and access_token are required"),
            ),
            authCtx,
          );
        }

        // Deactivate all existing configs
        await db
          .from("meta_ads_config")
          .update({ is_active: false })
          .eq("is_active", true);

        // Insert new config
        const { data, error } = await db
          .from("meta_ads_config")
          .insert({
            ad_account_id: ad_account_id.replace(/^act_/, ""),
            access_token,
            api_version: api_version || "v21.0",
            token_expires_at: token_expires_at || null,
            is_active: true,
          })
          .select(
            "id, ad_account_id, api_version, is_active, created_at",
          )
          .single();

        if (error) throw error;
        return logger.done(withCors(req, created(data)), authCtx);
      }

      // ─── TEST CONNECTION ──────────────────────────────────
      if (action === "test") {
        // Can test with either body values or existing config
        let adAccountId: string;
        let accessToken: string;
        let apiVersion: string;

        const contentType = req.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const body = await req.json();
          adAccountId = body.ad_account_id?.replace(/^act_/, "");
          accessToken = body.access_token;
          apiVersion = body.api_version || "v21.0";
        } else {
          // Use existing config
          const { data: config } = await db
            .from("meta_ads_config")
            .select("ad_account_id, access_token, api_version")
            .eq("is_active", true)
            .maybeSingle();

          if (!config) {
            return logger.done(
              withCors(
                req,
                badRequest(
                  "No Meta Ads configuration found. Please configure first.",
                ),
              ),
              authCtx,
            );
          }
          adAccountId = config.ad_account_id;
          accessToken = config.access_token;
          apiVersion = config.api_version;
        }

        if (!adAccountId || !accessToken) {
          return logger.done(
            withCors(
              req,
              badRequest("ad_account_id and access_token are required"),
            ),
            authCtx,
          );
        }

        const result = await testMetaConnection(
          adAccountId,
          accessToken,
          apiVersion,
        );
        return logger.done(withCors(req, ok(result)), authCtx);
      }

      // ─── SYNC ─────────────────────────────────────────────
      if (action === "sync") {
        // Get active config
        const { data: config, error: configError } = await db
          .from("meta_ads_config")
          .select("*")
          .eq("is_active", true)
          .maybeSingle();

        if (configError) throw configError;
        if (!config) {
          return logger.done(
            withCors(
              req,
              badRequest(
                "No Meta Ads configuration found. Please configure first.",
              ),
            ),
            authCtx,
          );
        }

        // Update sync status to pending
        await db
          .from("meta_ads_config")
          .update({
            last_sync_status: "pending",
            last_sync_error: null,
          })
          .eq("id", config.id);

        try {
          // Parse body for optional date range
          let syncDays = 30;
          const contentType = req.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const body = await req.json();
            if (body.days) syncDays = Math.min(body.days, 90);
          }

          const syncEnd = new Date();
          const syncStart = new Date();
          syncStart.setDate(syncStart.getDate() - syncDays);
          const timeRange = {
            since: syncStart.toISOString().split("T")[0],
            until: syncEnd.toISOString().split("T")[0],
          };

          // 1. Fetch account-level daily insights
          const accountInsights = await fetchMetaInsights(
            config.ad_account_id,
            config.access_token,
            config.api_version,
            {
              level: "account",
              timeRange,
              fields:
                "spend,impressions,clicks,cpc,cpm,ctr,actions,account_currency",
            },
          );

          // 2. Fetch campaign-level daily insights
          const campaignInsights = await fetchMetaInsights(
            config.ad_account_id,
            config.access_token,
            config.api_version,
            {
              level: "campaign",
              timeRange,
              fields:
                "campaign_id,campaign_name,spend,impressions,clicks,cpc,cpm,ctr,actions,account_currency",
            },
          );

          // 3. Store snapshots (upsert)
          let insertedCount = 0;

          // Account-level snapshots
          for (const row of accountInsights) {
            const conversions = countConversions(row.actions);
            const spend = parseFloat(row.spend || "0");

            const { error: upsertError } = await db
              .from("meta_ads_snapshots")
              .upsert(
                {
                  ad_account_id: config.ad_account_id,
                  date: row.date_start,
                  level: "account",
                  campaign_id: null,
                  campaign_name: null,
                  adset_id: null,
                  adset_name: null,
                  spend,
                  impressions: parseInt(row.impressions || "0"),
                  clicks: parseInt(row.clicks || "0"),
                  cpc: parseFloat(row.cpc || "0"),
                  cpm: parseFloat(row.cpm || "0"),
                  ctr: parseFloat(row.ctr || "0"),
                  conversions,
                  cost_per_conversion:
                    conversions > 0 ? spend / conversions : 0,
                  actions_json: row.actions || [],
                  currency: row.account_currency || "USD",
                },
                {
                  onConflict:
                    "ad_account_id,date,level,COALESCE(campaign_id,''),COALESCE(adset_id,'')",
                },
              );

            if (upsertError) {
              console.error("[admin-meta-ads] upsert error:", upsertError);
              // Try inserting — if conflict, delete first then insert
              await db
                .from("meta_ads_snapshots")
                .delete()
                .eq("ad_account_id", config.ad_account_id)
                .eq("date", row.date_start)
                .eq("level", "account")
                .is("campaign_id", null);

              await db.from("meta_ads_snapshots").insert({
                ad_account_id: config.ad_account_id,
                date: row.date_start,
                level: "account",
                spend,
                impressions: parseInt(row.impressions || "0"),
                clicks: parseInt(row.clicks || "0"),
                cpc: parseFloat(row.cpc || "0"),
                cpm: parseFloat(row.cpm || "0"),
                ctr: parseFloat(row.ctr || "0"),
                conversions,
                cost_per_conversion:
                  conversions > 0 ? spend / conversions : 0,
                actions_json: row.actions || [],
                currency: row.account_currency || "USD",
              });
            }
            insertedCount++;
          }

          // Campaign-level snapshots
          for (const row of campaignInsights) {
            const conversions = countConversions(row.actions);
            const spend = parseFloat(row.spend || "0");

            await db
              .from("meta_ads_snapshots")
              .delete()
              .eq("ad_account_id", config.ad_account_id)
              .eq("date", row.date_start)
              .eq("level", "campaign")
              .eq("campaign_id", row.campaign_id || "");

            await db.from("meta_ads_snapshots").insert({
              ad_account_id: config.ad_account_id,
              date: row.date_start,
              level: "campaign",
              campaign_id: row.campaign_id,
              campaign_name: row.campaign_name,
              spend,
              impressions: parseInt(row.impressions || "0"),
              clicks: parseInt(row.clicks || "0"),
              cpc: parseFloat(row.cpc || "0"),
              cpm: parseFloat(row.cpm || "0"),
              ctr: parseFloat(row.ctr || "0"),
              conversions,
              cost_per_conversion:
                conversions > 0 ? spend / conversions : 0,
              actions_json: row.actions || [],
              currency: row.account_currency || "USD",
            });
            insertedCount++;
          }

          // Update config sync status
          await db
            .from("meta_ads_config")
            .update({
              last_sync_at: new Date().toISOString(),
              last_sync_status: "success",
              last_sync_error: null,
            })
            .eq("id", config.id);

          return logger.done(
            withCors(
              req,
              ok({
                synced: true,
                account_snapshots: accountInsights.length,
                campaign_snapshots: campaignInsights.length,
                total_inserted: insertedCount,
              }),
            ),
            authCtx,
          );
        } catch (syncErr) {
          const errorMsg =
            syncErr instanceof Error ? syncErr.message : "Sync failed";

          // Update config with error
          await db
            .from("meta_ads_config")
            .update({
              last_sync_at: new Date().toISOString(),
              last_sync_status: "error",
              last_sync_error: errorMsg,
            })
            .eq("id", config.id);

          return logger.done(
            withCors(req, serverError(errorMsg)),
            authCtx,
          );
        }
      }

      return logger.done(
        withCors(req, badRequest(`Unknown action: ${action}`)),
        authCtx,
      );
    }

    return logger.done(
      withCors(req, badRequest(`Method ${req.method} not allowed`)),
      authCtx,
    );
    // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[admin-meta-ads]", err);
    if (err.status) {
      return logger.done(
        withCors(
          req,
          new Response(
            JSON.stringify({
              success: false,
              error: {
                message: err.message,
                code:
                  err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
              },
            }),
            {
              status: err.status,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
      );
    }
    return logger.done(
      withCors(req, serverError(err.message || "Internal server error")),
    );
  }
});

// ─── Helpers ─────────────────────────────────────────────────

function countConversions(
  actions?: Array<{ action_type: string; value: string }>,
): number {
  if (!actions) return 0;
  const conversionTypes = [
    "purchase",
    "complete_registration",
    "lead",
    "subscribe",
    "start_trial",
    "add_to_cart",
    "initiate_checkout",
  ];
  return actions
    .filter((a) => conversionTypes.includes(a.action_type))
    .reduce((sum, a) => sum + parseInt(a.value || "0"), 0);
}
