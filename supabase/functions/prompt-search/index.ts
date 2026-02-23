import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { executePromptMulti } from "../_shared/ai-providers/index.ts";

/**
 * Prompt Search Edge Function
 * - POST /    → execute search: send prompt(s) to platforms, save results
 * - GET  /    → retrieve answers (by promptId or topicId)
 */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId } = await verifyAuth(req);

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
 * Execute search: send a prompt to all specified platforms.
 * Body: { prompt_id, prompt_text, platforms: [{ slug, model, platform_id }] }
 */
async function handleSearch(req: Request, tenantId: string) {
  const body = await req.json();
  const { prompt_id, prompt_text, platforms } = body;

  if (!prompt_id || !prompt_text) return badRequest("prompt_id and prompt_text are required");
  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return badRequest("platforms array is required");
  }

  const searchedAt = new Date().toISOString();

  // Execute prompt against all platforms in parallel
  const results = await executePromptMulti(
    platforms.map((p: { slug: string; model: string }) => ({ slug: p.slug, model: p.model })),
    prompt_text,
  );

  // Save all results to database
  const sb = createAdminClient();
  const rows = results.map((r, i) => ({
    tenant_id: tenantId,
    prompt_id,
    platform_slug: r.slug,
    platform_id: platforms[i].platform_id || null,
    model: r.model,
    answer_text: r.text,
    tokens_used: r.tokens,
    latency_ms: r.latency_ms,
    raw_request: r.raw_request ?? null,
    raw_response: r.raw_response ?? null,
    error: r.error || null,
    searched_at: searchedAt,
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
 * Get answers — by promptId or topicId.
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
      .order("searched_at", { ascending: false });

    if (error) return serverError(error.message);
    return ok(data);
  }

  return badRequest("promptId or topicId query param is required");
}
