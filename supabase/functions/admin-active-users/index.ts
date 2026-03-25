import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const logger = createRequestLogger("admin-active-users", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { user_id?: string } = {};

  try {
    const { user } = await verifySuperAdmin(req);
    authCtx = { user_id: user.id };

    if (req.method !== "GET") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
    }

    const db = createAdminClient();

    // Parallel queries — flat, no FK joins
    const [
      profilesRes,
      tenantUsersRes,
      tenantsRes,
      companiesRes,
      geoAnalysesRes,
      promptsRes,
      promptAnswersRes,
      subscriptionsRes,
      plansRes,
    ] = await Promise.all([
      db.from("profiles").select("user_id, full_name, email, avatar_url, created_at"),
      db.from("tenant_users").select("user_id, tenant_id, role").eq("is_active", true),
      db.from("tenants").select("id, name, slug"),
      db.from("companies").select("id, tenant_id, company_name, domain, industry, country"),
      db.from("geo_analyses").select("company_id, status, geo_score, created_at, completed_at").order("created_at", { ascending: false }),
      db.from("prompts").select("id, tenant_id, text, is_active"),
      db.from("prompt_answers").select("prompt_id, created_at").order("created_at", { ascending: false }),
      db.from("subscriptions").select("tenant_id, status, plan_id"),
      db.from("plans").select("id, name"),
    ]);

    // Error check
    for (const r of [profilesRes, tenantUsersRes, tenantsRes, companiesRes, geoAnalysesRes, promptsRes, promptAnswersRes, subscriptionsRes, plansRes]) {
      // deno-lint-ignore no-explicit-any
      if ((r as any).error) throw (r as any).error;
    }

    const profiles = profilesRes.data || [];
    const tenantUsers = tenantUsersRes.data || [];
    const tenants = tenantsRes.data || [];
    const companies = companiesRes.data || [];
    const geoAnalyses = geoAnalysesRes.data || [];
    const prompts = promptsRes.data || [];
    const promptAnswers = promptAnswersRes.data || [];
    const subscriptions = subscriptionsRes.data || [];
    const plans = plansRes.data || [];

    // Build lookup maps
    // deno-lint-ignore no-explicit-any
    const tenantMap = new Map(tenants.map((t: any) => [t.id, t]));
    // deno-lint-ignore no-explicit-any
    const planMap = new Map(plans.map((p: any) => [p.id, p]));
    // deno-lint-ignore no-explicit-any
    const tuByUser = new Map<string, any>();
    // deno-lint-ignore no-explicit-any
    tenantUsers.forEach((tu: any) => { if (!tuByUser.has(tu.user_id)) tuByUser.set(tu.user_id, tu); });

    // Companies by tenant
    // deno-lint-ignore no-explicit-any
    const companiesByTenant = new Map<string, any[]>();
    // deno-lint-ignore no-explicit-any
    companies.forEach((c: any) => {
      if (!companiesByTenant.has(c.tenant_id)) companiesByTenant.set(c.tenant_id, []);
      companiesByTenant.get(c.tenant_id)!.push(c);
    });

    // Company IDs by tenant (for geo_analyses lookup)
    const companyIdsByTenant = new Map<string, Set<string>>();
    // deno-lint-ignore no-explicit-any
    companies.forEach((c: any) => {
      if (!companyIdsByTenant.has(c.tenant_id)) companyIdsByTenant.set(c.tenant_id, new Set());
      companyIdsByTenant.get(c.tenant_id)!.add(c.id);
    });

    // Geo analyses by company_id
    // deno-lint-ignore no-explicit-any
    const geoByCompany = new Map<string, any[]>();
    // deno-lint-ignore no-explicit-any
    geoAnalyses.forEach((g: any) => {
      if (!geoByCompany.has(g.company_id)) geoByCompany.set(g.company_id, []);
      geoByCompany.get(g.company_id)!.push(g);
    });

    // Prompts by tenant
    // deno-lint-ignore no-explicit-any
    const promptsByTenant = new Map<string, any[]>();
    // deno-lint-ignore no-explicit-any
    prompts.forEach((p: any) => {
      if (!promptsByTenant.has(p.tenant_id)) promptsByTenant.set(p.tenant_id, []);
      promptsByTenant.get(p.tenant_id)!.push(p);
    });

    // Prompt IDs set for quick lookup
    // deno-lint-ignore no-explicit-any
    const promptIdToTenant = new Map<string, string>();
    // deno-lint-ignore no-explicit-any
    prompts.forEach((p: any) => promptIdToTenant.set(p.id, p.tenant_id));

    // Answers count by tenant
    const answersByTenant = new Map<string, number>();
    // deno-lint-ignore no-explicit-any
    promptAnswers.forEach((a: any) => {
      const tid = promptIdToTenant.get(a.prompt_id);
      if (tid) answersByTenant.set(tid, (answersByTenant.get(tid) || 0) + 1);
    });

    // Subscription by tenant
    // deno-lint-ignore no-explicit-any
    const subByTenant = new Map<string, any>();
    // deno-lint-ignore no-explicit-any
    subscriptions.forEach((s: any) => { if (!subByTenant.has(s.tenant_id)) subByTenant.set(s.tenant_id, s); });

    // Build active users list (only users with a tenant and active subscription)
    // deno-lint-ignore no-explicit-any
    const activeUsers = profiles.map((profile: any) => {
      const tu = tuByUser.get(profile.user_id);
      if (!tu) return null;
      const tenantId = tu.tenant_id;
      const tenant = tenantMap.get(tenantId);
      const sub = subByTenant.get(tenantId);

      // Only include users with an active/trialing subscription
      if (!sub || !['active', 'trialing'].includes(sub.status)) return null;

      const plan = sub.plan_id ? planMap.get(sub.plan_id) : null;
      const tenantCompanies = companiesByTenant.get(tenantId) || [];
      const companyIds = companyIdsByTenant.get(tenantId) || new Set<string>();

      // Aggregate deep analyses across all companies of this tenant
      let totalAnalyses = 0;
      let completedAnalyses = 0;
      let bestGeoScore: number | null = null;
      // deno-lint-ignore no-explicit-any
      let latestAnalysis: any = null;

      companyIds.forEach(cid => {
        const analyses = geoByCompany.get(cid) || [];
        totalAnalyses += analyses.length;
        // deno-lint-ignore no-explicit-any
        analyses.forEach((a: any) => {
          if (a.status === 'completed') {
            completedAnalyses++;
            if (a.geo_score != null && (bestGeoScore == null || a.geo_score > bestGeoScore)) {
              bestGeoScore = a.geo_score;
            }
          }
          if (!latestAnalysis || a.created_at > latestAnalysis.created_at) {
            latestAnalysis = a;
          }
        });
      });

      const tenantPrompts = promptsByTenant.get(tenantId) || [];
      const activePrompts = tenantPrompts.filter((p: any) => p.is_active);
      const totalAnswers = answersByTenant.get(tenantId) || 0;

      // Progress steps
      const hasCompany = tenantCompanies.length > 0;
      const hasAnalysis = completedAnalyses > 0;
      const hasPrompts = activePrompts.length > 0;
      const hasAnswers = totalAnswers > 0;

      const progressSteps = [hasCompany, hasAnalysis, hasPrompts, hasAnswers];
      const progressPercent = Math.round((progressSteps.filter(Boolean).length / progressSteps.length) * 100);

      return {
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
        // Tenant
        tenant_id: tenantId,
        tenant_name: tenant?.name || null,
        tenant_slug: tenant?.slug || null,
        plan_name: plan?.name || null,
        // Company progress
        has_company: hasCompany,
        company_name: tenantCompanies[0]?.company_name || null,
        company_domain: tenantCompanies[0]?.domain || null,
        companies_count: tenantCompanies.length,
        // Deep analysis progress
        has_analysis: hasAnalysis,
        total_analyses: totalAnalyses,
        completed_analyses: completedAnalyses,
        best_geo_score: bestGeoScore,
        latest_analysis_status: latestAnalysis?.status || null,
        latest_analysis_at: latestAnalysis?.created_at || null,
        // Prompts progress
        has_prompts: hasPrompts,
        total_prompts: tenantPrompts.length,
        active_prompts: activePrompts.length,
        // Answers
        has_answers: hasAnswers,
        total_answers: totalAnswers,
        // Overall progress
        progress_percent: progressPercent,
      };
    }).filter(Boolean);

    return logger.done(withCors(req, ok(activeUsers)), authCtx);

  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[admin-active-users]", err);
    if (err.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: err.message, code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
          { status: err.status, headers: { "Content-Type": "application/json" } },
        ),
      ));
    }
    return logger.done(withCors(req, serverError(err.message || "Internal server error")));
  }
});
