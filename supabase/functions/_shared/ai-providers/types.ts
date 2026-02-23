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
}

export interface AiResponse {
  text: string | null;
  model: string;
  tokens: { input: number; output: number } | null;
  latency_ms: number;
  raw_request?: unknown;
  raw_response?: unknown;
  error?: string;
  /** Whether web search was enabled for this request */
  web_search_enabled?: boolean;
  /** Inline url_citation annotations or "TBD" for unsupported platforms */
  annotations?: unknown;
  /** Deduplicated source URLs or "TBD" for unsupported platforms */
  sources?: unknown;
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
