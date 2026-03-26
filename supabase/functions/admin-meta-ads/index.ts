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

interface MetaCampaignRow {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

async function fetchMetaCampaigns(
  adAccountId: string,
  accessToken: string,
  apiVersion: string,
): Promise<MetaCampaignRow[]> {
  const params = new URLSearchParams();
  params.set("access_token", accessToken);
  params.set(
    "fields",
    "id,name,objective,status,effective_status,daily_budget,lifetime_budget",
  );
  // Get all campaigns to ensure we have metadata for anything that had spend
  const url = `${META_API_BASE}/${apiVersion}/act_${adAccountId}/campaigns?${params.toString()}&limit=500`;
  
  const resp = await fetch(url);
  if (!resp.ok) {
    const error = await resp.json();
    throw new Error(`Meta API error (campaigns): ${error?.error?.message || resp.statusText}`);
  }
  const json = await resp.json();
  return json.data || [];
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
        const { data: snaps, error } = await db
          .from("meta_ads_snapshots")
          .select("spend, impressions, clicks, conversions, currency, date")
          .eq("level", "account")
          .gte("date", startDateStr)
          .lte("date", endDateStr);

        if (error) throw error;

        let total_spend = 0, total_impressions = 0, total_clicks = 0, total_conversions = 0;
        const days = new Set<string>();
        let currency = 'USD';

        for (const row of snaps || []) {
          total_spend += Number(row.spend || 0);
          total_impressions += Number(row.impressions || 0);
          total_clicks += Number(row.clicks || 0);
          total_conversions += Number(row.conversions || 0);
          days.add(row.date);
          if (row.currency) currency = row.currency;
        }

        const result = {
          total_spend,
          total_impressions,
          total_clicks,
          avg_cpc: total_clicks > 0 ? Number((total_spend / total_clicks).toFixed(4)) : 0,
          avg_cpm: total_impressions > 0 ? Number((total_spend / total_impressions * 1000).toFixed(4)) : 0,
          avg_ctr: total_impressions > 0 ? Number((total_clicks / total_impressions * 100).toFixed(4)) : 0,
          total_conversions,
          avg_cost_per_conversion: total_conversions > 0 ? Number((total_spend / total_conversions).toFixed(2)) : 0,
          currency,
          days_count: days.size
        };

        return logger.done(withCors(req, ok(result)), authCtx);
      }

      // ─── DAILY ────────────────────────────────────────────
      if (view === "daily") {
        const { data: snaps, error } = await db
          .from("meta_ads_snapshots")
          .select("date, spend, impressions, clicks, conversions")
          .eq("level", "account")
          .gte("date", startDateStr)
          .lte("date", endDateStr)
          .order("date", { ascending: true });

        if (error) throw error;

        // deno-lint-ignore no-explicit-any
        const dailyMap = new Map<string, any>();
        for (const row of snaps || []) {
          if (!dailyMap.has(row.date)) {
            dailyMap.set(row.date, { day: row.date, spend: 0, impressions: 0, clicks: 0, conversions: 0 });
          }
          const d = dailyMap.get(row.date);
          d.spend += Number(row.spend || 0);
          d.impressions += Number(row.impressions || 0);
          d.clicks += Number(row.clicks || 0);
          d.conversions += Number(row.conversions || 0);
        }

        return logger.done(withCors(req, ok(Array.from(dailyMap.values()))), authCtx);
      }

      // ─── CAMPAIGNS ────────────────────────────────────────
      if (view === "campaigns") {
        const { data: snaps, error } = await db
          .from("meta_ads_snapshots")
          .select("campaign_id, campaign_name, spend, impressions, clicks, conversions, campaign_objective, campaign_status, campaign_daily_budget, campaign_lifetime_budget")
          .eq("level", "campaign")
          .gte("date", startDateStr)
          .lte("date", endDateStr);

        if (error) throw error;

        // deno-lint-ignore no-explicit-any
        const campMap = new Map<string, any>();
        for (const row of snaps || []) {
          const key = row.campaign_id || "unknown";
          if (!campMap.has(key)) {
            campMap.set(key, {
              campaign_id: key,
              campaign_name: row.campaign_name || '',
              total_spend: 0,
              total_impressions: 0,
              total_clicks: 0,
              total_conversions: 0,
              objective: row.campaign_objective,
              status: row.campaign_status,
              daily_budget: row.campaign_daily_budget,
              lifetime_budget: row.campaign_lifetime_budget
            });
          }
          const c = campMap.get(key);
          c.total_spend += Number(row.spend || 0);
          c.total_impressions += Number(row.impressions || 0);
          c.total_clicks += Number(row.clicks || 0);
          c.total_conversions += Number(row.conversions || 0);
          if (row.campaign_objective) c.objective = row.campaign_objective;
          if (row.campaign_status) c.status = row.campaign_status;
        }

        const result = Array.from(campMap.values()).map(c => ({
          ...c,
          avg_cpc: c.total_clicks > 0 ? Number((c.total_spend / c.total_clicks).toFixed(4)) : 0,
          avg_ctr: c.total_impressions > 0 ? Number((c.total_clicks / c.total_impressions * 100).toFixed(4)) : 0,
          cost_per_conversion: c.total_conversions > 0 ? Number((c.total_spend / c.total_conversions).toFixed(2)) : 0
        })).sort((a, b) => b.total_spend - a.total_spend);

        return logger.done(withCors(req, ok(result)), authCtx);
      }

      // ─── ATTRIBUTION ──────────────────────────────────────
      if (view === "attribution") {
        const { data: snaps, error: snapErr } = await db
          .from("meta_ads_snapshots")
          .select("campaign_name, spend, conversions, currency, campaign_objective, campaign_status")
          .eq("level", "campaign")
          .gte("date", startDateStr)
          .lte("date", endDateStr);
        if (snapErr) throw snapErr;

        // deno-lint-ignore no-explicit-any
        const spendMap = new Map<string, any>();
        for (const row of snaps || []) {
          const key = (row.campaign_name || "unknown").toLowerCase();
          if (!spendMap.has(key)) {
            spendMap.set(key, {
              campaign_name: row.campaign_name,
              total_spend: 0,
              meta_conversions: 0,
              currency: row.currency || "USD",
              objective: row.campaign_objective,
              status: row.campaign_status
            });
          }
          const c = spendMap.get(key);
          c.total_spend += Number(row.spend || 0);
          c.meta_conversions += Number(row.conversions || 0);
          if (row.campaign_objective) c.objective = row.campaign_objective;
          if (row.campaign_status) c.status = row.campaign_status;
        }

        const endDateObj = new Date(endDateStr);
        endDateObj.setDate(endDateObj.getDate() + 1);
        const endISO = endDateObj.toISOString();

        const { data: leadsData, error: leadsErr } = await db
          .from("lead_attribution")
          .select("created_at, utm_source, utm_medium, utm_campaign, tenant_id, tenants(name)")
          .not("utm_campaign", "is", null)
          .gte("created_at", new Date(startDateStr).toISOString())
          .lt("created_at", endISO);
        if (leadsErr) throw leadsErr;

        // deno-lint-ignore no-explicit-any
        const leadsMap = new Map<string, any[]>();
        for (const row of leadsData || []) {
          const key = (row.utm_campaign || "").toLowerCase();
          if (!leadsMap.has(key)) leadsMap.set(key, []);
          // deno-lint-ignore no-explicit-any
          const tenantName = Array.isArray(row.tenants) ? row.tenants[0]?.name : (row.tenants as any)?.name;
          leadsMap.get(key)?.push({
            tenant_id: row.tenant_id,
            tenant_name: tenantName,
            created_at: row.created_at,
            utm_source: row.utm_source,
            utm_medium: row.utm_medium
          });
        }

        // deno-lint-ignore no-explicit-any
        const merged = new Map<string, any>();
        for (const [key, sv] of spendMap.entries()) {
          const leads = leadsMap.get(key) || [];
          merged.set(key, {
            ...sv,
            platform_leads: new Set(leads.map(l => l.tenant_id)).size,
            leads_list: leads
          });
        }
        for (const [key, leads] of leadsMap.entries()) {
          if (!spendMap.has(key)) {
            merged.set(key, {
              campaign_name: leads[0].utm_campaign,
              objective: null,
              status: null,
              total_spend: 0,
              meta_conversions: 0,
              currency: "USD",
              platform_leads: new Set(leads.map(l => l.tenant_id)).size,
              leads_list: leads
            });
          }
        }

        const result = Array.from(merged.values()).sort((a, b) => b.total_spend - a.total_spend);
        return logger.done(withCors(req, ok(result)), authCtx);
      }

      // ─── ROI ──────────────────────────────────────────────
      if (view === "roi") {
        const { data: snaps, error: snapErr } = await db
          .from("meta_ads_snapshots")
          .select("spend")
          .eq("level", "account")
          .gte("date", startDateStr)
          .lte("date", endDateStr);
        if (snapErr) throw snapErr;
        // deno-lint-ignore no-explicit-any
        const total_ad_spend = snaps?.reduce((acc: number, r: any) => acc + Number(r.spend || 0), 0) || 0;

        const endDateObj = new Date(endDateStr);
        endDateObj.setDate(endDateObj.getDate() + 1);
        const endISO = endDateObj.toISOString();

        // ★ Fetch ALL subscriptions (active + trialing) with plan info
        const { data: subsData, error: subsErr } = await db
          .from("subscriptions")
          .select("created_at, status, billing_interval, paid_amount, plans!inner(price)")
          .in("status", ["active", "trialing"]);
        if (subsErr) throw subsErr;

        let new_paid_subscriptions = 0;
        let new_mrr = 0;
        let total_active_mrr = 0;
        let paid_sub_count = 0;
        let trial_sub_count = 0;

        for (const sub of subsData || []) {
          // deno-lint-ignore no-explicit-any
          const planPrice = Number((sub.plans as any)?.price || 0);
          const mrr = sub.billing_interval === 'monthly' ? Number(sub.paid_amount || 0) : (sub.billing_interval === 'yearly' ? Number(sub.paid_amount || 0) / 12 : 0);

          // ★ Only count PAID ACTIVE subscriptions (not trialing, not $0 plans)
          if (sub.status === 'active' && planPrice > 0) {
            paid_sub_count++;
            total_active_mrr += mrr;

            if (sub.created_at >= new Date(startDateStr).toISOString() && sub.created_at < endISO) {
              new_paid_subscriptions++;
              new_mrr += mrr;
            }
          } else if (sub.status === 'trialing') {
            trial_sub_count++;
          }
        }

        const result = {
          total_ad_spend,
          new_paid_subscriptions,
          new_mrr,
          cac: new_paid_subscriptions > 0 ? Number((total_ad_spend / new_paid_subscriptions).toFixed(2)) : 0,
          roas: total_ad_spend > 0 ? Number((new_mrr / total_ad_spend).toFixed(4)) : 0,
          roi_pct: total_ad_spend > 0 ? Number(((new_mrr - total_ad_spend) / total_ad_spend * 100).toFixed(2)) : 0,
          total_active_mrr,
          // ★ Split counts
          paid_sub_count,
          trial_sub_count,
          total_sub_count: paid_sub_count + trial_sub_count,
          avg_revenue_per_sub: paid_sub_count > 0 ? Number((total_active_mrr / paid_sub_count).toFixed(2)) : 0,
          ltv_estimate: paid_sub_count > 0 ? Number((total_active_mrr / paid_sub_count * 12).toFixed(2)) : 0,
          ltv_cac_ratio: new_paid_subscriptions > 0 && total_ad_spend > 0 && paid_sub_count > 0 ?
            Number(((total_active_mrr / paid_sub_count * 12) / (total_ad_spend / new_paid_subscriptions)).toFixed(2)) : 0,
          payback_months: new_paid_subscriptions > 0 && new_mrr > 0 ?
            Number(((total_ad_spend / new_paid_subscriptions) / (new_mrr / new_paid_subscriptions)).toFixed(1)) : 0,
          // ★ New: trial conversion rate
          trial_to_paid_rate: (paid_sub_count + trial_sub_count) > 0
            ? Number((paid_sub_count / (paid_sub_count + trial_sub_count) * 100).toFixed(2)) : 0,
        };

        return logger.done(withCors(req, ok(result)), authCtx);
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

        // Store token securely in Supabase Vault
        const { error: vaultError } = await db.rpc("store_meta_ads_token", {
          p_token: access_token,
        });
        if (vaultError) {
          console.error("[admin-meta-ads] vault store error:", vaultError);
          throw vaultError;
        }

        // Insert config (without token — it's in Vault)
        const { data, error } = await db
          .from("meta_ads_config")
          .insert({
            ad_account_id: ad_account_id.replace(/^act_/, ""),
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
          // Use existing config + token from Vault
          const { data: config } = await db
            .from("meta_ads_config")
            .select("ad_account_id, api_version")
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

          // Retrieve token from Vault
          const { data: vaultToken } = await db.rpc("get_meta_ads_token");

          adAccountId = config.ad_account_id;
          accessToken = vaultToken;
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
          .select("id, ad_account_id, api_version, is_active")
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

        // Retrieve token from Vault
        const { data: vaultToken, error: vaultErr } = await db.rpc("get_meta_ads_token");
        if (vaultErr || !vaultToken) {
          return logger.done(
            withCors(req, badRequest("Access token not found in Vault. Please re-save your configuration.")),
            authCtx,
          );
        }
        const accessToken = vaultToken;

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
            accessToken,
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
            accessToken,
            config.api_version,
            {
              level: "campaign",
              timeRange,
              fields:
                "campaign_id,campaign_name,spend,impressions,clicks,cpc,cpm,ctr,actions,account_currency",
            },
          );

          // 2.5 Fetch campaign metadata (objective, status, budgets)
          const campaignsMetadata = await fetchMetaCampaigns(
            config.ad_account_id,
            accessToken,
            config.api_version,
          );
          const campaignMap = new Map<string, MetaCampaignRow>();
          for (const c of campaignsMetadata) {
            campaignMap.set(c.id, c);
          }

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

            const m = campaignMap.get(row.campaign_id || "");

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
              // New metadata fields
              campaign_objective: m?.objective || null,
              campaign_status: m?.effective_status || m?.status || null,
              campaign_daily_budget: m?.daily_budget ? parseFloat(m.daily_budget) / 100 : null,
              campaign_lifetime_budget: m?.lifetime_budget ? parseFloat(m.lifetime_budget) / 100 : null,
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
