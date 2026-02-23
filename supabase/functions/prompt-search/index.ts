import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { executePromptMulti } from "../_shared/ai-providers/index.ts";

/**
 * Prompt Search Edge Function
 * - POST /         → execute search against tenant's active models
 * - POST /retry    → retry a specific failed answer (marks old as deleted on success)
 * - GET  /         → retrieve non-deleted answers (by promptId or topicId)
 *
 * Search uses the tenant's active entries from tenant_platform_models.
 * Each model produces its own prompt_answer row.
 */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId } = await verifyAuth(req);
    const url = new URL(req.url);
    const subPath = url.pathname.split("/prompt-search").pop() || "";

    if (req.method === "POST" && subPath.startsWith("/retry")) {
      return withCors(req, await handleRetry(req, tenantId));
    }

    switch (req.method) {
      case "POST": return withCors(req, await handleSearch(req, tenantId));
      case "GET":  return withCors(req, await handleGetAnswers(req, tenantId));
      default:     return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }
  } catch (err: unknown) {
    console.error("[prompt-search]", err);
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

/**
 * Execute search: send a prompt to all tenant's active platform+model combos.
 * Body: { prompt_id, prompt_text }
 * Models come from tenant_platform_models where is_active=true.
 */
async function handleSearch(req: Request, tenantId: string) {
  const body = await req.json();
  const { prompt_id, prompt_text } = body;

  if (!prompt_id || !prompt_text) return badRequest("prompt_id and prompt_text are required");

  const sb = createAdminClient();

  // Load tenant's active models with platform info
  const { data: tpm, error: tpmErr } = await sb
    .from("tenant_platform_models")
    .select("*, platform:platforms(id, slug, name), model:models(id, slug, name)")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (tpmErr) return serverError(tpmErr.message);
  if (!tpm || tpm.length === 0) {
    return badRequest("No active models configured. Go to Models page to add platform+model preferences.");
  }

  const searchedAt = new Date().toISOString();

  // Build platform+model pairs for execution
  const entries = tpm.map((t: { platform: { id: string; slug: string }; model: { id: string; slug: string }; platform_id: string; model_id: string }) => ({
    platformSlug: t.platform.slug,
    modelSlug: t.model.slug,
    platform_id: t.platform_id,
    model_id: t.model_id,
  }));

  // Execute prompt against all models in parallel
  const results = await executePromptMulti(
    entries.map((e) => ({ slug: e.platformSlug, model: e.modelSlug })),
    prompt_text,
  );

  // Save all results to database
  const rows = results.map((r, i) => ({
    tenant_id: tenantId,
    prompt_id,
    platform_slug: r.slug,
    platform_id: entries[i].platform_id,
    model: r.model,
    model_id: entries[i].model_id,
    answer_text: r.text,
    tokens_used: r.tokens,
    latency_ms: r.latency_ms,
    raw_request: r.raw_request ?? null,
    raw_response: r.raw_response ?? null,
    error: r.error || null,
    searched_at: searchedAt,
    deleted: false,
    web_search_enabled: r.web_search_enabled ?? false,
    annotations: r.annotations ?? null,
    sources: r.sources ?? null,
  }));

  const { data, error } = await sb
    .from("prompt_answers")
    .insert(rows)
    .select();

  if (error) {
    console.error("[prompt-search] DB insert error:", error);
    return serverError(error.message);
  }

  return ok(data);
}

/**
 * Retry a specific failed answer.
 * Body: { answer_id }
 * On success, marks the old answer as deleted.
 */
async function handleRetry(req: Request, tenantId: string) {
  const body = await req.json();
  const { answer_id } = body;

  if (!answer_id) return badRequest("answer_id is required");

  const sb = createAdminClient();

  // Load the original answer
  const { data: oldAnswer, error: oErr } = await sb
    .from("prompt_answers")
    .select("*")
    .eq("id", answer_id)
    .eq("tenant_id", tenantId)
    .single();

  if (oErr || !oldAnswer) return badRequest("Answer not found");

  // Load the prompt text
  const { data: prompt, error: pErr } = await sb
    .from("prompts")
    .select("text")
    .eq("id", oldAnswer.prompt_id)
    .single();

  if (pErr || !prompt) return badRequest("Prompt not found");

  // Execute the prompt for this single model
  const results = await executePromptMulti(
    [{ slug: oldAnswer.platform_slug, model: oldAnswer.model }],
    prompt.text,
  );

  const result = results[0];

  const searchedAt = new Date().toISOString();

  // Save the new answer
  const { data: newAnswer, error: iErr } = await sb
    .from("prompt_answers")
    .insert({
      tenant_id: tenantId,
      prompt_id: oldAnswer.prompt_id,
      platform_slug: result.slug,
      platform_id: oldAnswer.platform_id,
      model: result.model,
      model_id: oldAnswer.model_id,
      answer_text: result.text,
      tokens_used: result.tokens,
      latency_ms: result.latency_ms,
      raw_request: result.raw_request ?? null,
      raw_response: result.raw_response ?? null,
      error: result.error || null,
      searched_at: searchedAt,
      deleted: false,
      web_search_enabled: result.web_search_enabled ?? false,
      annotations: result.annotations ?? null,
      sources: result.sources ?? null,
    })
    .select()
    .single();

  if (iErr) {
    console.error("[prompt-search] retry insert error:", iErr);
    return serverError(iErr.message);
  }

  // If the new answer succeeded, mark the old one as deleted
  if (!result.error) {
    await sb
      .from("prompt_answers")
      .update({ deleted: true })
      .eq("id", answer_id);
  }

  return ok(newAnswer);
}

/**
 * Get non-deleted answers — by promptId or topicId.
 */
async function handleGetAnswers(req: Request, tenantId: string) {
  const url = new URL(req.url);
  const promptId = url.searchParams.get("promptId");
  const topicId = url.searchParams.get("topicId");

  const sb = createAdminClient();

  if (promptId) {
    const { data, error } = await sb
      .from("prompt_answers")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("prompt_id", promptId)
      .eq("deleted", false)
      .order("searched_at", { ascending: false });

    if (error) return serverError(error.message);
    return ok(data);
  }

  if (topicId) {
    const { data: prompts, error: pErr } = await sb
      .from("prompts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("topic_id", topicId);

    if (pErr) return serverError(pErr.message);

    const promptIds = (prompts || []).map((p: { id: string }) => p.id);
    if (promptIds.length === 0) return ok([]);

    const { data, error } = await sb
      .from("prompt_answers")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("prompt_id", promptIds)
      .eq("deleted", false)
      .order("searched_at", { ascending: false });

    if (error) return serverError(error.message);
    return ok(data);
  }

  return badRequest("promptId or topicId query param is required");
}
