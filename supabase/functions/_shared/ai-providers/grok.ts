import type { AiAdapter, AiRequest, AiResponse } from "./types.ts";

/**
 * Grok (xAI) adapter — uses the OpenAI-compatible Responses API
 * at https://api.x.ai/v1/responses with web_search tool.
 *
 * Citations in xAI are returned differently from OpenAI:
 *   - `citations` (top-level): list of all source URLs (always returned)
 *   - `inline_citations`: structured position annotations (opt-in via include)
 *
 * If the model doesn't support web_search, retries without it.
 */
export const grokAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("XAI_API_KEY");
  if (!apiKey) return { text: null, model: req.model, tokens: null, latency_ms: 0, error: "XAI_API_KEY not configured" };

  const start = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: req.model,
      input: [{ role: "user", content: req.prompt }],
    };
    if (req.systemInstruction) body.instructions = req.systemInstruction;

    // Only add web_search tool if web search is enabled for this model
    let webSearchEnabled = req.webSearchEnabled !== false;
    if (webSearchEnabled) {
      body.tools = [{ type: "web_search" }];
      body.tool_choice = "required";
    }

    // Retry loop: some models may reject web_search tool or include param
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

      // Only strip tools if the error specifically says web_search/tools is not supported
      const isUnsupported = errText.includes("not supported") || errText.includes("Unsupported parameter");
      const mentionsWebSearch = errText.includes("web_search");
      if (isUnsupported && mentionsWebSearch) {
        console.warn(`[grok] web_search not supported for ${req.model}, retrying without it`);
        webSearchEnabled = false;
        delete body.tools;
        delete body.tool_choice;
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

    // DEBUG: dump response structure to understand xAI format
    console.log("[grok] response top-level keys:", Object.keys(data));
    console.log("[grok] data.citations:", JSON.stringify(data.citations ?? "MISSING"));
    console.log("[grok] data.inline_citations:", JSON.stringify(data.inline_citations ?? "MISSING"));
    // Check output items for any citation-related fields
    if (Array.isArray(data.output)) {
      // deno-lint-ignore no-explicit-any
      for (const item of data.output as any[]) {
        console.log(`[grok] output item type=${item.type}, keys=${Object.keys(item).join(",")}`);
        if (item.type === "message" && Array.isArray(item.content)) {
          // deno-lint-ignore no-explicit-any
          for (const block of item.content as any[]) {
            console.log(`[grok]   content block type=${block.type}, keys=${Object.keys(block).join(",")}`);
            if (block.annotations) console.log(`[grok]   annotations:`, JSON.stringify(block.annotations).slice(0, 500));
          }
        }
        if (item.type === "web_search_call") {
          console.log(`[grok]   web_search_call action:`, JSON.stringify(item.action ?? "NONE").slice(0, 500));
        }
      }
    }

    // ── Parse text from output items ──
    // The Responses API returns output[] with message items containing content blocks.
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

    // ── Parse xAI-specific citations ──
    // `data.citations` — top-level array of URL strings (all sources, always returned)
    // `data.inline_citations` — structured annotations (opt-in via include: ["inline_citations"])
    // deno-lint-ignore no-explicit-any
    const annotations: Array<{ start_index: number; end_index: number; url: string; title: string }> = [];
    const sourcesMap = new Map<string, { url: string; title: string }>();

    if (webSearchEnabled) {
      // 1) Top-level citations: array of URL strings
      if (Array.isArray(data.citations)) {
        for (const url of data.citations as string[]) {
          if (url && typeof url === "string") {
            sourcesMap.set(url, { url, title: "" });
          }
        }
      }

      // 2) Inline citations: structured position-based annotations
      if (Array.isArray(data.inline_citations)) {
        // deno-lint-ignore no-explicit-any
        for (const cit of data.inline_citations as any[]) {
          const url = cit.web_citation?.url ?? cit.x_citation?.url ?? cit.url ?? "";
          if (url) {
            annotations.push({
              start_index: cit.start_index ?? 0,
              end_index: cit.end_index ?? 0,
              url,
              title: cit.title ?? "",
            });
            if (!sourcesMap.has(url)) {
              sourcesMap.set(url, { url, title: cit.title ?? "" });
            }
          }
        }
      }

      // 3) Also check output items for OpenAI-style annotations (fallback)
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
                    start_index: ann.start_index ?? 0,
                    end_index: ann.end_index ?? 0,
                    url: ann.url ?? "",
                    title: ann.title ?? "",
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

    // ── Post-response verification ──
    // If web search was enabled but no citations/sources were returned,
    // the model silently ignored the search tool
    if (webSearchEnabled && annotations.length === 0 && sourcesMap.size === 0) {
      console.warn(`[grok] web search was enabled but no citations returned for ${req.model} — marking web_search_enabled as false`);
      webSearchEnabled = false;
    }

    const sources = [...sourcesMap.values()];

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
