import type { AiAdapter, AiRequest, AiResponse } from "./types.ts";

/**
 * Anthropic adapter — uses POST /v1/messages with web_search tool.
 * Web search is attempted on every request; if the model rejects it,
 * the adapter automatically retries without the tool.
 */
export const anthropicAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return { text: null, model: req.model, tokens: null, latency_ms: 0, error: "ANTHROPIC_API_KEY not configured" };

  const start = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: 16384,
      messages: [{ role: "user", content: req.prompt }],
    };
    if (req.systemInstruction) body.system = req.systemInstruction;

    // Only add web_search tool if web search is enabled for this model
    let webSearchEnabled = req.webSearchEnabled !== false;
    if (webSearchEnabled) {
      body.tools = [{ type: "web_search_20250305", name: "web_search" }];
    }

    // Retry loop: some models may reject web_search tool
    let res: Response | null = null;
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.status !== 400) break;

      const errText = await res.text();

      if (errText.includes("web_search") || errText.includes("tool") || errText.includes("not supported")) {
        console.warn(`[anthropic] web_search not supported for ${req.model}, retrying without it`);
        webSearchEnabled = false;
        delete body.tools;
        continue;
      }

      // Non-recoverable 400 error
      const latency_ms = Date.now() - start;
      return { text: null, model: req.model, tokens: null, latency_ms, raw_request: body, raw_response: errText, error: `HTTP 400: ${errText}` };
    }

    const latency_ms = Date.now() - start;

    if (!res!.ok) {
      const errBody = await res!.text();
      return { text: null, model: req.model, tokens: null, latency_ms, raw_request: body, raw_response: errBody, error: `HTTP ${res!.status}: ${errBody}` };
    }

    const data = await res!.json();

    // ── Parse text, annotations & sources from content blocks ──
    // Claude returns content as an array of blocks. Text blocks may contain
    // `citations` with type `web_search_result_location` (url, title, cited_text).
    // deno-lint-ignore no-explicit-any
    const annotations: Array<{ cited_text: string; title: string; url: string }> = [];
    const sourcesMap = new Map<string, { url: string; title: string }>();
    let answerText = "";

    // deno-lint-ignore no-explicit-any
    for (const block of (data.content ?? []) as any[]) {
      if (block.type === "text") {
        answerText += block.text ?? "";

        // Parse web search citations
        if (webSearchEnabled && Array.isArray(block.citations)) {
          // deno-lint-ignore no-explicit-any
          for (const cit of block.citations as any[]) {
            if (cit.type === "web_search_result_location") {
              annotations.push({
                cited_text: cit.cited_text ?? "",
                title: cit.title ?? "",
                url: cit.url ?? "",
              });
              if (cit.url && !sourcesMap.has(cit.url)) {
                sourcesMap.set(cit.url, { url: cit.url, title: cit.title ?? "" });
              }
            }
          }
        }
      }
    }

    // ── Post-response verification ──
    // If web search was enabled but no citations/sources were returned,
    // the model silently ignored the search tool
    if (webSearchEnabled && annotations.length === 0 && sourcesMap.size === 0) {
      console.warn(`[anthropic] web search was enabled but no citations returned for ${req.model} — marking web_search_enabled as false`);
      webSearchEnabled = false;
    }

    const sources = [...sourcesMap.values()];

    return {
      text: answerText || null,
      model: data.model ?? req.model,
      tokens: data.usage ? { input: data.usage.input_tokens ?? 0, output: data.usage.output_tokens ?? 0 } : null,
      latency_ms,
      raw_request: body,
      raw_response: data,
      web_search_enabled: webSearchEnabled,
      annotations: annotations.length > 0 ? annotations : null,
      sources: sources.length > 0 ? sources : null,
    };
  } catch (err) {
    return { text: null, model: req.model, tokens: null, latency_ms: Date.now() - start, error: String(err) };
  }
};
