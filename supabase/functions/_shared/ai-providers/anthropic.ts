import type { AiAdapter, AiRequest, AiResponse, NormalizedAnnotation } from "./types.ts";
import { buildErrorResponse, buildSuccessResponse, toSourcesArray, verifyWebSearchResults } from "./normalize.ts";

/**
 * Anthropic adapter — uses POST /v1/messages with web_search tool.
 * Web search is controlled by `req.webSearchEnabled` (from models.web_search_active).
 * If the model rejects it, retries without the tool.
 */
export const anthropicAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return buildErrorResponse(req, Date.now(), "ANTHROPIC_API_KEY not configured");

  const start = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: 16384,
      messages: [{ role: "user", content: req.prompt }],
    };
    if (req.systemInstruction) body.system = req.systemInstruction;

    // Only add web_search tool if enabled for this model
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

      return buildErrorResponse(req, start, `HTTP 400: ${errText}`, body, errText);
    }

    const latency_ms = Date.now() - start;

    if (!res!.ok) {
      const errBody = await res!.text();
      return buildErrorResponse(req, start, `HTTP ${res!.status}: ${errBody}`, body, errBody);
    }

    const data = await res!.json();

    // ── Parse text, annotations & sources from content blocks ──
    // Claude returns content as an array of blocks. Text blocks may contain
    // `citations` with type `web_search_result_location` (url, title, cited_text).
    const annotations: NormalizedAnnotation[] = [];
    const sourcesMap = new Map<string, { url: string; title: string }>();
    let answerText = "";

    // deno-lint-ignore no-explicit-any
    for (const block of (data.content ?? []) as any[]) {
      if (block.type === "text") {
        answerText += block.text ?? "";

        if (webSearchEnabled && Array.isArray(block.citations)) {
          // deno-lint-ignore no-explicit-any
          for (const cit of block.citations as any[]) {
            if (cit.type === "web_search_result_location") {
              annotations.push({
                start_index: null, // Anthropic uses cited_text instead of positions
                end_index: null,
                url: cit.url ?? "",
                title: cit.title ?? "",
                cited_text: cit.cited_text ?? "",
              });
              if (cit.url && !sourcesMap.has(cit.url)) {
                sourcesMap.set(cit.url, { url: cit.url, title: cit.title ?? "" });
              }
            }
          }
        }
      }
    }

    webSearchEnabled = verifyWebSearchResults("anthropic", req.model, webSearchEnabled, annotations, sourcesMap);

    return buildSuccessResponse({
      text: answerText || null,
      model: data.model ?? req.model,
      tokens: data.usage ? { input: data.usage.input_tokens ?? 0, output: data.usage.output_tokens ?? 0 } : null,
      latency_ms,
      raw_request: body,
      raw_response: data,
      web_search_enabled: webSearchEnabled,
      annotations,
      sources: toSourcesArray(sourcesMap),
    });
  } catch (err) {
    return buildErrorResponse(req, start, String(err));
  }
};
