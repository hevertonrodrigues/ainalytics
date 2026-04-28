/**
 * Public CORS for the blog API.
 * Public read endpoints respond with `Access-Control-Allow-Origin: *`.
 * Mutation endpoints (newsletter, engagement) whitelist the website origins
 * + ainalytics origin (for the SA admin UI).
 */

const PUBLIC_HEADERS = "authorization, x-client-info, apikey, content-type, if-none-match, if-modified-since";

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/indexai\.news$/,
  /^https:\/\/www\.indexai\.news$/,
  /^https:\/\/[a-z0-9-]+\.indexai\.news$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
  /^https:\/\/ainalytics\.tech$/,
  /^https:\/\/[a-z0-9-]+\.ainalytics\.tech$/,
  /^http:\/\/localhost(:\d+)?$/,
];

function originAllowed(origin: string): boolean {
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

/**
 * Public CORS — `*` for read endpoints (no credentials required).
 */
export function getPublicCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": PUBLIC_HEADERS,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Origin-restricted CORS for mutation endpoints (newsletter, engagement).
 */
export function getOriginCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = originAllowed(origin) ? origin : "https://indexai.news";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": PUBLIC_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function handlePublicCors(): Response {
  return new Response(null, { status: 204, headers: getPublicCorsHeaders() });
}

export function handleOriginCors(req: Request): Response {
  return new Response(null, { status: 204, headers: getOriginCorsHeaders(req) });
}

export function withPublicCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(getPublicCorsHeaders())) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function withOriginCors(req: Request, res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(getOriginCorsHeaders(req))) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
