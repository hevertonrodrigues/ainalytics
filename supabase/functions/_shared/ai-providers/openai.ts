import type { AiAdapter, AiRequest, AiResponse, NormalizedAnnotation } from "./types.ts";
import { buildErrorResponse, buildSuccessResponse, toSourcesArray, verifyWebSearchResults } from "./normalize.ts";

/**
 * OpenAI adapter — uses the Responses API (POST /v1/responses).
 * Web search is controlled by `req.webSearchEnabled` (from models.web_search_active).
 * If the model doesn't support it, retries without the tool.
 */
export const openaiAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return buildErrorResponse(req, Date.now(), "OPENAI_API_KEY not configured");

  const start = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: req.model,
      input: req.prompt,
    };
    if (req.systemInstruction) body.instructions = req.systemInstruction;

    // Only add web_search tool if enabled for this model
    let webSearchEnabled = req.webSearchEnabled !== false;
    if (webSearchEnabled) {
      body.tools = [{ type: "web_search" }];
      body.tool_choice = "required";
      body.include = ["web_search_call.action.sources"];
    }

    // Retry loop: some models reject certain params (e.g. tools/web_search).
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

      if (errText.includes("not supported") || errText.includes("Unsupported parameter")) {
        if (errText.includes("web_search") || errText.includes("tools") || errText.includes("include")) {
          console.warn(`[openai] web_search not supported for ${req.model}, retrying without it`);
          webSearchEnabled = false;
          delete body.tools;
          delete body.tool_choice;
          delete body.include;
          continue;
        }
      }

      return buildErrorResponse(req, start, `HTTP 400: ${errText}`, body, errText);
    }

    const latency_ms = Date.now() - start;

    if (!res!.ok) {
      const errBody = await res!.text();
      return buildErrorResponse(req, start, `HTTP ${res!.status}: ${errBody}`, body, errBody);
    }

    const data = await res!.json();

    // ── Parse text, annotations & sources from output items ──
    const annotations: NormalizedAnnotation[] = [];
    const sourcesMap = new Map<string, { url: string; title: string }>();
    let answerText: string | null = null;

    // deno-lint-ignore no-explicit-any
    for (const item of (data.output ?? []) as any[]) {
      // Sources from web_search_call action items
      if (webSearchEnabled && item.type === "web_search_call" && item.action?.sources) {
        // deno-lint-ignore no-explicit-any
        for (const src of item.action.sources as any[]) {
          const url = src.url ?? "";
          if (url) sourcesMap.set(url, { url, title: src.title ?? "" });
        }
      }

      // Text + inline url_citation annotations from message content
      if (item.type === "message" && Array.isArray(item.content)) {
        // deno-lint-ignore no-explicit-any
        for (const block of item.content as any[]) {
          if (block.type === "output_text") {
            if (!answerText && block.text) answerText = block.text;

            if (webSearchEnabled && Array.isArray(block.annotations)) {
              // deno-lint-ignore no-explicit-any
              for (const ann of block.annotations as any[]) {
                if (ann.type === "url_citation") {
                  annotations.push({
                    start_index: ann.start_index ?? null,
                    end_index: ann.end_index ?? null,
                    title: ann.title ?? "",
                    url: ann.url ?? "",
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

    webSearchEnabled = verifyWebSearchResults("openai", req.model, webSearchEnabled, annotations, sourcesMap);

    return buildSuccessResponse({
      text: data.output_text ?? answerText,
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
