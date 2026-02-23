import type { AiAdapter, AiRequest, AiResponse, NormalizedAnnotation } from "./types.ts";
import { buildErrorResponse, buildSuccessResponse, toSourcesArray, verifyWebSearchResults } from "./normalize.ts";

/**
 * Grok (xAI) adapter — uses the Responses API at https://api.x.ai/v1/responses.
 *
 * Citations in xAI are returned as:
 *   - `citations` (top-level): list of all source URLs (always returned)
 *   - output items: OpenAI-style web_search_call.action.sources + url_citation annotations
 *
 * Web search is controlled by `req.webSearchEnabled` (from models.web_search_active).
 * If the model doesn't support web_search, retries without it.
 */
export const grokAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("XAI_API_KEY");
  if (!apiKey) return buildErrorResponse(req, Date.now(), "XAI_API_KEY not configured");

  const start = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: req.model,
      input: [{ role: "user", content: req.prompt }],
    };
    if (req.systemInstruction) body.instructions = req.systemInstruction;

    // Only add web_search tool if enabled for this model
    let webSearchEnabled = req.webSearchEnabled !== false;
    if (webSearchEnabled) {
      body.tools = [{ type: "web_search" }];
      body.tool_choice = "required";
    }

    // Retry loop: some models may reject web_search tool
    let res: Response | null = null;
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      res = await fetch("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.status !== 400) break;

      const errText = await res.text();
      console.warn(`[grok] HTTP 400 on attempt ${attempt}: ${errText}`);

      const isUnsupported = errText.includes("not supported") || errText.includes("Unsupported parameter");
      const mentionsWebSearch = errText.includes("web_search");
      if (isUnsupported && mentionsWebSearch) {
        console.warn(`[grok] web_search not supported for ${req.model}, retrying without it`);
        webSearchEnabled = false;
        delete body.tools;
        delete body.tool_choice;
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

    // ── Parse text from output items ──
    let answerText: string | null = null;
    // deno-lint-ignore no-explicit-any
    for (const item of (data.output ?? []) as any[]) {
      if (item.type === "message" && Array.isArray(item.content)) {
        // deno-lint-ignore no-explicit-any
        for (const block of item.content as any[]) {
          if (block.type === "output_text" && block.text) {
            answerText = block.text;
            break;
          }
        }
        if (answerText) break;
      }
    }

    const text = data.output_text ?? answerText;

    // ── Parse citations & sources ──
    const annotations: NormalizedAnnotation[] = [];
    const sourcesMap = new Map<string, { url: string; title: string }>();

    if (webSearchEnabled) {
      // 1) Top-level citations: array of URL strings (always returned by xAI)
      if (Array.isArray(data.citations)) {
        for (const url of data.citations as string[]) {
          if (url && typeof url === "string") {
            sourcesMap.set(url, { url, title: "" });
          }
        }
      }

      // 2) Output items: web_search_call sources + url_citation annotations
      // deno-lint-ignore no-explicit-any
      for (const item of (data.output ?? []) as any[]) {
        if (item.type === "web_search_call" && item.action?.sources) {
          // deno-lint-ignore no-explicit-any
          for (const src of item.action.sources as any[]) {
            const url = src.url ?? "";
            if (url && !sourcesMap.has(url)) sourcesMap.set(url, { url, title: src.title ?? "" });
          }
        }
        if (item.type === "message" && Array.isArray(item.content)) {
          // deno-lint-ignore no-explicit-any
          for (const block of item.content as any[]) {
            if (block.type === "output_text" && Array.isArray(block.annotations)) {
              // deno-lint-ignore no-explicit-any
              for (const ann of block.annotations as any[]) {
                if (ann.type === "url_citation") {
                  annotations.push({
                    start_index: ann.start_index ?? null,
                    end_index: ann.end_index ?? null,
                    url: ann.url ?? "",
                    title: ann.title ?? "",
                    cited_text: "",
                  });
                  if (ann.url && !sourcesMap.has(ann.url)) {
                    sourcesMap.set(ann.url, { url: ann.url, title: ann.title ?? "" });
                  }
                }
              }
            }
          }
        }
      }
    }

    webSearchEnabled = verifyWebSearchResults("grok", req.model, webSearchEnabled, annotations, sourcesMap);

    return buildSuccessResponse({
      text,
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
