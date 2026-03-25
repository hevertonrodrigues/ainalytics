/**
 * Real API response fixtures for AI provider tests.
 *
 * These fixtures are captured from actual production API responses
 * stored in the prompt_answers table. Each fixture contains:
 *  - request: the raw_request sent to the API
 *  - response: the raw_response from the API (simplified for testing)
 *  - expected: what our normalized output should look like
 *
 * To update fixtures, query production DB:
 *   SELECT raw_request, raw_response FROM prompt_answers
 *   WHERE platform_slug = 'openai' AND error IS NULL
 *   ORDER BY searched_at DESC LIMIT 1;
 */

// ═══════════════════════════════════════════════════════════
// OpenAI — Responses API (/v1/responses)
// ═══════════════════════════════════════════════════════════

/** Real OpenAI success response with web search + annotations. Captured from gpt-4.1-mini. */
export const OPENAI_SUCCESS_WITH_SEARCH = {
  request: {
    input: "Como a alocação de profissionais pode complementar minha equipe interna?",
    model: "gpt-4.1-mini",
    tools: [{ type: "web_search", user_location: { type: "approximate", country: "BR" } }],
    include: ["web_search_call.action.sources"],
    tool_choice: "required",
  },
  response: {
    id: "resp_0edce25deebcf5da0069c2ca736c2c8196b6fa7fcea9b02ab0",
    model: "gpt-4.1-mini-2025-04-14",
    object: "response",
    output: [
      {
        id: "ws_0edce25deebcf5da0069c2ca738f64819699004dc1f5afa6ed",
        type: "web_search_call",
        status: "completed",
        action: {
          type: "search",
          query: "Como a alocação de profissionais pode complementar minha equipe interna?",
          sources: [
            { url: "https://organex.com.br/equipe-estendida-como-funciona/?utm_source=openai", type: "url" },
            { url: "https://www.grupoprebianchi.com.br/artigos/alocacao-de-profissionais-de-ti/?utm_source=openai", type: "url" },
            { url: "https://www.gruposeres.com.br/realocacao-interna-de-funcionarios/?utm_source=openai", type: "url" },
          ],
        },
      },
      {
        id: "msg_0edce25deebcf5da0069c2ca746ecc8196b94b157e8811cb8c",
        role: "assistant",
        type: "message",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: "A alocação de profissionais é uma estratégia que permite integrar especialistas externos à sua equipe interna...",
            annotations: [
              {
                type: "url_citation",
                start_index: 642,
                end_index: 791,
                title: "Alocação de Profissionais de TI: Quando, Por Quê e Como Fazer",
                url: "https://www.grupoprebianchi.com.br/artigos/alocacao-de-profissionais-de-ti/?utm_source=openai",
              },
              {
                type: "url_citation",
                start_index: 1102,
                end_index: 1253,
                title: "Alocação de profissionais de TI: por que contratar? - OSBR",
                url: "https://www.osbr.com.br/alocacao-de-profissionais-de-ti/?utm_source=openai",
              },
            ],
          },
        ],
      },
    ],
    output_text: "A alocação de profissionais é uma estratégia que permite integrar especialistas externos à sua equipe interna...",
    usage: { input_tokens: 8520, output_tokens: 617, total_tokens: 9137 },
  },
  expected: {
    annotationCount: 2,
    sourceCount: 4, // 3 from action.sources + 1 new from annotations (osbr)
    firstAnnotation: {
      url: "https://www.grupoprebianchi.com.br/artigos/alocacao-de-profissionais-de-ti/?utm_source=openai",
      start_index: 642,
      end_index: 791,
    },
    web_search_enabled: true,
    hasText: true,
  },
};

/** OpenAI response without web search enabled. */
export const OPENAI_SUCCESS_NO_SEARCH = {
  response: {
    id: "resp_abc123",
    model: "gpt-4.1-mini-2025-04-14",
    object: "response",
    output: [
      {
        id: "msg_abc123",
        role: "assistant",
        type: "message",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: "AI is the simulation of human intelligence by machines.",
          },
        ],
      },
    ],
    output_text: "AI is the simulation of human intelligence by machines.",
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  },
};

/** OpenAI 400 error for unsupported web_search parameter. */
export const OPENAI_400_WEB_SEARCH_UNSUPPORTED = {
  status: 400,
  body: JSON.stringify({
    error: {
      message: "Unsupported parameter: 'tools' is not supported with this model.",
      type: "invalid_request_error",
      param: "tools",
      code: "unsupported_parameter",
    },
  }),
};

// ═══════════════════════════════════════════════════════════
// Anthropic — Messages API (/v1/messages)
// ═══════════════════════════════════════════════════════════

/** Real Anthropic success response with web search citations. Captured from claude-haiku-4-5. */
export const ANTHROPIC_SUCCESS_WITH_SEARCH = {
  request: {
    model: "claude-haiku-4-5-20251001",
    tools: [{ name: "web_search", type: "web_search_20250305", user_location: { type: "approximate", country: "BR" } }],
    messages: [{ role: "user", content: "Como a alocação de profissionais pode complementar minha equipe interna?" }],
    max_tokens: 16384,
  },
  response: {
    model: "claude-haiku-4-5-20251001",
    id: "msg_019bTd5Xmmm1hS1nRTEdTPqR",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: "A alocação de profissionais especializados consiste na disponibilização de talentos com expertise técnica...",
        citations: [
          {
            type: "web_search_result_location",
            url: "https://amcom.com.br/blog/alocacao-de-profissionais-especializados",
            title: "Mais resultado em TI com alocação de profissionais especializados",
            cited_text: "A alocação de profissionais especializados consiste na disponibilização de talentos com expertise técnica comprovada...",
          },
          {
            type: "web_search_result_location",
            url: "https://ctctech.com.br/blog/alocacao-de-profissionais-de-ti/",
            title: "Alocação de profissionais de TI: por que escolher essa estratégia?",
            cited_text: "A alocação de profissionais de TI é um serviço que permite que empresas contratem...",
          },
        ],
      },
      {
        type: "text",
        text: " Isso oferece flexibilidade e agilidade para sua empresa.",
      },
    ],
    usage: { input_tokens: 5200, output_tokens: 800 },
  },
  expected: {
    annotationCount: 2,
    sourceCount: 2,
    firstAnnotation: {
      url: "https://amcom.com.br/blog/alocacao-de-profissionais-especializados",
      start_index: null,
      end_index: null,
      cited_text: "A alocação de profissionais especializados consiste na disponibilização de talentos com expertise técnica comprovada...",
    },
    web_search_enabled: true,
    hasText: true,
  },
};

/** Anthropic 400 when web search tool type is not supported by the model. */
export const ANTHROPIC_400_WEB_SEARCH_UNSUPPORTED = {
  status: 400,
  body: JSON.stringify({
    type: "error",
    error: {
      type: "invalid_request_error",
      message: "tool_type web_search_20250305 is not supported for this model",
    },
  }),
};

// ═══════════════════════════════════════════════════════════
// Gemini — GenerateContent API
// ═══════════════════════════════════════════════════════════

/** Gemini success response with grounding metadata. Based on documented format. */
export const GEMINI_SUCCESS_WITH_GROUNDING = {
  response: {
    candidates: [
      {
        content: {
          parts: [{ text: "AI (Artificial Intelligence) refers to the simulation of human intelligence in machines..." }],
        },
        groundingMetadata: {
          groundingChunks: [
            { web: { uri: "https://en.wikipedia.org/wiki/Artificial_intelligence", title: "Artificial intelligence - Wikipedia" } },
            { web: { uri: "https://www.ibm.com/topics/artificial-intelligence", title: "What is AI? - IBM" } },
          ],
          groundingSupports: [
            {
              segment: { startIndex: 0, endIndex: 85 },
              groundingChunkIndices: [0],
            },
            {
              segment: { startIndex: 86, endIndex: 200 },
              groundingChunkIndices: [1],
            },
          ],
        },
      },
    ],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200 },
  },
  expected: {
    annotationCount: 2,
    sourceCount: 2,
    web_search_enabled: true,
    hasText: true,
  },
};

/** Gemini 400 when google_search grounding is not supported. */
export const GEMINI_400_GROUNDING_UNSUPPORTED = {
  status: 400,
  body: JSON.stringify({
    error: {
      code: 400,
      message: "google_search grounding is not supported for this model. INVALID_ARGUMENT",
      status: "INVALID_ARGUMENT",
    },
  }),
};

// ═══════════════════════════════════════════════════════════
// Grok (xAI) — Responses API (api.x.ai/v1/responses)
// ═══════════════════════════════════════════════════════════

/** Grok success response with citations + annotations. Based on xAI API format. */
export const GROK_SUCCESS_WITH_SEARCH = {
  response: {
    id: "resp_grok_abc123",
    model: "grok-4",
    object: "response",
    citations: [
      "https://example.com/source1",
      "https://example.com/source2",
    ],
    output: [
      {
        id: "ws_grok_search1",
        type: "web_search_call",
        status: "completed",
        action: {
          type: "search",
          query: "What is AI?",
          sources: [
            { url: "https://example.com/source1", title: "Source 1" },
            { url: "https://example.com/source3", title: "Source 3" },
          ],
        },
      },
      {
        id: "msg_grok_abc123",
        role: "assistant",
        type: "message",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: "AI is the simulation of human intelligence by machines.",
            annotations: [
              {
                type: "url_citation",
                start_index: 0,
                end_index: 54,
                url: "https://example.com/source1",
                title: "Source 1",
              },
            ],
          },
        ],
      },
    ],
    output_text: "AI is the simulation of human intelligence by machines.",
    usage: { input_tokens: 100, output_tokens: 50 },
  },
  expected: {
    annotationCount: 1,
    sourceCount: 3, // 2 from top-level citations + 1 new from action.sources
    web_search_enabled: true,
    hasText: true,
  },
};

// ═══════════════════════════════════════════════════════════
// Perplexity — Agent API (/responses)
// ═══════════════════════════════════════════════════════════

/** Perplexity success response with citations + annotations. Based on Perplexity Agent API. */
export const PERPLEXITY_SUCCESS = {
  response: {
    id: "resp_pplx_abc123",
    model: "sonar-pro",
    object: "response",
    citations: [
      "https://en.wikipedia.org/wiki/Artificial_intelligence",
      "https://www.ibm.com/topics/artificial-intelligence",
    ],
    output: [
      {
        id: "msg_pplx_abc123",
        type: "message",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: "AI refers to the simulation of human intelligence in machines.",
            annotations: [
              {
                type: "url_citation",
                start_index: 0,
                end_index: 61,
                url: "https://en.wikipedia.org/wiki/Artificial_intelligence",
                title: "Artificial intelligence - Wikipedia",
              },
            ],
          },
        ],
      },
    ],
    output_text: "AI refers to the simulation of human intelligence in machines.",
    usage: { input_tokens: 50, output_tokens: 30 },
  },
  expected: {
    annotationCount: 1,
    sourceCount: 2,
    web_search_enabled: true,
    hasText: true,
  },
};

// ═══════════════════════════════════════════════════════════
// Generic error payloads
// ═══════════════════════════════════════════════════════════

export const GENERIC_500_ERROR = {
  status: 500,
  body: JSON.stringify({ error: { message: "Internal server error" } }),
};

export const GENERIC_429_RATE_LIMIT = {
  status: 429,
  body: JSON.stringify({ error: { message: "Rate limit exceeded" } }),
};
