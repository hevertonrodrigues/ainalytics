import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { fetchModelsForPlatform, supportsModelListing } from "../_shared/ai-providers/model-fetcher.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * Platforms Edge Function
 * - GET  /                        → list all platforms (with default model)
 * - PUT  /                        → update platform (toggle is_active, set default_model_id)
 * - GET  /models?platformId=X     → list models for a platform
 * - POST /sync?platformId=X       → sync models from platform API
 * - GET  /preferences             → list tenant's platform+model preferences
 * - POST /preferences             → add/update a tenant preference
 * - DELETE /preferences?id=X      → remove a tenant preference
 *
 * Platforms and models are seeded via supabase/seed.sql
 */

serve(async (req: Request) => {
  const logger = createRequestLogger("platforms", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { tenant_id?: string; user_id?: string } = {};
  try {
    const { tenantId, user } = await verifyAuth(req);
    authCtx = { tenant_id: tenantId, user_id: user.id };
    const url = new URL(req.url);
    const subPath = url.pathname.split("/platforms").pop() || "";

    // ── Preferences routes (tenant-specific) ──
    if (subPath.startsWith("/preferences")) {
      switch (req.method) {
        case "GET":    return logger.done(withCors(req, await handleGetPreferences(tenantId)), authCtx);
        case "POST":   return logger.done(withCors(req, await handleSetPreference(req, tenantId)), authCtx);
        case "DELETE": return logger.done(withCors(req, await handleDeletePreference(req, tenantId)), authCtx);
        default:       return logger.done(withCors(req, badRequest("Method not allowed")), authCtx);
      }
    }

    // ── Models route ──
    if (subPath.startsWith("/models")) {
      if (req.method === "GET") return logger.done(withCors(req, await handleGetModels(req)), authCtx);
      return logger.done(withCors(req, badRequest("Method not allowed")), authCtx);
    }

    // ── Sync route ──
    if (subPath.startsWith("/sync") && req.method === "POST") {
      await requireSuperAdmin(user.id, tenantId);
      return logger.done(withCors(req, await handleSync(req)), authCtx);
    }

    // ── Base platform routes ──
    switch (req.method) {
      case "GET":  return logger.done(withCors(req, await handleList()), authCtx);
      case "PUT":
        await requireSuperAdmin(user.id, tenantId);
        return logger.done(withCors(req, await handleUpdate(req)), authCtx);
      default:     return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
    }
  } catch (err: unknown) {
    console.error("[platforms]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: e.message, code: e.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
          { status: e.status, headers: { "Content-Type": "application/json" } },
        ),
      ), authCtx);
    }
    return logger.done(withCors(req, serverError(e.message || "Internal server error")), authCtx);
  }
});

async function requireSuperAdmin(userId: string, tenantId: string): Promise<void> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("profiles")
    .select("is_sa")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_sa", true)
    .limit(1);

  if (error) {
    throw { status: 500, message: "Failed to verify superadmin access" };
  }

  if (!data || data.length === 0) {
    throw { status: 403, message: "Superadmin access required" };
  }
}

// ── List all platforms with their default model (global) ──
async function handleList() {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("platforms")
    .select("*, default_model:models!default_model_id(id, slug, name)")
    .order("name");

  if (error) return serverError(error.message);
  return ok(data || []);
}

// ── Update platform (global) ──
async function handleUpdate(req: Request) {
  const body = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("Invalid request body");
  }

  const payload = body as Record<string, unknown>;
  const allowedKeys = new Set(["id", "is_active", "default_model_id"]);
  const unknownKeys = Object.keys(payload).filter((k) => !allowedKeys.has(k));
  if (unknownKeys.length > 0) {
    return badRequest(`Unsupported fields: ${unknownKeys.join(", ")}`);
  }

  const id = payload.id;
  if (typeof id !== "string" || id.trim().length === 0) {
    return badRequest("id is required");
  }

  const updates: Record<string, unknown> = {};
  if ("is_active" in payload) {
    if (typeof payload.is_active !== "boolean") {
      return badRequest("is_active must be a boolean");
    }
    updates.is_active = payload.is_active;
  }

  if ("default_model_id" in payload) {
    const value = payload.default_model_id;
    if (!(typeof value === "string" || value === null)) {
      return badRequest("default_model_id must be a string or null");
    }
    if (typeof value === "string" && value.trim().length === 0) {
      return badRequest("default_model_id must not be empty");
    }
    updates.default_model_id = value;
  }

  if (Object.keys(updates).length === 0) {
    return badRequest("No allowed fields to update");
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("platforms")
    .update(updates)
    .eq("id", id.trim())
    .select("*, default_model:models!default_model_id(id, slug, name)")
    .single();

  if (error) return serverError(error.message);
  return ok(data);
}

// ── List models for a platform (global) ──
async function handleGetModels(req: Request) {
  const url = new URL(req.url);
  const platformId = url.searchParams.get("platformId");
  if (!platformId) return badRequest("platformId is required");

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("models")
    .select("*")
    .eq("platform_id", platformId)
    .eq("is_active", true)
    .order("name");

  if (error) return serverError(error.message);
  return ok(data);
}



// ── Sync models from platform API (global) ──
async function handleSync(req: Request) {
  const url = new URL(req.url);
  const platformId = url.searchParams.get("platformId");
  if (!platformId) return badRequest("platformId is required");

  const sb = createAdminClient();

  // Get platform info
  const { data: platform, error: pErr } = await sb
    .from("platforms")
    .select("*")
    .eq("id", platformId)
    .single();

  if (pErr || !platform) return badRequest("Platform not found");

  if (!supportsModelListing(platform.slug)) {
    return ok({ synced: 0, message: `${platform.name} does not support model listing API` });
  }

  // Fetch models from the platform's API (now includes pricing)
  const fetched = await fetchModelsForPlatform(platform.slug);
  if (fetched.length === 0) {
    return ok({ synced: 0, message: "No models returned — check API key" });
  }

  // Get existing models for this platform (include pricing columns)
  const { data: existing } = await sb
    .from("models")
    .select("slug, price_per_input_token, price_per_output_token")
    .eq("platform_id", platformId);

  const existingMap = new Map<string, { input: number | null; output: number | null }>(
    (existing || []).map((m: { slug: string; price_per_input_token: number | null; price_per_output_token: number | null }) =>
      [m.slug, { input: m.price_per_input_token, output: m.price_per_output_token }] as [string, { input: number | null; output: number | null }]
    ),
  );

  // Insert NEW models (with pricing)
  const newModels = fetched.filter((m) => !existingMap.has(m.slug));
  let insertedCount = 0;

  if (newModels.length > 0) {
    const rows = newModels.map((m) => ({
      platform_id: platformId,
      slug: m.slug,
      name: m.name,
      is_active: false,
      price_per_input_token: m.pricePerInputToken || null,
      price_per_output_token: m.pricePerOutputToken || null,
      pricing_updated_at: m.pricePerInputToken > 0 ? new Date().toISOString() : null,
    }));

    const { error: iErr } = await sb.from("models").insert(rows);
    if (iErr) return serverError(iErr.message);
    insertedCount = newModels.length;
  }

  // Update EXISTING models that have zero/null pricing but we now have pricing data
  let pricingUpdated = 0;
  const updates: Promise<unknown>[] = [];

  for (const m of fetched) {
    if (!existingMap.has(m.slug)) continue; // already inserted above
    if (m.pricePerInputToken <= 0 && m.pricePerOutputToken <= 0) continue; // no pricing to set

    const current = existingMap.get(m.slug)!;
    const hasNoPricing = (!current.input || Number(current.input) === 0)
                      && (!current.output || Number(current.output) === 0);

    if (hasNoPricing) {
      updates.push(
        sb.from("models")
          .update({
            price_per_input_token: m.pricePerInputToken,
            price_per_output_token: m.pricePerOutputToken,
            pricing_updated_at: new Date().toISOString(),
          })
          .eq("platform_id", platformId)
          .eq("slug", m.slug)
      );
      pricingUpdated++;
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  return ok({
    synced: insertedCount,
    pricing_updated: pricingUpdated,
    total: fetched.length,
    new_models: newModels.map((m) => m.slug),
    message: insertedCount === 0 && pricingUpdated === 0
      ? "All models already synced with pricing"
      : undefined,
  });
}

// ── Tenant Preferences: GET ──
async function handleGetPreferences(tenantId: string) {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("tenant_platform_models")
    .select("*, platform:platforms(id, slug, name), model:models(id, slug, name, web_search_active)")
    .eq("tenant_id", tenantId)
    .order("created_at");

  if (error) return serverError(error.message);
  return ok(data);
}

// ── Tenant Preferences: POST (add/update) ──
async function handleSetPreference(req: Request, tenantId: string) {
  const body = await req.json();
  const { platform_id, model_id, is_active } = body;

  if (!platform_id || !model_id) return badRequest("platform_id and model_id are required");

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("tenant_platform_models")
    .upsert(
      { tenant_id: tenantId, platform_id, model_id, is_active: is_active ?? true },
      { onConflict: "tenant_id,platform_id,model_id" },
    )
    .select("*, platform:platforms(id, slug, name), model:models(id, slug, name)")
    .single();

  if (error) return serverError(error.message);
  return ok(data);
}

// ── Tenant Preferences: DELETE ──
async function handleDeletePreference(req: Request, tenantId: string) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return badRequest("id query param is required");

  const sb = createAdminClient();
  const { error } = await sb
    .from("tenant_platform_models")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return serverError(error.message);
  return ok({ deleted: true });
}
