/**
 * Standard API response builders.
 * Every Edge Function MUST use these — never raw `new Response()`.
 */

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

// ─── Success responses ───

export function ok<T>(data: T, meta?: Record<string, unknown>): Response {
  return json({ success: true, data, ...(meta ? { meta } : {}) }, 200);
}

export function created<T>(data: T): Response {
  return json({ success: true, data }, 201);
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

// ─── Error responses ───

export function badRequest(message: string, details?: unknown): Response {
  return json(
    { success: false, error: { message, code: "BAD_REQUEST", ...(details ? { details } : {}) } },
    400,
  );
}

export function unauthorized(message = "Unauthorized"): Response {
  return json(
    { success: false, error: { message, code: "UNAUTHORIZED" } },
    401,
  );
}

export function forbidden(message = "Forbidden"): Response {
  return json(
    { success: false, error: { message, code: "FORBIDDEN" } },
    403,
  );
}

export function notFound(message = "Not found"): Response {
  return json(
    { success: false, error: { message, code: "NOT_FOUND" } },
    404,
  );
}

export function conflict(message: string): Response {
  return json(
    { success: false, error: { message, code: "CONFLICT" } },
    409,
  );
}

export function serverError(message = "Internal server error"): Response {
  return json(
    { success: false, error: { message, code: "INTERNAL_ERROR" } },
    500,
  );
}
