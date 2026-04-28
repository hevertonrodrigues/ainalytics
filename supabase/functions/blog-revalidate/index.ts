// blog-revalidate — SA-only proxy for the website's on-demand revalidation
// webhook. The frontend cannot call the website directly because the shared
// REVALIDATE_SECRET must stay server-side; this function adds the header and
// forwards the request.
//
// POST /blog-revalidate
// Body: {
//   event: "article.published" | "article.updated" | "article.deleted"
//        | "category.changed" | "ranking.updated" | "purge",
//   lang?: "en" | "es" | "pt",   // required for all events except "purge"
//   slug?: string,               // required for article.* events
//   tags?: string[]
// }
//
// See _api-doc/REVALIDATION.md for the full contract.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createRequestLogger } from "../_shared/logger.ts";
import { BLOG_BASE_URL } from "../_shared/blog-langs.ts";

const VALID_EVENTS = new Set([
  "article.published",
  "article.updated",
  "article.deleted",
  "category.changed",
  "ranking.updated",
  "purge",
]);

const VALID_LANGS = new Set(["en", "es", "pt"]);

interface RevalidatePayload {
  event: string;
  lang?: string;
  slug?: string;
  tags?: string[];
}

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-revalidate", req);
  if (req.method === "OPTIONS") return handleCors(req);

  let authCtx: { user_id?: string } = {};

  try {
    const { user } = await verifySuperAdmin(req);
    authCtx = { user_id: user.id };

    if (req.method !== "POST") {
      return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
    }

    const secret = Deno.env.get("REVALIDATE_SECRET");
    if (!secret) {
      return logger.done(
        withCors(req, serverError("REVALIDATE_SECRET is not configured on the server")),
        authCtx,
      );
    }

    let body: RevalidatePayload;
    try {
      body = await req.json();
    } catch {
      return logger.done(withCors(req, badRequest("Invalid JSON body")), authCtx);
    }

    if (!body.event || !VALID_EVENTS.has(body.event)) {
      return logger.done(withCors(req, badRequest(`Unknown event "${body.event}"`)), authCtx);
    }

    if (body.event !== "purge") {
      if (!body.lang || !VALID_LANGS.has(body.lang)) {
        return logger.done(withCors(req, badRequest("Missing/invalid lang (en, es, pt)")), authCtx);
      }
      if (body.event.startsWith("article.") && !body.slug) {
        return logger.done(withCors(req, badRequest("Missing slug for article event")), authCtx);
      }
    }

    const upstreamUrl = `${BLOG_BASE_URL}/api/revalidate`;
    const upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    const upstreamText = await upstreamRes.text();
    let upstreamJson: unknown = null;
    try { upstreamJson = upstreamText ? JSON.parse(upstreamText) : null; } catch { /* ignore */ }

    if (!upstreamRes.ok) {
      console.error("[blog-revalidate] upstream failed", upstreamRes.status, upstreamText);
      return logger.done(
        withCors(
          req,
          new Response(
            JSON.stringify({
              success: false,
              error: {
                message: `Revalidation webhook responded with ${upstreamRes.status}`,
                code: "UPSTREAM_ERROR",
                details: upstreamJson ?? upstreamText,
              },
            }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          ),
        ),
        authCtx,
      );
    }

    return logger.done(
      withCors(req, ok({
        event: body.event,
        lang: body.lang ?? null,
        slug: body.slug ?? null,
        upstream: upstreamJson ?? { raw: upstreamText },
      })),
      authCtx,
    );

  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[blog-revalidate]", err);
    if (err.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: err.message, code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
          { status: err.status, headers: { "Content-Type": "application/json" } },
        ),
      ));
    }
    return logger.done(withCors(req, serverError(err.message || "Internal server error")));
  }
});
