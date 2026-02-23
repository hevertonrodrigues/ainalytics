import type { AiAdapter, AiRequest, AiResponse } from "./types.ts";

/**
 * Grok (xAI) adapter — OpenAI-compatible /chat/completions endpoint.
 */
export const grokAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("XAI_API_KEY");
  if (!apiKey) return { text: null, model: req.model, tokens: null, latency_ms: 0, error: "XAI_API_KEY not configured" };

  const start = Date.now();

  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (req.systemInstruction) messages.push({ role: "system", content: req.systemInstruction });
    messages.push({ role: "user", content: req.prompt });

    const body = {
      model: req.model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
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
      text: data.choices?.[0]?.message?.content ?? null,
      model: data.model ?? req.model,
      tokens: data.usage ? { input: data.usage.prompt_tokens ?? 0, output: data.usage.completion_tokens ?? 0 } : null,
      latency_ms,
      raw_request: body,
      raw_response: data,
    };
  } catch (err) {
    return { text: null, model: req.model, tokens: null, latency_ms: Date.now() - start, error: String(err) };
  }
};
