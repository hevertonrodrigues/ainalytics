/**
 * Normalized types for AI provider adapters.
 * All adapters implement the same interface for consistency.
 */

export interface AiRequest {
  prompt: string;
  model: string;
  systemInstruction?: string;
}

export interface AiResponse {
  text: string | null;
  model: string;
  tokens: { input: number; output: number } | null;
  latency_ms: number;
  error?: string;
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
