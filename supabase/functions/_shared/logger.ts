/**
 * Structured request logger for Supabase Edge Functions.
 *
 * Usage:
 *   const logger = createRequestLogger("function-name", req);
 *   // ... after handler produces a response ...
 *   return logger.done(withCors(req, response));
 *   // or with auth context:
 *   return logger.done(withCors(req, response), { tenant_id: auth.tenantId, user_id: auth.user.id });
 */

export interface RequestLogEntry {
  request_id: string;
  function: string;
  method: string;
  path: string;
  status: number;
  latency_ms: number;
  tenant_id?: string;
  user_id?: string;
}

export interface LogContext {
  tenant_id?: string;
  user_id?: string;
}

export function createRequestLogger(functionName: string, req: Request) {
  const request_id = crypto.randomUUID();
  const url = new URL(req.url);
  const method = req.method;
  const path = url.pathname;
  const start = Date.now();

  /**
   * Log a completed request. Pass-through: returns the response unchanged.
   */
  function done(response: Response, ctx?: LogContext): Response {
    const entry: RequestLogEntry = {
      request_id,
      function: functionName,
      method,
      path,
      status: response.status,
      latency_ms: Date.now() - start,
    };
    if (ctx?.tenant_id) entry.tenant_id = ctx.tenant_id;
    if (ctx?.user_id) entry.user_id = ctx.user_id;
    console.log(JSON.stringify(entry));
    return response;
  }

  return { request_id, done };
}
