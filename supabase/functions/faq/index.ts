import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

/**
 * GET /faq?lang=en
 *
 * Public endpoint — no auth required.
 * Returns FAQ items filtered by visibility:
 *   - If Authorization header present & valid → public + private
 *   - Otherwise → public only
 *
 * Query params:
 *   lang — "en" | "pt" | "es" (default: "en")
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  if (req.method !== "GET") {
    return withCors(req, badRequest(`Method ${req.method} not allowed`));
  }

  try {
    const db = createAdminClient();

    // Determine if the caller is authenticated
    let isAuthenticated = false;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
        const { data: { user } } = await db.auth.getUser(token);
        isAuthenticated = !!user;
      }
    }

    // Determine language
    const url = new URL(req.url);
    const lang = url.searchParams.get("lang") || "en";

    // Map lang to column suffix
    const validLangs: Record<string, string> = { en: "en", pt: "pt", es: "es" };
    const suffix = validLangs[lang] || "en";

    // Build query — filter by status based on auth
    const statuses = isAuthenticated ? ["public", "private"] : ["public"];

    const { data, error: dbError } = await db
      .from("faq")
      .select(`id, question_${suffix}, answer_${suffix}, status, sort_order`)
      .in("status", statuses)
      .order("sort_order", { ascending: true });

    if (dbError) throw dbError;

    // Normalize column names for the frontend
    const items = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      question: row[`question_${suffix}`] || row.question_en,
      answer: row[`answer_${suffix}`] || row.answer_en,
      status: row.status,
    }));

    return withCors(req, ok(items));
  } catch (err: unknown) {
    console.error("[faq]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return withCors(req, serverError(message));
  }
});
