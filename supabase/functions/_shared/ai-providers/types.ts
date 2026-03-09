/**
 * Normalized types for AI provider adapters.
 * All adapters implement the same interface for consistency.
 */

export interface AiRequest {
  prompt: string;
  model: string;
  systemInstruction?: string;
  /** Whether web search should be enabled for this request (from models.web_search_active) */
  webSearchEnabled?: boolean;
  /** ISO 3166-1 alpha-2 country code (e.g., "BR", "US") for localizing web search results */
  country?: string;
  /** ISO 639-1 language code (e.g., "pt", "en", "es") for filtering search language */
  language?: string;
}

/** A single citation annotation linking text range to a source URL. */
export interface NormalizedAnnotation {
  /** Character start position in the answer text (0-based). Null if not available (e.g. Anthropic). */
  start_index: number | null;
  /** Character end position in the answer text (exclusive). Null if not available. */
  end_index: number | null;
  /** Source URL */
  url: string;
  /** Page/source title */
  title: string;
  /** Cited snippet from the source (Anthropic-specific, empty string otherwise) */
  cited_text: string;
}

/** A deduplicated source URL reference. */
export interface NormalizedSource {
  url: string;
  title: string;
}

export interface AiResponse {
  text: string | null;
  model: string;
  tokens: { input: number; output: number } | null;
  latency_ms: number;
  raw_request?: unknown;
  raw_response?: unknown;
  error?: string;
  /** Whether web search was actually used for this request */
  web_search_enabled: boolean;
  /** Inline citation annotations, null if none */
  annotations: NormalizedAnnotation[] | null;
  /** Deduplicated source URLs, null if none */
  sources: NormalizedSource[] | null;
}

/**
 * Every AI provider adapter must implement this function signature.
 */
export type AiAdapter = (req: AiRequest) => Promise<AiResponse>;

/**
 * Platform registry entry — maps slug to adapter + env var name.
 */
export interface PlatformRegistryEntry {
  slug: string;
  adapter: AiAdapter;
  envVar: string;
}
