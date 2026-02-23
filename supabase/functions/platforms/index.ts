import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { fetchModelsForPlatform, supportsModelListing } from "../_shared/ai-providers/model-fetcher.ts";

/**
 * Platforms Edge Function
 * - GET  /                 → list all platforms (with models)
 * - PUT  /                 → update platform (toggle is_active, set default_model_id)
 * - GET  /models?platformId=X  → list models for a platform
 * - POST /sync?platformId=X    → sync models from platform API
 * - POST /seed             → seed default platforms + models (once per tenant)
 */

const DEFAULT_PLATFORMS = [
  {
    slug: "openai", name: "OpenAI", models: [
      { slug: "gpt-5.2",      name: "GPT-5.2",      is_default: true },
      { slug: "gpt-5.2-mini", name: "GPT-5.2 Mini", is_default: false },
      { slug: "gpt-5-pro",    name: "GPT-5 Pro",    is_default: false },
      { slug: "gpt-4.1",      name: "GPT-4.1",      is_default: false },
      { slug: "gpt-4.1-mini", name: "GPT-4.1 Mini", is_default: false },
      { slug: "gpt-4.1-nano", name: "GPT-4.1 Nano", is_default: false },
      { slug: "o3",           name: "O3",            is_default: false },
      { slug: "o4-mini",      name: "O4 Mini",       is_default: false },
    ],
  },
  {
    slug: "anthropic", name: "Anthropic", models: [
      { slug: "claude-sonnet-4-6",         name: "Claude Sonnet 4.6",  is_default: true },
      { slug: "claude-opus-4-6",           name: "Claude Opus 4.6",   is_default: false },
      { slug: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5",  is_default: false },
    ],
  },
  {
    slug: "gemini", name: "Gemini", models: [
      { slug: "gemini-3.1-pro",   name: "Gemini 3.1 Pro",   is_default: true },
      { slug: "gemini-3-flash",   name: "Gemini 3 Flash",   is_default: false },
      { slug: "gemini-2.5-pro",   name: "Gemini 2.5 Pro",   is_default: false },
      { slug: "gemini-2.5-flash", name: "Gemini 2.5 Flash", is_default: false },
    ],
  },
  {
    slug: "grok", name: "Grok (xAI)", models: [
      { slug: "grok-4-1-fast-reasoning",     name: "Grok 4.1 Fast Reasoning",     is_default: true },
      { slug: "grok-4-1-fast-non-reasoning", name: "Grok 4.1 Fast Non-Reasoning", is_default: false },
      { slug: "grok-3",                      name: "Grok 3",                      is_default: false },
      { slug: "grok-3-mini",                 name: "Grok 3 Mini",                 is_default: false },
    ],
  },
  {
    slug: "perplexity", name: "Perplexity", models: [
      { slug: "llama-3.1-sonar-large-online", name: "Sonar Large Online",  is_default: true },
      { slug: "llama-3.1-sonar-small-online", name: "Sonar Small Online",  is_default: false },
      { slug: "llama-3.1-sonar-huge-online",  name: "Sonar Huge Online",   is_default: false },
    ],
  },
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId } = await verifyAuth(req);
    const url = new URL(req.url);
    const subPath = url.pathname.split("/platforms").pop() || "";

    // ── Models route ──
    if (subPath.startsWith("/models")) {
      if (req.method === "GET") return withCors(req, await handleGetModels(req, tenantId));
      return withCors(req, badRequest("Method not allowed"));
    }

    // ── Seed route ──
    if (subPath.startsWith("/seed") && req.method === "POST") {
      return withCors(req, await handleSeed(tenantId));
    }

    // ── Sync route ──
    if (subPath.startsWith("/sync") && req.method === "POST") {
      return withCors(req, await handleSync(req, tenantId));
    }

    // ── Base platform routes ──
    switch (req.method) {
      case "GET":  return withCors(req, await handleList(tenantId));
      case "PUT":  return withCors(req, await handleUpdate(req, tenantId));
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

// ── List all platforms with their default model ──
async function handleList(tenantId: string) {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("platforms")
    .select("*, default_model:models!default_model_id(id, slug, name)")
    .eq("tenant_id", tenantId)
    .order("name");

  if (error) return serverError(error.message);

  // If no platforms yet, seed them
  if (!data || data.length === 0) {
    const seedResult = await seedPlatforms(sb, tenantId);
    return ok(seedResult);
  }

  return ok(data);
}

// ── Update platform ──
async function handleUpdate(req: Request, tenantId: string) {
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return badRequest("id is required");

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("platforms")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("*, default_model:models!default_model_id(id, slug, name)")
    .single();

  if (error) return serverError(error.message);
  return ok(data);
}

// ── List models for a platform ──
async function handleGetModels(req: Request, tenantId: string) {
  const url = new URL(req.url);
  const platformId = url.searchParams.get("platformId");
  if (!platformId) return badRequest("platformId is required");

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("models")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("platform_id", platformId)
    .order("name");

  if (error) return serverError(error.message);
  return ok(data);
}

// ── Seed default platforms + models ──
async function handleSeed(tenantId: string) {
  const sb = createAdminClient();
  const result = await seedPlatforms(sb, tenantId);
  return ok(result);
}

// ── Sync models from platform API ──
async function handleSync(req: Request, tenantId: string) {
  const url = new URL(req.url);
  const platformId = url.searchParams.get("platformId");
  if (!platformId) return badRequest("platformId is required");

  const sb = createAdminClient();

  // Get platform info
  const { data: platform, error: pErr } = await sb
    .from("platforms")
    .select("*")
    .eq("id", platformId)
    .eq("tenant_id", tenantId)
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
    .eq("tenant_id", tenantId)
    .eq("platform_id", platformId);

  const existingSlugs = new Set((existing || []).map((m: { slug: string }) => m.slug));

  // Only insert new models (don't delete existing ones)
  const newModels = fetched.filter((m) => !existingSlugs.has(m.slug));

  if (newModels.length === 0) {
    return ok({ synced: 0, total: fetched.length, message: "All models already synced" });
  }

  const rows = newModels.map((m) => ({
    tenant_id: tenantId,
    platform_id: platformId,
    slug: m.slug,
    name: m.name,
    is_default: false,
  }));

  const { error: iErr } = await sb.from("models").insert(rows);
  if (iErr) return serverError(iErr.message);

  return ok({ synced: newModels.length, total: fetched.length, new_models: newModels.map((m) => m.slug) });
}

async function seedPlatforms(sb: ReturnType<typeof createAdminClient>, tenantId: string) {
  const platformResults = [];

  for (const platformDef of DEFAULT_PLATFORMS) {
    // Upsert platform
    const { data: platform, error: pErr } = await sb
      .from("platforms")
      .upsert(
        { tenant_id: tenantId, slug: platformDef.slug, name: platformDef.name },
        { onConflict: "tenant_id,slug" },
      )
      .select()
      .single();

    if (pErr) throw new Error(`Platform ${platformDef.slug}: ${pErr.message}`);

    // Upsert models
    const modelRows = platformDef.models.map((m) => ({
      tenant_id: tenantId,
      platform_id: platform.id,
      slug: m.slug,
      name: m.name,
      is_default: m.is_default,
    }));

    const { data: models, error: mErr } = await sb
      .from("models")
      .upsert(modelRows, { onConflict: "tenant_id,platform_id,slug" })
      .select();

    if (mErr) throw new Error(`Models for ${platformDef.slug}: ${mErr.message}`);

    // Set default model
    const defaultModel = (models || []).find((m: { is_default: boolean }) => m.is_default);
    if (defaultModel) {
      await sb
        .from("platforms")
        .update({ default_model_id: defaultModel.id })
        .eq("id", platform.id);
    }

    platformResults.push({ ...platform, models, default_model: defaultModel || null });
  }

  return platformResults;
}
