import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { fetchModelsForPlatform, supportsModelListing } from "../_shared/ai-providers/model-fetcher.ts";

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
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId } = await verifyAuth(req);
    const url = new URL(req.url);
    const subPath = url.pathname.split("/platforms").pop() || "";

    // ── Preferences routes (tenant-specific) ──
    if (subPath.startsWith("/preferences")) {
      switch (req.method) {
        case "GET":    return withCors(req, await handleGetPreferences(tenantId));
        case "POST":   return withCors(req, await handleSetPreference(req, tenantId));
        case "DELETE": return withCors(req, await handleDeletePreference(req, tenantId));
        default:       return withCors(req, badRequest("Method not allowed"));
      }
    }

    // ── Models route ──
    if (subPath.startsWith("/models")) {
      if (req.method === "GET") return withCors(req, await handleGetModels(req));
      return withCors(req, badRequest("Method not allowed"));
    }



    // ── Sync route ──
    if (subPath.startsWith("/sync") && req.method === "POST") {
      return withCors(req, await handleSync(req));
    }

    // ── Base platform routes ──
    switch (req.method) {
      case "GET":  return withCors(req, await handleList());
      case "PUT":  return withCors(req, await handleUpdate(req));
      default:     return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }
  } catch (err: unknown) {
    console.error("[platforms]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: e.message, code: e.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
          { status: e.status, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return withCors(req, serverError(e.message || "Internal server error"));
  }
});

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
  const { id, ...updates } = body;
  if (!id) return badRequest("id is required");

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("platforms")
    .update(updates)
    .eq("id", id)
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

  // Fetch models from the platform's API
  const fetched = await fetchModelsForPlatform(platform.slug);
  if (fetched.length === 0) {
    return ok({ synced: 0, message: "No models returned — check API key" });
  }

  // Get existing models for this platform
  const { data: existing } = await sb
    .from("models")
    .select("slug")
    .eq("platform_id", platformId);

  const existingSlugs = new Set((existing || []).map((m: { slug: string }) => m.slug));

  // Only insert new models (don't delete existing ones)
  const newModels = fetched.filter((m) => !existingSlugs.has(m.slug));

  if (newModels.length === 0) {
    return ok({ synced: 0, total: fetched.length, message: "All models already synced" });
  }

  const rows = newModels.map((m) => ({
    platform_id: platformId,
    slug: m.slug,
    name: m.name,
    is_active: false,
  }));

  const { error: iErr } = await sb.from("models").insert(rows);
  if (iErr) return serverError(iErr.message);

  return ok({ synced: newModels.length, total: fetched.length, new_models: newModels.map((m) => m.slug) });
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

