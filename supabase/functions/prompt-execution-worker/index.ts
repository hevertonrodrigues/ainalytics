import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { badRequest, ok, serverError, unauthorized } from "../_shared/response.ts";
import {
  executeAndStorePromptAnswer,
  getErrorMessage,
  loadPromptExecutionContext,
} from "../_shared/prompt-execution.ts";

interface WorkerBody {
  run_id?: string;
  dispatch_token?: string;
}

interface StartedRun {
  id: string;
  tenant_id: string;
  prompt_id: string;
  platform_id: string;
  model_id: string;
  trigger_source?: string;
}

function getRpcRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    if (req.method !== "POST") {
      return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }

    const cronSecret = Deno.env.get("CRON_SECRET");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("authorization") || "";
    const incomingSecret = req.headers.get("x-cron-secret") || "";

    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    const isCronAuth = !!cronSecret && incomingSecret === cronSecret;

    if (!isServiceRole && !isCronAuth) {
      return withCors(req, unauthorized("Invalid authorization"));
    }

    const body = (await req.json()) as WorkerBody;
    if (!body.run_id || !body.dispatch_token) {
      return withCors(req, badRequest("run_id and dispatch_token are required"));
    }

    const db = createAdminClient();
    const { data: startedRunData, error: startError } = await db.rpc("start_prompt_execution_run", {
      p_run_id: body.run_id,
      p_dispatch_token: body.dispatch_token,
    });

    const startedRun = getRpcRow(startedRunData as StartedRun | StartedRun[] | null);

    if (startError || !startedRun) {
      return withCors(req, badRequest(startError?.message || "Run not claimable"));
    }

    try {
      const context = await loadPromptExecutionContext(
        db,
        startedRun.tenant_id,
        startedRun.prompt_id,
        startedRun.platform_id,
        startedRun.model_id,
      );

      const outcome = await executeAndStorePromptAnswer(db, context);
      const shouldRetry = outcome.finalStatus === "failed" && startedRun.trigger_source === "scheduled";

      const { error: finalizeError } = await db.rpc("finalize_prompt_execution_run", {
        p_run_id: startedRun.id,
        p_prompt_answer_id: outcome.promptAnswerId,
        p_final_status: outcome.finalStatus,
        p_error_class: outcome.finalStatus === "failed" ? "provider_error" : null,
        p_error_message: outcome.errorMessage,
        p_provider_http_status: null,
        p_provider_request_id: null,
        p_retryable: shouldRetry,
      });

      if (finalizeError) {
        throw new Error(finalizeError.message);
      }

      return withCors(req, ok({
        run_id: startedRun.id,
        prompt_answer_id: outcome.promptAnswerId,
        status: outcome.finalStatus,
        retry_scheduled: shouldRetry && outcome.finalStatus === "failed",
        latency_ms: outcome.latencyMs,
      }));
    } catch (error) {
      const message = getErrorMessage(error);

      const { error: finalizeError } = await db.rpc("finalize_prompt_execution_run", {
        p_run_id: startedRun.id,
        p_prompt_answer_id: null,
        p_final_status: "failed",
        p_error_class: "execution_error",
        p_error_message: message,
        p_provider_http_status: null,
        p_provider_request_id: null,
        p_retryable: false,
      });

      if (finalizeError) {
        console.error("[prompt-execution-worker] finalize failed:", finalizeError);
      }

      throw error;
    }
  } catch (error) {
    console.error("[prompt-execution-worker]", error);
    return withCors(req, serverError(getErrorMessage(error)));
  }
});
