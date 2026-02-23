import type { AiAdapter, AiRequest, AiResponse } from "./types.ts";

/**
 * Anthropic adapter — uses POST /v1/messages.
 */
export const anthropicAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return { text: null, model: req.model, tokens: null, latency_ms: 0, error: "ANTHROPIC_API_KEY not configured" };

  const start = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: req.prompt }],
    };
    if (req.systemInstruction) body.system = req.systemInstruction;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
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
      text: data.content?.[0]?.text ?? null,
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
