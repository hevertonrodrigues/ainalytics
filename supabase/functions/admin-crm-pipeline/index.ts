import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const logger = createRequestLogger("admin-crm-pipeline", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { user_id?: string } = {};
  
  try {
    const { user } = await verifySuperAdmin(req);
    authCtx = { user_id: user.id };

    if (req.method !== "GET" && req.method !== "PATCH") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
    }

    const db = createAdminClient();

    // ── PATCH: Update subscription status/dates/plan ──
    if (req.method === "PATCH") {
      const body = await req.json();
      const { tenant_id, status, current_period_start, current_period_end, plan_id } = body;

      if (!tenant_id) {
        return logger.done(withCors(req, badRequest("tenant_id is required")), authCtx);
      }

      // Find the latest subscription for this tenant
      const { data: sub } = await db
        .from("subscriptions")
        .select("id, plan_id, status, billing_interval, paid_amount, currency, stripe_subscription_id, stripe_customer_id")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // ── Plan change: cancel old + create new ──
      if (plan_id && (!sub || sub.plan_id !== plan_id)) {
        // Cancel existing subscription if any
        if (sub) {
          await db
            .from("subscriptions")
            .update({ status: "canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", sub.id);
        }

        // Create new subscription with provided or default values
        const now = new Date();
        const threeMonthsLater = new Date(now);
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

        const { error: insertErr } = await db
          .from("subscriptions")
          .insert({
            tenant_id,
            plan_id,
            stripe_subscription_id: sub?.stripe_subscription_id || null,
            stripe_customer_id: sub?.stripe_customer_id || null,
            status: status || "active",
            billing_interval: sub?.billing_interval || "unique",
            paid_amount: sub?.paid_amount || 0,
            currency: sub?.currency || "usd",
            current_period_start: current_period_start || now.toISOString(),
            current_period_end: current_period_end || threeMonthsLater.toISOString(),
            cancel_at_period_end: false,
          });

        if (insertErr) throw insertErr;
        return logger.done(withCors(req, ok({ updated: true, plan_changed: true })), authCtx);
      }

      // ── Status/dates update only (no plan change) ──
      if (!sub) {
        return logger.done(withCors(req, badRequest("No subscription found for this tenant")), authCtx);
      }

      // Build update payload — only include provided fields
      // deno-lint-ignore no-explicit-any
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      if (status !== undefined) update.status = status;
      if (current_period_start !== undefined) update.current_period_start = current_period_start;
      if (current_period_end !== undefined) update.current_period_end = current_period_end;

      const { error: updateErr } = await db
        .from("subscriptions")
        .update(update)
        .eq("id", sub.id);

      if (updateErr) throw updateErr;

      return logger.done(withCors(req, ok({ updated: true })), authCtx);
    }

    // ── Parallel data fetching (all flat queries, no PostgREST joins) ──

    const [
      profilesRes,
      tenantUsersRes,
      tenantsRes,
      plansRes,
      companiesRes,
      subscriptionsRes,
      paymentsRes,
      activationPlansRes,
      authUsersRes,
      proposalsRes,
    ] = await Promise.all([
      db.from("profiles").select("user_id, full_name, email, avatar_url, locale, is_sa, has_seen_onboarding, created_at").order("created_at", { ascending: false }),
      db.from("tenant_users").select("user_id, tenant_id, role").eq("is_active", true),
      db.from("tenants").select("id, name, slug, created_at, code"),
      db.from("plans").select("id, name, price"),
      db.from("companies").select("tenant_id, domain, company_name, industry, country"),
      db.from("subscriptions").select("tenant_id, plan_id, status, billing_interval, paid_amount, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end, cancel_at_period_end, created_at"),
      db.from("payment_attempts").select("tenant_id, status, amount, currency, stripe_payment_intent_id, created_at").order("created_at", { ascending: false }),
      db.from("activation_plans").select("tenant_id, code, plan_id, is_active, created_at"),
      db.auth.admin.listUsers({ perPage: 1000 }),
      db.from("proposals").select("user_id, status").eq("status", "accepted"),
    ]);

    // Check for errors
    for (const r of [profilesRes, tenantUsersRes, tenantsRes, plansRes, companiesRes, subscriptionsRes, paymentsRes, activationPlansRes]) {
      // deno-lint-ignore no-explicit-any
      if ((r as any).error) throw (r as any).error;
    }

    const profiles = profilesRes.data || [];
    const tenantUsers = tenantUsersRes.data || [];
    const tenants = tenantsRes.data || [];
    const plans = plansRes.data || [];
    const companies = companiesRes.data || [];
    const subscriptions = subscriptionsRes.data || [];
    const payments = paymentsRes.data || [];
    const activationPlans = activationPlansRes.data || [];
    const authUsers = authUsersRes.data?.users || [];
    const acceptedProposals = proposalsRes.data || [];

    // ── Build lookup maps ──

    // deno-lint-ignore no-explicit-any
    const planMap = new Map(plans.map((p: any) => [p.id, p]));
    // deno-lint-ignore no-explicit-any
    const tenantMap = new Map(tenants.map((t: any) => [t.id, t]));
    // deno-lint-ignore no-explicit-any
    const companyByTenant = new Map<string, any>();
    // deno-lint-ignore no-explicit-any
    companies.forEach((c: any) => { if (!companyByTenant.has(c.tenant_id)) companyByTenant.set(c.tenant_id, c); });
    // deno-lint-ignore no-explicit-any
    const subByTenant = new Map<string, any>();
    // deno-lint-ignore no-explicit-any
    subscriptions.forEach((s: any) => { if (!subByTenant.has(s.tenant_id)) subByTenant.set(s.tenant_id, s); });
    // deno-lint-ignore no-explicit-any
    const paymentsByTenant = new Map<string, any[]>();
    // deno-lint-ignore no-explicit-any
    payments.forEach((p: any) => {
      if (!paymentsByTenant.has(p.tenant_id)) paymentsByTenant.set(p.tenant_id, []);
      paymentsByTenant.get(p.tenant_id)!.push(p);
    });
    // deno-lint-ignore no-explicit-any
    const tuByUser = new Map<string, any>();
    // deno-lint-ignore no-explicit-any
    tenantUsers.forEach((tu: any) => { if (!tuByUser.has(tu.user_id)) tuByUser.set(tu.user_id, tu); });
    // deno-lint-ignore no-explicit-any
    const authUserMap = new Map<string, any>();
    // deno-lint-ignore no-explicit-any
    authUsers.forEach((u: any) => authUserMap.set(u.id, u));
    // deno-lint-ignore no-explicit-any
    const activationByTenant = new Map<string, any>();
    // deno-lint-ignore no-explicit-any
    activationPlans.forEach((a: any) => { if (a.tenant_id && !activationByTenant.has(a.tenant_id)) activationByTenant.set(a.tenant_id, a); });
    // deno-lint-ignore no-explicit-any
    const acceptedProposalUserIds = new Set(acceptedProposals.map((p: any) => p.user_id).filter(Boolean));

    // ── Combine into pipeline cards ──

    // deno-lint-ignore no-explicit-any
    const pipeline = profiles.map((profile: any) => {
      const activeTenantUser = tuByUser.get(profile.user_id);
      const tenantId = activeTenantUser?.tenant_id;
      const tenant = tenantId ? tenantMap.get(tenantId) : null;
      const company = tenantId ? companyByTenant.get(tenantId) : null;
      const subscription = tenantId ? subByTenant.get(tenantId) : null;
      const tenantPayments = tenantId ? (paymentsByTenant.get(tenantId) || []) : [];
      const lastPayment = tenantPayments[0];
      const plan = subscription?.plan_id ? planMap.get(subscription.plan_id) : null;
      const authUser = authUserMap.get(profile.user_id);
      const activation = tenantId ? activationByTenant.get(tenantId) : null;

      // Determine Kanban stage + classification
      const emailConfirmed = !!authUser?.email_confirmed_at;
      const subStatus = subscription?.status;
      const hasStripe = !!subscription?.stripe_subscription_id;
      const hasActivation = !!activation;
      const planPrice = Number(plan?.price || 0);
      const isPaidPlan = planPrice > 0;

      // Check if this tenant ever had a paid active subscription (for churn type)
      // deno-lint-ignore no-explicit-any
      const allTenantSubs = tenantId ? subscriptions.filter((s: any) => s.tenant_id === tenantId) : [];
      // deno-lint-ignore no-explicit-any
      const wasEverPaid = allTenantSubs.some((s: any) => {
        const sp = s.plan_id ? planMap.get(s.plan_id) : null;
        return s.status === 'active' && Number(sp?.price || 0) > 0;
      });

      let stage = "registered";
      let userClassification = "registered";

      if (subStatus === "canceled") {
        if (wasEverPaid || isPaidPlan) {
          stage = "churned_from_paid";
          userClassification = "churned_paid";
        } else {
          stage = "churned_from_trial";
          userClassification = "churned_trial";
        }
      } else if (subStatus === "trialing") {
        stage = hasStripe ? "trial_stripe" : (hasActivation ? "trial_activation" : "trial_other");
        userClassification = "trial";
      } else if (subStatus === "active" && isPaidPlan) {
        stage = hasStripe ? "active_stripe" : (hasActivation ? "active_activation" : "active_other");
        userClassification = "paid";
      } else if (subStatus === "active" && !isPaidPlan) {
        stage = "free_user";
        userClassification = "free";
      } else if (emailConfirmed && acceptedProposalUserIds.has(profile.user_id)) {
        stage = "proposal_accepted";
      } else if (emailConfirmed) {
        stage = "email_confirmed";
      }

      return {
        // Profile
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        avatar_url: profile.avatar_url,
        locale: profile.locale,
        is_sa: profile.is_sa,
        has_seen_onboarding: profile.has_seen_onboarding,
        created_at: profile.created_at,
        // Auth
        email_confirmed_at: authUser?.email_confirmed_at || null,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        // Tenant
        tenant_id: tenant?.id || null,
        tenant_name: tenant?.name || null,
        tenant_slug: tenant?.slug || null,
        tenant_code: tenant?.code || null,
        tenant_created_at: tenant?.created_at || null,
        tenant_role: activeTenantUser?.role || null,
        // Company
        company_domain: company?.domain || null,
        company_name: company?.company_name || null,
        company_industry: company?.industry || null,
        company_country: company?.country || null,
        // Plan & Subscription
        subscription_plan_id: subscription?.plan_id || null,
        plan_name: plan?.name || null,
        plan_price: planPrice,
        subscription_status: subStatus || null,
        billing_interval: subscription?.billing_interval || null,
        paid_amount: subscription?.paid_amount || 0,
        stripe_subscription_id: subscription?.stripe_subscription_id || null,
        stripe_customer_id: subscription?.stripe_customer_id || null,
        current_period_start: subscription?.current_period_start || null,
        current_period_end: subscription?.current_period_end || null,
        cancel_at_period_end: subscription?.cancel_at_period_end || false,
        subscription_created_at: subscription?.created_at || null,
        // Activation code
        activation_code: activation?.code || null,
        activation_plan_name: activation?.plan_id ? planMap.get(activation.plan_id)?.name : null,
        // Payment
        last_payment_status: lastPayment?.status || null,
        last_payment_at: lastPayment?.created_at || null,
        last_payment_amount: lastPayment?.amount || 0,
        total_payment_attempts: tenantPayments.length,
        // ★ Updated: Kanban stage + classification
        stage,
        user_classification: userClassification,
        is_paid_user: userClassification === "paid",
      };
    });

    return logger.done(withCors(req, ok(pipeline)), authCtx);

  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[admin-crm-pipeline]", err);
    if (err.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({
            success: false,
            error: {
              message: err.message,
              code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
            },
          }),
          {
            status: err.status,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ));
    }
    return logger.done(withCors(req, serverError(err.message || "Internal server error")));
  }
});
