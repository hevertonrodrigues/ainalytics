import type { AiAdapter, AiRequest, AiResponse } from "./types.ts";

/**
 * Perplexity adapter — uses the Agent API (POST /responses).
 */
export const perplexityAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!apiKey) return { text: null, model: req.model, tokens: null, latency_ms: 0, error: "PERPLEXITY_API_KEY not configured" };

  const start = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: req.model,
      input: req.prompt,
      stream: false,
    };

    const res = await fetch("https://api.perplexity.ai/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const latency_ms = Date.now() - start;

    if (!res.ok) {
      const errBody = await res.text();
      return { text: null, model: req.model, tokens: null, latency_ms, raw_request: body, raw_response: errBody, error: `HTTP ${res.status}: ${errBody}` };
    }

    const data = await res.json();

    return {
      text: data.output_text ?? null,
      model: data.model ?? req.model,
      tokens: data.usage ? { input: data.usage.input_tokens ?? 0, output: data.usage.output_tokens ?? 0 } : null,
      latency_ms,
      raw_request: body,
      raw_response: data,
      web_search_enabled: false,
      annotations: "TBD",
      sources: "TBD",
    };
  } catch (err) {
    return { text: null, model: req.model, tokens: null, latency_ms: Date.now() - start, error: String(err) };
  }
};
