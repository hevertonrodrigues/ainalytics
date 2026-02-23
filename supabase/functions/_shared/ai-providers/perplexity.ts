import type { AiAdapter, AiRequest, AiResponse, NormalizedAnnotation } from "./types.ts";
import { buildErrorResponse, buildSuccessResponse, toSourcesArray } from "./normalize.ts";

/**
 * Perplexity adapter — uses the Agent API (POST /responses).
 * Perplexity always performs web search (it's a search-first platform).
 * Citations are returned in `data.citations` as URL strings.
 * Inline url_citation annotations are in the output message content.
 */
export const perplexityAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!apiKey) return buildErrorResponse(req, Date.now(), "PERPLEXITY_API_KEY not configured");

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
      return buildErrorResponse(req, start, `HTTP ${res.status}: ${errBody}`, body, errBody);
    }

    const data = await res.json();

    // ── Parse citations & sources ──
    // Perplexity always searches — citations are top-level URL strings
    const annotations: NormalizedAnnotation[] = [];
    const sourcesMap = new Map<string, { url: string; title: string }>();

    // Top-level citations: array of URL strings
    if (Array.isArray(data.citations)) {
      for (const url of data.citations as string[]) {
        if (url && typeof url === "string") {
          sourcesMap.set(url, { url, title: "" });
        }
      }
    }

    // Parse output items for annotations (same Responses API format)
    // deno-lint-ignore no-explicit-any
    for (const item of (data.output ?? []) as any[]) {
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

    return buildSuccessResponse({
      text: data.output_text ?? null,
      model: data.model ?? req.model,
      tokens: data.usage ? { input: data.usage.input_tokens ?? 0, output: data.usage.output_tokens ?? 0 } : null,
      latency_ms,
      raw_request: body,
      raw_response: data,
      web_search_enabled: true, // Perplexity always searches
      annotations,
      sources: toSourcesArray(sourcesMap),
    });
  } catch (err) {
    return buildErrorResponse(req, start, String(err));
  }
};
