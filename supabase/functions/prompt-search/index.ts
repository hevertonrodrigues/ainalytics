import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { badRequest, ok, serverError } from "../_shared/response.ts";
import { createRequestLogger } from "../_shared/logger.ts";
import {
  executeAndStorePromptAnswer,
  getErrorMessage,
  loadPromptExecutionContext,
  toPromptAnswerApiShape,
  type PromptExecutionContext,
} from "../_shared/prompt-execution.ts";

interface ActiveSubscription {
  subscription_id: string;
  plan_id: string;
  cadence_unit: string;
  cadence_value: number;
}

interface PromptRecord {
  id: string;
  text: string;
  is_active: boolean;
}

interface TargetRecord {
  id: string;
  tenant_id: string;
  prompt_id: string;
  platform_id: string;
  model_id: string;
  subscription_id: string | null;
  plan_id: string | null;
}

interface RunRecord {
  id: string;
  target_id: string;
}

interface TenantModelRecord {
  platform_id: string;
  model_id: string;
  platform: { id: string; slug: string; name: string } | null;
  model: { id: string; slug: string; name: string; web_search_active?: boolean } | null;
}

interface RetryAnswerRecord {
  id: string;
  prompt_id: string;
  platform_id: string | null;
  model_id: string | null;
}

function getRpcRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function getTargetKey(promptId: string, platformId: string, modelId: string): string {
  return `${promptId}:${platformId}:${modelId}`;
}

async function requireSuperAdmin(userId: string, tenantId: string): Promise<void> {
  const db = createAdminClient();
  const { data, error } = await db
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
    throw { status: 403, message: "Only superadmins can execute searches" };
  }
}

async function getActiveSubscription(
  tenantId: string,
): Promise<{ response: Response | null; subscription: ActiveSubscription | null }> {
  const db = createAdminClient();

  // Direct query instead of db.rpc("get_tenant_active_prompt_subscription")
  const { data, error } = await db
    .from("subscriptions")
    .select("id, plan_id, plans!inner(prompt_refresh_unit, prompt_refresh_value)")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return {
        response: badRequest("An active subscription is required to execute prompt searches"),
        subscription: null,
      };
    }
    return { response: serverError(error.message), subscription: null };
  }

  // deno-lint-ignore no-explicit-any
  const plan = (data as any).plans;
  const subscription: ActiveSubscription = {
    subscription_id: data.id,
    plan_id: data.plan_id,
    cadence_unit: plan?.prompt_refresh_unit || "week",
    cadence_value: plan?.prompt_refresh_value || 1,
  };

  return { response: null, subscription };
}

async function ensurePromptTarget(
  tenantId: string,
  promptId: string,
  platformId: string,
  modelId: string,
): Promise<TargetRecord> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("ensure_prompt_execution_target", {
    p_tenant_id: tenantId,
    p_prompt_id: promptId,
    p_platform_id: platformId,
    p_model_id: modelId,
  });

  const target = getRpcRow(data as TargetRecord | TargetRecord[] | null);
  if (error || !target) {
    throw new Error(error?.message || "Failed to create prompt execution target");
  }

  return target;
}

async function createProcessingRun(
  target: TargetRecord,
  triggerSource: "manual" | "retry",
): Promise<RunRecord> {
  const db = createAdminClient();
  const startedAt = new Date().toISOString();

  const { data, error } = await db
    .from("prompt_execution_runs")
    .insert({
      tenant_id: target.tenant_id,
      target_id: target.id,
      prompt_id: target.prompt_id,
      platform_id: target.platform_id,
      model_id: target.model_id,
      subscription_id: target.subscription_id,
      plan_id: target.plan_id,
      trigger_source: triggerSource,
      scheduled_for: startedAt,
      status: "processing",
      attempt_count: 1,
      max_attempts: 1,
      available_at: startedAt,
      started_at: startedAt,
    })
    .select("id, target_id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("A prompt execution is already in progress for one of the selected targets");
    }
    throw new Error(error?.message || "Failed to create prompt execution run");
  }

  return data as RunRecord;
}

async function finalizeInteractiveRun(
  runId: string,
  context: PromptExecutionContext,
): Promise<Record<string, unknown> | null> {
  const db = createAdminClient();

  try {
    const outcome = await executeAndStorePromptAnswer(db, context);
    const { error: finalizeError } = await db.rpc("finalize_prompt_execution_run", {
      p_run_id: runId,
      p_prompt_answer_id: outcome.promptAnswerId,
      p_final_status: outcome.finalStatus,
      p_error_class: outcome.finalStatus === "failed" ? "provider_error" : null,
      p_error_message: outcome.errorMessage,
      p_provider_http_status: null,
      p_provider_request_id: null,
      p_retryable: false,
    });

    if (finalizeError) {
      console.error("[prompt-search] finalize interactive run failed:", finalizeError);
    }

    return outcome.answer;
  } catch (error) {
    const message = getErrorMessage(error);

    const { error: finalizeError } = await db.rpc("finalize_prompt_execution_run", {
      p_run_id: runId,
      p_prompt_answer_id: null,
      p_final_status: "failed",
      p_error_class: "execution_error",
      p_error_message: message,
      p_provider_http_status: null,
      p_provider_request_id: null,
      p_retryable: false,
    });

    if (finalizeError) {
      console.error("[prompt-search] finalize failed after execution error:", finalizeError);
    }

    console.error("[prompt-search] interactive execution failed:", error);
    return null;
  }
}

serve(async (req: Request) => {
  const logger = createRequestLogger("prompt-search", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { tenant_id?: string; user_id?: string } = {};
  try {
    const { tenantId, user } = await verifyAuth(req);
    authCtx = { tenant_id: tenantId, user_id: user.id };
    const url = new URL(req.url);
    const subPath = url.pathname.split("/prompt-search").pop() || "";

    if (req.method === "POST") {
      await requireSuperAdmin(user.id, tenantId);
    }

    if (req.method === "POST" && subPath.startsWith("/retry")) {
      return logger.done(withCors(req, await handleRetry(tenantId, user.id, req)), authCtx);
    }

    switch (req.method) {
      case "POST":
        return logger.done(withCors(req, await handleSearch(tenantId, user.id, req)), authCtx);
      case "GET":
        return logger.done(withCors(req, await handleGetAnswers(tenantId, req)), authCtx);
      default:
        return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
    }
  } catch (error: unknown) {
    console.error("[prompt-search]", error);
    const err = error as { status?: number; message?: string };
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
      ), authCtx);
    }
    return logger.done(withCors(req, serverError(getErrorMessage(error))), authCtx);
  }
});

async function handleSearch(tenantId: string, userId: string, req: Request): Promise<Response> {
  const body = await req.json();
  const promptId = typeof body.prompt_id === "string" ? body.prompt_id : "";

  if (!promptId) {
    return badRequest("prompt_id is required");
  }

  const { response: subscriptionError } = await getActiveSubscription(tenantId);
  if (subscriptionError) return subscriptionError;

  const db = createAdminClient();
  const { data: prompt, error: promptError } = await db
    .from("prompts")
    .select("id, text, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", promptId)
    .single();

  if (promptError || !prompt) {
    return badRequest("Prompt not found");
  }

  const typedPrompt = prompt as PromptRecord;
  if (!typedPrompt.is_active) {
    return badRequest("Inactive prompts cannot be executed");
  }

  const { data: activeModels, error: modelError } = await db
    .from("tenant_platform_models")
    .select("platform_id, model_id, platform:platforms(id, slug, name), model:models(id, slug, name, web_search_active)")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (modelError) {
    return serverError(modelError.message);
  }

  const contexts: PromptExecutionContext[] = ((activeModels || []) as TenantModelRecord[])
    .filter((entry) => entry.platform && entry.model)
    .map((entry) => ({
      tenantId,
      userId,
      promptId: typedPrompt.id,
      promptText: typedPrompt.text,
      platformId: entry.platform_id,
      platformSlug: entry.platform!.slug,
      platformName: entry.platform!.name,
      modelId: entry.model_id,
      modelSlug: entry.model!.slug,
      modelName: entry.model!.name,
      webSearchEnabled: entry.model?.web_search_active ?? false,
    }));

  if (contexts.length === 0) {
    return badRequest("No active models configured. Go to Models page to add platform and model preferences.");
  }

  const targets = await Promise.all(
    contexts.map((context) =>
      ensurePromptTarget(tenantId, context.promptId, context.platformId, context.modelId)
    ),
  );

  const runs = await Promise.all(targets.map((target) => createProcessingRun(target, "manual")));
  const runByTargetId = new Map(runs.map((run) => [run.target_id, run]));
  const targetByKey = new Map(
    targets.map((target) => [getTargetKey(target.prompt_id, target.platform_id, target.model_id), target]),
  );

  const answers = await Promise.all(
    contexts.map(async (context) => {
      const target = targetByKey.get(getTargetKey(context.promptId, context.platformId, context.modelId));
      const run = target ? runByTargetId.get(target.id) : null;

      if (!run) {
        console.error("[prompt-search] Missing run for target", context.promptId, context.platformSlug, context.modelSlug);
        return null;
      }

      return finalizeInteractiveRun(run.id, context);
    }),
  );

  const filtered = answers.filter(Boolean) as Record<string, unknown>[];
  if (filtered.length === 0) {
    return serverError("No prompt answers could be stored");
  }

  filtered.sort((a, b) => {
    const aTime = typeof a.created_at === "string" ? new Date(a.created_at).getTime() : 0;
    const bTime = typeof b.created_at === "string" ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

  return ok(filtered);
}

async function handleRetry(tenantId: string, userId: string, req: Request): Promise<Response> {
  const body = await req.json();
  const answerId = typeof body.answer_id === "string" ? body.answer_id : "";

  if (!answerId) {
    return badRequest("answer_id is required");
  }

  const { response: subscriptionError } = await getActiveSubscription(tenantId);
  if (subscriptionError) return subscriptionError;

  const db = createAdminClient();
  const { data: oldAnswer, error: answerError } = await db
    .from("prompt_answers")
    .select("id, prompt_id, platform_id, model_id")
    .eq("tenant_id", tenantId)
    .eq("id", answerId)
    .single();

  if (answerError || !oldAnswer) {
    return badRequest("Answer not found");
  }

  const typedAnswer = oldAnswer as RetryAnswerRecord;
  if (!typedAnswer.platform_id || !typedAnswer.model_id) {
    return badRequest("The selected answer is missing platform or model data");
  }

  let context: PromptExecutionContext;
  try {
    context = await loadPromptExecutionContext(
      db,
      tenantId,
      typedAnswer.prompt_id,
      typedAnswer.platform_id,
      typedAnswer.model_id,
    );
    context.userId = userId;
  } catch (error) {
    return badRequest(getErrorMessage(error));
  }

  let target: TargetRecord;
  let run: RunRecord;

  try {
    target = await ensurePromptTarget(
      tenantId,
      context.promptId,
      context.platformId,
      context.modelId,
    );
    run = await createProcessingRun(target, "retry");
  } catch (error) {
    return serverError(getErrorMessage(error));
  }

  const answer = await finalizeInteractiveRun(run.id, context);
  if (!answer) {
    return serverError("Retry failed before a prompt answer could be stored");
  }

  return ok(answer);
}

async function handleGetAnswers(tenantId: string, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const promptId = url.searchParams.get("promptId");
  const topicId = url.searchParams.get("topicId");
  const db = createAdminClient();

  if (promptId) {
    const { data, error } = await db
      .from("prompt_answers")
      .select("*, model:models!model_id(id, slug, name)")
      .eq("tenant_id", tenantId)
      .eq("prompt_id", promptId)
      .eq("deleted", false)
      .order("searched_at", { ascending: false });

    if (error) return serverError(error.message);
    return ok((data || []).map((row) => toPromptAnswerApiShape(row as Record<string, unknown>)));
  }

  if (topicId) {
    const { data: prompts, error: promptError } = await db
      .from("prompts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("topic_id", topicId);

    if (promptError) return serverError(promptError.message);

    const promptIds = (prompts || []).map((prompt: { id: string }) => prompt.id);
    if (promptIds.length === 0) return ok([]);

    const { data, error } = await db
      .from("prompt_answers")
      .select("*, model:models!model_id(id, slug, name)")
      .eq("tenant_id", tenantId)
      .in("prompt_id", promptIds)
      .eq("deleted", false)
      .order("searched_at", { ascending: false });

    if (error) return serverError(error.message);
    return ok((data || []).map((row) => toPromptAnswerApiShape(row as Record<string, unknown>)));
  }

  return badRequest("promptId or topicId query parameter is required");
}
