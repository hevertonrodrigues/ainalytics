import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { ok, badRequest, serverError, unauthorized } from "../_shared/response.ts";
import { executePromptMulti } from "../_shared/ai-providers/index.ts";

/**
 * Prompt Search Worker Edge Function
 *
 * Invoked by pg_cron (via pg_net) or manually. Processes a batch of
 * pending items from the prompt_execution_queue, executing each prompt
 * against its assigned model ONE BY ONE to avoid overloading LLM APIs.
 *
 * Authentication: Uses a shared CRON_SECRET header to authorize invocations.
 *
 * Flow:
 * 1. Call checkout_prompt_executions(batch_size) RPC to atomically claim jobs
 * 2. For each job: load prompt text, model/platform slugs, execute, save result
 * 3. Mark each job as completed or failed
 */

const BATCH_SIZE = 5;
const PER_PROMPT_TIMEOUT_MS = 120_000; // 2 minutes per prompt execution

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    // ── Auth: verify cron secret or service-role key ──────────
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("authorization") || "";
    const incomingSecret = req.headers.get("x-cron-secret") || "";

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    const isCronAuth = cronSecret && incomingSecret === cronSecret;

    if (!isServiceRole && !isCronAuth) {
      return withCors(req, unauthorized("Invalid authorization"));
    }

    const sb = createAdminClient();

    // ── Step 0: Reset any stuck processing jobs ──────────────
    const { data: resetCount } = await sb.rpc("reset_stuck_prompt_executions");
    if (resetCount && resetCount > 0) {
      console.log(`[prompt-search-worker] Reset ${resetCount} stuck jobs`);
    }

    // ── Step 1: Checkout a batch of pending jobs ─────────────
    const { data: jobs, error: checkoutErr } = await sb.rpc(
      "checkout_prompt_executions",
      { batch_size: BATCH_SIZE }
    );

    if (checkoutErr) {
      console.error("[prompt-search-worker] Checkout error:", checkoutErr);
      return withCors(req, serverError(checkoutErr.message));
    }

    if (!jobs || jobs.length === 0) {
      return withCors(req, ok({ message: "No pending jobs", processed: 0 }));
    }

    console.log(`[prompt-search-worker] Found ${jobs.length} jobs. Proceeding in background...`);

    // ── Step 2: Process jobs ONE BY ONE in the background ───
    const backgroundTask = async () => {
      let processed = 0;
      let failed = 0;

      for (const job of jobs) {
        try {
          await processJob(sb, job);
          processed++;
        } catch (err) {
          failed++;
          console.error(`[prompt-search-worker] Job ${job.id} failed:`, err);
          
          const isTimeout = err instanceof Error && err.message.includes("timed out");
          const finalStatus = job.attempts < 3 ? "pending" : "failed";

          await sb.rpc("complete_prompt_execution", {
            p_queue_id: job.id,
            p_status: finalStatus,
            p_error_message: err instanceof Error ? err.message : String(err),
          });
        }
      }
      console.log(`[prompt-search-worker] Background batch complete. Processed: ${processed}, Failed: ${failed}`);
    };

    // Use EdgeRuntime.waitUntil if available (Supabase/Deno standard for background tasks)
    // or simply don't await the promise.
    if (typeof (globalThis as any).EdgeRuntime !== 'undefined' && typeof (globalThis as any).EdgeRuntime.waitUntil === 'function') {
        (globalThis as any).EdgeRuntime.waitUntil(backgroundTask());
    } else {
        // Fallback for local/older environments: Just fire and forget
        backgroundTask().catch(e => console.error("[prompt-search-worker] Background task error:", e));
    }

    return withCors(
      req,
      ok({
        message: `Batch started in background`,
        total: jobs.length,
      })
    );
  } catch (err: unknown) {
    console.error("[prompt-search-worker] Fatal error:", err);
    const e = err as { message?: string };
    return withCors(req, serverError(e.message || "Internal server error"));
  }
});

/**
 * Process a single queue job:
 * 1. Load prompt text
 * 2. Load model + platform slugs
 * 3. Execute prompt with timeout
 * 4. Save result to prompt_answers
 * 5. Mark queue item as completed
 */
async function processJob(
  sb: ReturnType<typeof createAdminClient>,
  job: {
    id: string;
    tenant_id: string;
    prompt_id: string;
    platform_id: string;
    model_id: string;
    attempts: number;
  }
) {
  // ── Load prompt text ───────────────────────────────────────
  const { data: prompt, error: pErr } = await sb
    .from("prompts")
    .select("text")
    .eq("id", job.prompt_id)
    .eq("tenant_id", job.tenant_id)
    .single();

  if (pErr || !prompt) {
    throw new Error(`Prompt ${job.prompt_id} not found: ${pErr?.message}`);
  }

  // ── Load platform slug ────────────────────────────────────
  const { data: platform, error: platErr } = await sb
    .from("platforms")
    .select("slug")
    .eq("id", job.platform_id)
    .single();

  if (platErr || !platform) {
    throw new Error(`Platform ${job.platform_id} not found: ${platErr?.message}`);
  }

  // ── Load model slug + web_search_active ───────────────────
  const { data: model, error: modErr } = await sb
    .from("models")
    .select("slug, web_search_active")
    .eq("id", job.model_id)
    .single();

  if (modErr || !model) {
    throw new Error(`Model ${job.model_id} not found: ${modErr?.message}`);
  }

  // ── Execute prompt with timeout ───────────────────────────
  const searchedAt = new Date().toISOString();

  const results = await Promise.race([
    executePromptMulti(
      [{ slug: platform.slug, model: model.slug, webSearchEnabled: model.web_search_active ?? false }],
      prompt.text,
    ),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Prompt execution timed out")), PER_PROMPT_TIMEOUT_MS)
    ),
  ]);

  const result = results[0];

  // ── Save to prompt_answers ────────────────────────────────
  const row = {
    tenant_id: job.tenant_id,
    prompt_id: job.prompt_id,
    platform_slug: platform.slug,
    platform_id: job.platform_id,
    model_id: job.model_id,
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
  };

  const { error: insertErr } = await sb
    .from("prompt_answers")
    .insert(row);

  if (insertErr) {
    throw new Error(`DB insert failed: ${insertErr.message}`);
  }

  // ── Mark queue item as completed ──────────────────────────
  let finalStatus = "completed";
  if (result.error) {
    // Retry up to 3 times
    finalStatus = job.attempts < 3 ? "pending" : "failed";
  }

  await sb.rpc("complete_prompt_execution", {
    p_queue_id: job.id,
    p_status: finalStatus,
    p_error_message: result.error || null,
  });

  console.log(
    `[prompt-search-worker] Job ${job.id} → ${finalStatus} (Attempts: ${job.attempts}, ${platform.slug}/${model.slug}, ${result.latency_ms}ms)`
  );
}
