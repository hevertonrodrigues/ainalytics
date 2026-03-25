import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const logger = createRequestLogger("admin-settings", req);
  if (req.method === "OPTIONS") return handleCors(req);

  // deno-lint-ignore no-explicit-any
  let authCtx: any = {};

  try {
    const { user } = await verifySuperAdmin(req);
    authCtx = { user_id: user.id };

    const url = new URL(req.url);
    const entity = url.searchParams.get("entity"); // plans | activation_codes | platforms | models
    const id = url.searchParams.get("id");

    if (!entity || !["plans", "activation_codes", "platforms", "models"].includes(entity)) {
      return logger.done(withCors(req, badRequest("Missing or invalid entity param")), authCtx);
    }

    const db = createAdminClient();

    // ─── GET ──────────────────────────────────────────────────
    if (req.method === "GET") {
      if (entity === "plans") {
        const { data, error } = await db.from("plans").select("*").order("sort_order");
        if (error) throw error;
        return logger.done(withCors(req, ok(data)), authCtx);
      }

      if (entity === "activation_codes") {
        const { data: codes, error } = await db
          .from("activation_plans")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;

        // Enrich with plan name and tenant name
        const planIds = [...new Set(codes?.map((c: Record<string, unknown>) => c.plan_id).filter(Boolean))];
        const tenantIds = [...new Set(codes?.map((c: Record<string, unknown>) => c.tenant_id).filter(Boolean))];

        const [plansRes, tenantsRes] = await Promise.all([
          planIds.length > 0 ? db.from("plans").select("id, name").in("id", planIds) : { data: [], error: null },
          tenantIds.length > 0 ? db.from("tenants").select("id, name").in("id", tenantIds) : { data: [], error: null },
        ]);

        // deno-lint-ignore no-explicit-any
        const planMap = new Map((plansRes.data || []).map((p: any) => [p.id, p.name]));
        // deno-lint-ignore no-explicit-any
        const tenantMap = new Map((tenantsRes.data || []).map((t: any) => [t.id, t.name]));

        const enriched = codes?.map((c: Record<string, unknown>) => ({
          ...c,
          plan_name: planMap.get(c.plan_id as string) || null,
          tenant_name: tenantMap.get(c.tenant_id as string) || null,
        }));

        return logger.done(withCors(req, ok(enriched)), authCtx);
      }

      if (entity === "platforms") {
        const { data, error } = await db.from("platforms").select("*").order("slug");
        if (error) throw error;
        return logger.done(withCors(req, ok(data)), authCtx);
      }

      if (entity === "models") {
        const { data: models, error } = await db.from("models").select("*").order("slug");
        if (error) throw error;

        // Enrich with platform name
        const platformIds = [...new Set(models?.map((m: Record<string, unknown>) => m.platform_id).filter(Boolean))];
        const { data: platforms } = platformIds.length > 0
          ? await db.from("platforms").select("id, name, slug").in("id", platformIds)
          : { data: [] };

        // deno-lint-ignore no-explicit-any
        const platformMap = new Map((platforms || []).map((p: any) => [p.id, { name: p.name, slug: p.slug }]));

        const enriched = models?.map((m: Record<string, unknown>) => ({
          ...m,
          platform_name: (platformMap.get(m.platform_id as string) as Record<string, string>)?.name || null,
          platform_slug: (platformMap.get(m.platform_id as string) as Record<string, string>)?.slug || null,
        }));

        return logger.done(withCors(req, ok(enriched)), authCtx);
      }
    }

    // ─── POST (create) ────────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json();

      if (entity === "plans") {
        const { name, price, is_active, sort_order, settings, features } = body;
        if (!name) return logger.done(withCors(req, badRequest("name required")), authCtx);
        const { data, error } = await db.from("plans").insert({
          name, price: price || 0, is_active: is_active ?? true,
          sort_order: sort_order || 0, settings: settings || {}, features: features || {},
        }).select().single();
        if (error) throw error;
        return logger.done(withCors(req, ok(data)), authCtx);
      }

      if (entity === "activation_codes") {
        const { plan_id, code } = body;
        if (!code || code.length !== 12) return logger.done(withCors(req, badRequest("code must be 12 chars")), authCtx);
        const { data, error } = await db.from("activation_plans").insert({
          plan_id: plan_id || null, code, is_active: true,
        }).select().single();
        if (error) throw error;
        return logger.done(withCors(req, ok(data)), authCtx);
      }

      if (entity === "platforms") {
        const { slug, name, is_active } = body;
        if (!slug || !name) return logger.done(withCors(req, badRequest("slug and name required")), authCtx);
        const { data, error } = await db.from("platforms").insert({
          slug, name, is_active: is_active ?? true,
        }).select().single();
        if (error) throw error;
        return logger.done(withCors(req, ok(data)), authCtx);
      }

      if (entity === "models") {
        const { platform_id, slug, name, is_default, web_search_active } = body;
        if (!platform_id || !slug || !name) return logger.done(withCors(req, badRequest("platform_id, slug, name required")), authCtx);
        const { data, error } = await db.from("models").insert({
          platform_id, slug, name, is_default: is_default ?? false,
          web_search_active: web_search_active ?? false,
        }).select().single();
        if (error) throw error;
        return logger.done(withCors(req, ok(data)), authCtx);
      }
    }

    // ─── PUT (update) ─────────────────────────────────────────
    if (req.method === "PUT") {
      if (!id) return logger.done(withCors(req, badRequest("id required")), authCtx);
      const body = await req.json();

      if (entity === "plans") {
        const { name, price, is_active, sort_order, settings, features } = body;
        const { data, error } = await db.from("plans").update({ name, price, is_active, sort_order, settings, features }).eq("id", id).select().single();
        if (error) throw error;
        return logger.done(withCors(req, ok(data)), authCtx);
      }

      if (entity === "activation_codes") {
        const { plan_id, code, is_active } = body;
        const { data, error } = await db.from("activation_plans").update({ plan_id, code, is_active }).eq("id", id).select().single();
        if (error) throw error;
        return logger.done(withCors(req, ok(data)), authCtx);
      }

      if (entity === "platforms") {
        const { slug, name, is_active, default_model_id } = body;
        const { data, error } = await db.from("platforms").update({ slug, name, is_active, default_model_id }).eq("id", id).select().single();
        if (error) throw error;
        return logger.done(withCors(req, ok(data)), authCtx);
      }

      if (entity === "models") {
        const { platform_id, slug, name, is_default, web_search_active, is_active } = body;
        const { data, error } = await db.from("models").update({ platform_id, slug, name, is_default, web_search_active, is_active }).eq("id", id).select().single();
        if (error) throw error;
        return logger.done(withCors(req, ok(data)), authCtx);
      }
    }

    // ─── DELETE ───────────────────────────────────────────────
    if (req.method === "DELETE") {
      if (!id) return logger.done(withCors(req, badRequest("id required")), authCtx);

      const table = entity === "activation_codes" ? "activation_plans" : entity;
      const { error } = await db.from(table).delete().eq("id", id);
      if (error) throw error;
      return logger.done(withCors(req, ok({ deleted: true })), authCtx);
    }

    return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);

  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[admin-settings]", err);
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
