import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { executePromptMulti } from "./ai-providers/index.ts";
import { logAiUsage } from "./cost-calculator.ts";

const PER_PROMPT_TIMEOUT_MS = 120_000;
const MAX_RAW_BYTES = 10_000;

/**
 * Map of common country names (lowercase) → ISO 3166-1 alpha-2 codes.
 * If the value is already a 2-letter code, it passes through directly.
 */
const COUNTRY_TO_ISO: Record<string, string> = {
  brazil: "BR", "united states": "US", usa: "US", "united kingdom": "GB",
  uk: "GB", germany: "DE", france: "FR", spain: "ES", italy: "IT",
  portugal: "PT", canada: "CA", mexico: "MX", argentina: "AR",
  colombia: "CO", chile: "CL", peru: "PE", uruguay: "UY", paraguay: "PY",
  bolivia: "BO", ecuador: "EC", venezuela: "VE",
  japan: "JP", china: "CN", india: "IN", australia: "AU",
  "south korea": "KR", korea: "KR", indonesia: "ID", thailand: "TH",
  vietnam: "VN", philippines: "PH", malaysia: "MY", singapore: "SG",
  netherlands: "NL", belgium: "BE", switzerland: "CH", austria: "AT",
  sweden: "SE", norway: "NO", denmark: "DK", finland: "FI",
  poland: "PL", ireland: "IE", "czech republic": "CZ", czechia: "CZ",
  romania: "RO", hungary: "HU", greece: "GR", turkey: "TR",
  "south africa": "ZA", nigeria: "NG", egypt: "EG", morocco: "MA",
  israel: "IL", "saudi arabia": "SA", "united arab emirates": "AE",
  uae: "AE", russia: "RU", ukraine: "UA", "new zealand": "NZ",
  "costa rica": "CR", panama: "PA", "dominican republic": "DO",
  guatemala: "GT", honduras: "HN", "el salvador": "SV", nicaragua: "NI",
  cuba: "CU", "puerto rico": "PR", taiwan: "TW", "hong kong": "HK",
};

/** Convert country name or code to ISO 3166-1 alpha-2 code, or undefined if unknown. */
function toCountryIso(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase(); // Already an ISO code
  const mapped = COUNTRY_TO_ISO[trimmed.toLowerCase()];
  if (mapped) return mapped;
  console.warn(`[prompt-execution] Unknown country name: "${trimmed}", cannot map to ISO code`);
  return undefined;
}

/** Normalize language to ISO 639-1 (2-letter), e.g. "pt-BR" → "pt" */
function toLanguageIso(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const code = raw.trim().split(/[-_]/)[0].toLowerCase();
  return code.length === 2 || code.length === 3 ? code : undefined;
}

export interface PromptExecutionContext {
  tenantId: string;
  userId?: string;
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
    country: toCountryIso(company?.country),
    language: toLanguageIso(company?.language),
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
        error?: string;
        web_search_enabled?: boolean;
        annotations?: unknown;
        sources?: unknown;
      }
    | null = null;

  try {
    const results = await Promise.race([
      executePromptMulti(
        [{ id: context.modelId, slug: context.modelSlug, platformSlug: context.platformSlug }],
        context.promptText,
        undefined,
        context.webSearchEnabled,
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

  // Log AI usage for cost tracking
  try {
    const tokens = result.tokens as { input?: number; output?: number } | null;
    await logAiUsage(db, {
      tenantId: context.tenantId,
      userId: context.userId,
      callSite: "prompt_execution",
      platformSlug: context.platformSlug,
      modelSlug: context.modelSlug,
      promptText: context.promptText,
      requestParams: {
        webSearchEnabled: context.webSearchEnabled,
        country: context.country,
        language: context.language,
      },
      rawRequest: result.raw_request,
      answerText: result.text,
      annotations: result.annotations,
      sources: result.sources,
      responseParams: { model: result.slug, web_search_enabled: result.web_search_enabled },
      rawResponse: result.raw_response,
      error: result.error,
      tokensInput: tokens?.input ?? 0,
      tokensOutput: tokens?.output ?? 0,
      latencyMs: result.latency_ms,
      webSearchEnabled: result.web_search_enabled ?? context.webSearchEnabled,
      promptAnswerId: data.id as string,
      metadata: { prompt_id: context.promptId },
    });
  } catch (logErr) {
    console.error("[prompt-execution] Failed to log AI usage (non-fatal):", logErr);
  }

  return {
    answer: toPromptAnswerApiShape(data as Record<string, unknown>),
    promptAnswerId: data.id as string,
    finalStatus: result.error ? "failed" : "completed",
    errorMessage: result.error || null,
    latencyMs: result.latency_ms ?? null,
  };
}
