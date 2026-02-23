import type { AiAdapter, AiRequest, AiResponse } from "./types.ts";

/**
 * OpenAI adapter — uses the Responses API (POST /v1/responses).
 * Web search is attempted on every request; if the model doesn't support it
 * the adapter automatically retries without the tool.
 */
export const openaiAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { text: null, model: req.model, tokens: null, latency_ms: 0, error: "OPENAI_API_KEY not configured" };

  const start = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: req.model,
      input: req.prompt,
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
    };
    if (req.systemInstruction) body.instructions = req.systemInstruction;

    let webSearchEnabled = true;

    // Retry loop: some models reject certain params (e.g. tools/web_search).
    // On 400 "not supported", remove the offending param and retry (max 3 retries).
    let res: Response | null = null;
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.status !== 400) break;

      const errText = await res.text();

      // Check if it's an "unsupported parameter" error we can auto-fix
      if (errText.includes("not supported") || errText.includes("Unsupported parameter")) {
        if (errText.includes("web_search") || errText.includes("tools") || errText.includes("include")) {
          console.warn(`[openai] web_search not supported for ${req.model}, retrying without it`);
          webSearchEnabled = false;
          delete body.tools;
          delete body.include;
          continue;
        }
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

    // ── Parse text, annotations & sources from output items ──
    // deno-lint-ignore no-explicit-any
    const annotations: Array<{ start_index: number; end_index: number; title: string; url: string }> = [];
    const sourcesMap = new Map<string, { url: string; title: string }>();
    let answerText: string | null = null;

    // deno-lint-ignore no-explicit-any
    for (const item of (data.output ?? []) as any[]) {
      // 1) Extract sources from web_search_call action items
      if (webSearchEnabled && item.type === "web_search_call" && item.action?.sources) {
        // deno-lint-ignore no-explicit-any
        for (const src of item.action.sources as any[]) {
          const url = src.url ?? "";
          if (url) sourcesMap.set(url, { url, title: src.title ?? "" });
        }
      }

      // 2) Extract text + inline url_citation annotations from message content
      if (item.type === "message" && Array.isArray(item.content)) {
        // deno-lint-ignore no-explicit-any
        for (const block of item.content as any[]) {
          if (block.type === "output_text") {
            // Extract the answer text
            if (!answerText && block.text) answerText = block.text;

            // Extract annotations
            if (webSearchEnabled && Array.isArray(block.annotations)) {
              // deno-lint-ignore no-explicit-any
              for (const ann of block.annotations as any[]) {
                if (ann.type === "url_citation") {
                  annotations.push({
                    start_index: ann.start_index,
                    end_index: ann.end_index,
                    title: ann.title ?? "",
                    url: ann.url,
                  });
                  // Also add to sources as fallback if not already present
                  if (!sourcesMap.has(ann.url)) {
                    sourcesMap.set(ann.url, { url: ann.url, title: ann.title ?? "" });
                  }
                }
              }
            }
          }
        }
      }
    }

    const sources = [...sourcesMap.values()];

    // output_text is a convenience field added by the SDK but NOT present
    // in the raw HTTP response — so we parse it from the message items above.
    const text = data.output_text ?? answerText;

    return {
      text,
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
