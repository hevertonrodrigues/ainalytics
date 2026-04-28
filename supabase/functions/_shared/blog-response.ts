/**
 * Response builder for the blog public API.
 *
 * The blog API does NOT use the `{ success, data, error }` envelope used by
 * the rest of the SaaS — it returns the response shape exactly as documented
 * in `_api-doc/api.md` (so the external blog frontend can consume it
 * directly).
 *
 * Every localized GET sets:
 *   - `Content-Language` (BCP-47)
 *   - `ETag` (weak hash of the body)
 *   - `Cache-Control`
 *   - `Link rel="canonical"` and one `Link rel="alternate"` per locale
 */
import { type AlternateMap, BLOG_BASE_URL, DEFAULT_LANG, type Lang, localeFor } from "./blog-langs.ts";

const COMMON_HEADERS = {
  "X-Content-Type-Options": "nosniff",
};

export interface JsonResponseOpts {
  locale?: string;                     // e.g. 'pt-BR'
  canonicalUrl?: string;               // absolute
  alternates?: AlternateMap;           // hreflang map
  defaultLangPath?: string;            // path used for `x-default` (defaults to default lang)
  cacheControl?: string;
  status?: number;
  lastModified?: string | Date | null; // sets Last-Modified header
  ifNoneMatch?: string | null;         // request's If-None-Match header
  extraHeaders?: Record<string, string>;
}

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isoOrUndefined(v: string | Date | null | undefined): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.toUTCString();
  // Try parse ISO and convert to RFC1123
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toUTCString();
}

export async function jsonResponse(data: unknown, opts: JsonResponseOpts = {}): Promise<Response> {
  const body = JSON.stringify(data);
  const hash = (await sha1Hex(body)).slice(0, 16);
  const etag = `W/"${hash}"`;

  // Conditional GET — return 304 with no body
  if (opts.ifNoneMatch && opts.ifNoneMatch === etag) {
    const headers304 = new Headers({ etag });
    if (opts.cacheControl) headers304.set("cache-control", opts.cacheControl);
    if (opts.locale) headers304.set("content-language", opts.locale);
    return new Response(null, { status: 304, headers: headers304 });
  }

  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    ...COMMON_HEADERS,
    etag,
    "cache-control":
      opts.cacheControl ?? "public, s-maxage=300, stale-while-revalidate=86400",
  });

  if (opts.locale) headers.set("content-language", opts.locale);

  const lastMod = isoOrUndefined(opts.lastModified ?? undefined);
  if (lastMod) headers.set("last-modified", lastMod);

  if (opts.canonicalUrl) {
    const links: string[] = [`<${opts.canonicalUrl}>; rel="canonical"`];
    if (opts.alternates) {
      for (const [lang, target] of Object.entries(opts.alternates)) {
        if (!target) continue;
        links.push(`<${target.url}>; rel="alternate"; hreflang="${target.locale}"`);
      }
      // x-default — points at the default-locale variant
      const def = opts.alternates[DEFAULT_LANG as Lang];
      if (def) {
        links.push(`<${def.url}>; rel="alternate"; hreflang="x-default"`);
      } else if (opts.defaultLangPath) {
        links.push(`<${BLOG_BASE_URL}${opts.defaultLangPath}>; rel="alternate"; hreflang="x-default"`);
      }
    }
    headers.set("link", links.join(", "));
  }

  if (opts.extraHeaders) {
    for (const [k, v] of Object.entries(opts.extraHeaders)) headers.set(k, v);
  }

  return new Response(body, { status: opts.status ?? 200, headers });
}

// ─── Errors — match api.md envelope: { error, message, details? } ──────────

export type ErrorCode =
  | "bad_request"
  | "invalid_filter"
  | "unauthenticated"
  | "forbidden"
  | "unsupported_lang"
  | "not_found"
  | "gone"
  | "validation_failed"
  | "rate_limited"
  | "internal_error"
  | "upstream_unavailable";

interface ErrorOpts {
  status: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
  retryAfterSeconds?: number;
}

export function errorResponse(opts: ErrorOpts): Response {
  const body = JSON.stringify({
    error: opts.code,
    message: opts.message,
    ...(opts.details ? { details: opts.details } : {}),
  });
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...COMMON_HEADERS,
  });
  if (opts.retryAfterSeconds) headers.set("retry-after", String(opts.retryAfterSeconds));
  return new Response(body, { status: opts.status, headers });
}

export const errors = {
  unsupportedLang: (lang: string) =>
    errorResponse({
      status: 404,
      code: "unsupported_lang",
      message: "Locale not supported",
      details: { field: "lang", value: lang, supported: ["pt", "es", "en"] },
    }),
  notFound: (message = "Resource not found") =>
    errorResponse({ status: 404, code: "not_found", message }),
  gone: (message = "Resource has been retracted") =>
    errorResponse({ status: 410, code: "gone", message }),
  badRequest: (message: string, details?: unknown) =>
    errorResponse({ status: 400, code: "bad_request", message, details }),
  invalidFilter: (field: string, value: string) =>
    errorResponse({ status: 400, code: "invalid_filter", message: `Invalid value for filter '${field}'`, details: { field, value } }),
  validation: (message: string, details?: unknown) =>
    errorResponse({ status: 422, code: "validation_failed", message, details }),
  unauthenticated: () => errorResponse({ status: 401, code: "unauthenticated", message: "Bearer token required" }),
  forbidden: (message = "Forbidden") => errorResponse({ status: 403, code: "forbidden", message }),
  rateLimited: (retryAfterSeconds: number) =>
    errorResponse({ status: 429, code: "rate_limited", message: "Too many requests", retryAfterSeconds }),
  internal: (message = "Internal server error") =>
    errorResponse({ status: 500, code: "internal_error", message }),
  upstream: (message = "Upstream dependency unavailable") =>
    errorResponse({ status: 503, code: "upstream_unavailable", message }),
};

/** Convenience: returns a 204 no-content response with cache disabled. */
export function noContentResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}

// Re-export for callers
export { localeFor };
