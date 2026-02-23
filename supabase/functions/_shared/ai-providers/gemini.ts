import type { AiAdapter, AiRequest, AiResponse } from "./types.ts";

/**
 * Gemini adapter — uses the REST generateContent endpoint.
 */
export const geminiAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return { text: null, model: req.model, tokens: null, latency_ms: 0, error: "GEMINI_API_KEY not configured" };

  const start = Date.now();

  try {
    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: req.prompt }] }],
      generationConfig: { temperature: 0.2 },
    };
    if (req.systemInstruction) {
      body.systemInstruction = { parts: [{ text: req.systemInstruction }] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const latency_ms = Date.now() - start;

    if (!res.ok) {
      const errBody = await res.text();
      return { text: null, model: req.model, tokens: null, latency_ms, raw_request: body, raw_response: errBody, error: `HTTP ${res.status}: ${errBody}` };
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const usage = data.usageMetadata;

    return {
      text: candidate?.content?.parts?.[0]?.text ?? null,
      model: req.model,
      tokens: usage ? { input: usage.promptTokenCount ?? 0, output: usage.candidatesTokenCount ?? 0 } : null,
      latency_ms,
      raw_request: body,
      raw_response: data,
    };
  } catch (err) {
    return { text: null, model: req.model, tokens: null, latency_ms: Date.now() - start, error: String(err) };
  }
};
