import type { AiAdapter, AiRequest, AiResponse, NormalizedAnnotation } from "./types.ts";
import { buildErrorResponse, buildSuccessResponse, toSourcesArray, verifyWebSearchResults } from "./normalize.ts";

/**
 * Gemini adapter — uses POST /v1beta/models/{model}:generateContent
 * with Google Search grounding tool.
 * Web search is controlled by `req.webSearchEnabled` (from models.web_search_active).
 * If the model doesn't support grounding, retries without the tool.
 */
export const geminiAdapter: AiAdapter = async (req: AiRequest): Promise<AiResponse> => {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return buildErrorResponse(req, Date.now(), "GEMINI_API_KEY not configured");

  const start = Date.now();

  try {
    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: req.prompt }] }],
    };
    if (req.systemInstruction) {
      body.systemInstruction = { parts: [{ text: req.systemInstruction }] };
    }

    // Only add google_search tool if enabled for this model
    let webSearchEnabled = req.webSearchEnabled !== false;
    if (webSearchEnabled) {
      body.tools = [{ google_search: {} }];
    }

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

      return buildErrorResponse(req, start, `HTTP 400: ${errText}`, body, errText);
    }

    const latency_ms = Date.now() - start;

    if (!res!.ok) {
      const errBody = await res!.text();
      return buildErrorResponse(req, start, `HTTP ${res!.status}: ${errBody}`, body, errBody);
    }

    const data = await res!.json();
    const candidate = data.candidates?.[0];
    const usage = data.usageMetadata;

    // ── Parse text ──
    const answerText = candidate?.content?.parts?.[0]?.text ?? null;

    // ── Parse grounding metadata ──
    // groundingChunks: [{ web: { uri, title } }] — source chunks
    // groundingSupports: [{ segment: { startIndex, endIndex }, groundingChunkIndices: number[] }]
    const annotations: NormalizedAnnotation[] = [];
    const sourcesMap = new Map<string, { url: string; title: string }>();

    if (webSearchEnabled && candidate?.groundingMetadata) {
      const gm = candidate.groundingMetadata;

      // deno-lint-ignore no-explicit-any
      const chunks: any[] = gm.groundingChunks ?? [];
      for (const chunk of chunks) {
        const web = chunk.web;
        if (web?.uri) {
          sourcesMap.set(web.uri, { url: web.uri, title: web.title ?? "" });
        }
      }

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
              start_index: seg?.startIndex ?? null,
              end_index: seg?.endIndex ?? null,
              url: web.uri,
              title: web.title ?? "",
              cited_text: "",
            });
          }
        }
      }

      // Fallback: older webResults format
      if (Array.isArray(gm.webResults)) {
        // deno-lint-ignore no-explicit-any
        for (const wr of gm.webResults as any[]) {
          if (wr.url && !sourcesMap.has(wr.url)) {
            sourcesMap.set(wr.url, { url: wr.url, title: wr.title ?? "" });
          }
        }
      }
    }

    webSearchEnabled = verifyWebSearchResults("gemini", req.model, webSearchEnabled, annotations, sourcesMap);

    return buildSuccessResponse({
      text: answerText,
      model: req.model,
      tokens: usage ? { input: usage.promptTokenCount ?? 0, output: usage.candidatesTokenCount ?? 0 } : null,
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
