import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { executePromptMulti } from "./ai-providers/index.ts";

const PER_PROMPT_TIMEOUT_MS = 120_000;
const MAX_RAW_BYTES = 10_000;

export interface PromptExecutionContext {
  tenantId: string;
  promptId: string;
  promptText: string;
  platformId: string;
  platformSlug: string;
  platformName: string;
  modelId: string;
  modelSlug: string;
  modelName: string;
  webSearchEnabled: boolean;
  /** ISO 3166-1 alpha-2 country code from the tenant's company */
  country?: string;
  /** ISO 639-1 language code from the tenant's company */
  language?: string;
}

export interface PromptExecutionStoredResult {
  answer: Record<string, unknown>;
  promptAnswerId: string;
  finalStatus: "completed" | "failed";
  errorMessage: string | null;
  latencyMs: number | null;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function truncateJson(value: unknown): unknown {
  if (value == null) return null;

  const serialized = JSON.stringify(value);
  if (serialized.length <= MAX_RAW_BYTES) return value;

  return {
    _truncated: true,
    byte_length: serialized.length,
    preview: serialized.slice(0, MAX_RAW_BYTES),
  };
}

function normalizeModel(modelValue: unknown): { id: string; slug: string; name: string } | null {
  if (!modelValue) return null;

  const model = Array.isArray(modelValue) ? modelValue[0] : modelValue;
  if (!model || typeof model !== "object") return null;

  const typedModel = model as Record<string, unknown>;
  if (
    typeof typedModel.id !== "string" ||
    typeof typedModel.slug !== "string" ||
    typeof typedModel.name !== "string"
  ) {
    return null;
  }

  return {
    id: typedModel.id,
    slug: typedModel.slug,
    name: typedModel.name,
  };
}

export function toPromptAnswerApiShape(row: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...row };
  const nestedModel = normalizeModel(row.model);

  if (nestedModel) {
    normalized.model = nestedModel;
    return normalized;
  }

  if (
    typeof row.model_id === "string" &&
    typeof row.model_slug === "string" &&
    typeof row.model_name === "string"
  ) {
    normalized.model = {
      id: row.model_id,
      slug: row.model_slug,
      name: row.model_name,
    };
    return normalized;
  }

  normalized.model = null;
  return normalized;
}

export async function loadPromptExecutionContext(
  db: SupabaseClient,
  tenantId: string,
  promptId: string,
  platformId: string,
  modelId: string,
): Promise<PromptExecutionContext> {
  const [{ data: prompt, error: promptError }, { data: platform, error: platformError }, { data: model, error: modelError }, { data: company }] =
    await Promise.all([
      db.from("prompts").select("id, text").eq("tenant_id", tenantId).eq("id", promptId).single(),
      db.from("platforms").select("id, slug, name").eq("id", platformId).single(),
      db.from("models").select("id, slug, name, platform_id, web_search_active").eq("id", modelId).single(),
      db.from("companies").select("country, language").eq("tenant_id", tenantId).limit(1).maybeSingle(),
    ]);

  if (promptError || !prompt) {
    throw new Error(promptError?.message || `Prompt ${promptId} not found`);
  }

  if (platformError || !platform) {
    throw new Error(platformError?.message || `Platform ${platformId} not found`);
  }

  if (modelError || !model) {
    throw new Error(modelError?.message || `Model ${modelId} not found`);
  }

  if (model.platform_id !== platformId) {
    throw new Error(`Model ${modelId} does not belong to platform ${platformId}`);
  }

  return {
    tenantId,
    promptId,
    promptText: prompt.text,
    platformId,
    platformSlug: platform.slug,
    platformName: platform.name,
    modelId,
    modelSlug: model.slug,
    modelName: model.name,
    webSearchEnabled: model.web_search_active ?? false,
    country: company?.country || undefined,
    language: company?.language || undefined,
  };
}

export async function executeAndStorePromptAnswer(
  db: SupabaseClient,
  context: PromptExecutionContext,
): Promise<PromptExecutionStoredResult> {
  const searchedAt = new Date().toISOString();

  let result:
    | {
        slug: string;
        text: string | null;
        tokens: Record<string, unknown> | null;
        latency_ms: number;
        raw_request?: unknown;
        raw_response?: unknown;
        error: string | null;
        web_search_enabled?: boolean;
        annotations?: unknown;
        sources?: unknown;
      }
    | null = null;

  try {
    const results = await Promise.race([
      executePromptMulti(
        [{
          slug: context.platformSlug,
          model: context.modelSlug,
          webSearchEnabled: context.webSearchEnabled,
        }],
        context.promptText,
        undefined,
        context.country,
        context.language,
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Prompt execution timed out")), PER_PROMPT_TIMEOUT_MS)
      ),
    ]);

    result = results[0];
  } catch (error) {
    result = {
      slug: context.platformSlug,
      text: null,
      tokens: null,
      latency_ms: 0,
      error: getErrorMessage(error),
      web_search_enabled: context.webSearchEnabled,
      annotations: null,
      sources: null,
    };
  }

  const insertRow = {
    tenant_id: context.tenantId,
    prompt_id: context.promptId,
    platform_slug: context.platformSlug,
    platform_id: context.platformId,
    model_id: context.modelId,
    answer_text: result.text,
    tokens_used: result.tokens,
    latency_ms: result.latency_ms,
    raw_request: truncateJson(result.raw_request ?? null),
    raw_response: truncateJson(result.raw_response ?? null),
    error: result.error || null,
    searched_at: searchedAt,
    deleted: false,
    web_search_enabled: result.web_search_enabled ?? context.webSearchEnabled,
    annotations: result.annotations ?? null,
    sources: result.sources ?? null,
  };

  const { data, error } = await db
    .from("prompt_answers")
    .insert(insertRow)
    .select("*, model:models!model_id(id, slug, name)")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to insert prompt answer");
  }

  return {
    answer: toPromptAnswerApiShape(data as Record<string, unknown>),
    promptAnswerId: data.id as string,
    finalStatus: result.error ? "failed" : "completed",
    errorMessage: result.error || null,
    latencyMs: result.latency_ms ?? null,
  };
}
