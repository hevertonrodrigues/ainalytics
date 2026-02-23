import type { AiAdapter, AiRequest, AiResponse } from "./types.ts";

/**
 * Gemini adapter — uses POST /v1beta/models/{model}:generateContent
 * with Google Search grounding tool.
 * If the model doesn't support grounding, retries without the tool.
 */
export const geminiAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return { text: null, model: req.model, tokens: null, latency_ms: 0, error: "GEMINI_API_KEY not configured" };

  const start = Date.now();

  try {
    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: req.prompt }] }],
      tools: [{ google_search: {} }],
    };
    if (req.systemInstruction) {
      body.systemInstruction = { parts: [{ text: req.systemInstruction }] };
    }

    let webSearchEnabled = true;

    const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:generateContent?key=${apiKey}`;

    // Retry loop: if model doesn't support grounding, retry without tools
    let res: Response | null = null;
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status !== 400) break;

      const errText = await res.text();
      console.warn(`[gemini] HTTP 400 on attempt ${attempt}: ${errText}`);

      const isUnsupported = errText.includes("not supported") || errText.includes("is not available") || errText.includes("INVALID_ARGUMENT");
      const mentionsGrounding = errText.includes("google_search") || errText.includes("grounding") || errText.includes("tools");
      if (isUnsupported && mentionsGrounding) {
        console.warn(`[gemini] google_search not supported for ${req.model}, retrying without it`);
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
    const candidate = data.candidates?.[0];
    const usage = data.usageMetadata;

    // ── Parse text ──
    const answerText = candidate?.content?.parts?.[0]?.text ?? null;

    // ── Parse grounding metadata (citations & sources) ──
    // Gemini returns groundingMetadata on the candidate with:
    //   - webSearchQueries: string[] — search queries used
    //   - searchEntryPoint: { renderedContent } — rendered search widget
    //   - groundingChunks: [{ web: { uri, title } }] — source chunks
    //   - groundingSupports: [{ segment: { startIndex, endIndex, text }, groundingChunkIndices: number[] }]
    // deno-lint-ignore no-explicit-any
    const annotations: Array<{ start_index: number; end_index: number; title: string; url: string }> = [];
    const sourcesMap = new Map<string, { url: string; title: string }>();

    if (webSearchEnabled && candidate?.groundingMetadata) {
      const gm = candidate.groundingMetadata;

      // 1) Extract sources from groundingChunks
      // deno-lint-ignore no-explicit-any
      const chunks: any[] = gm.groundingChunks ?? [];
      for (const chunk of chunks) {
        const web = chunk.web;
        if (web?.uri) {
          sourcesMap.set(web.uri, { url: web.uri, title: web.title ?? "" });
        }
      }

      // 2) Extract citations from groundingSupports
      // deno-lint-ignore no-explicit-any
      const supports: any[] = gm.groundingSupports ?? [];
      for (const sup of supports) {
        const seg = sup.segment;
        const chunkIndices: number[] = sup.groundingChunkIndices ?? [];
        for (const idx of chunkIndices) {
          const chunk = chunks[idx];
          const web = chunk?.web;
          if (web?.uri) {
            annotations.push({
              start_index: seg?.startIndex ?? 0,
              end_index: seg?.endIndex ?? 0,
              title: web.title ?? "",
              url: web.uri,
            });
          }
        }
      }

      // 3) Fallback: webResults (older API format)
      if (Array.isArray(gm.webResults)) {
        // deno-lint-ignore no-explicit-any
        for (const wr of gm.webResults as any[]) {
          if (wr.url && !sourcesMap.has(wr.url)) {
            sourcesMap.set(wr.url, { url: wr.url, title: wr.title ?? "" });
          }
        }
      }
    }

    const sources = [...sourcesMap.values()];

    return {
      text: answerText,
      model: req.model,
      tokens: usage ? { input: usage.promptTokenCount ?? 0, output: usage.candidatesTokenCount ?? 0 } : null,
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
