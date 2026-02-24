import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, badRequest, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    switch (req.method) {
      case "GET":
        return withCors(req, await handleGet(req));
      case "PUT":
        return withCors(req, await handleUpdate(req));
      default:
        return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }
  } catch (err: any) {
    console.error("[users-me]", err);
    if (err.status) {
      return withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: err.message, code: "UNAUTHORIZED" } }),
          { status: err.status, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return withCors(req, serverError(err.message || "Internal server error"));
  }
});

// ────────────────────────────────────────────────────────────
// GET /users-me — get own profile + tenants (no public.users)
// ────────────────────────────────────────────────────────────

async function handleGet(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const db = createAdminClient();

  // Get profile for current tenant
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("tenant_id", auth.tenantId)
    .single();

  // Get all tenants
  const { data: memberships } = await db
    .from("tenant_users")
    .select("tenant_id, role, tenants(id, name, slug, main_domain, plan_id, created_at, updated_at, website_title, metatags, extracted_content, llm_txt, sitemap_xml, llm_txt_status)")
    .eq("user_id", auth.user.id)
    .eq("is_active", true);

  const tenants = (memberships || []).map((m: any) => m.tenants).filter(Boolean);

  return ok({ profile, tenants });
}

// ────────────────────────────────────────────────────────────
// PUT /users-me — update own profile
// ────────────────────────────────────────────────────────────

interface UpdateProfileBody {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  locale?: string;
}

async function handleUpdate(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const body: UpdateProfileBody = await req.json();
  const db = createAdminClient();

  // Update profile table (full_name, phone, avatar_url, locale)
  const profileUpdate: Record<string, unknown> = {};
  if (body.full_name !== undefined) profileUpdate.full_name = body.full_name;
  if (body.phone !== undefined) profileUpdate.phone = body.phone;
  if (body.avatar_url !== undefined) profileUpdate.avatar_url = body.avatar_url;
  if (body.locale !== undefined) profileUpdate.locale = body.locale;

  if (Object.keys(profileUpdate).length > 0) {
    const { error: profileError } = await db
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", auth.user.id)
      .eq("tenant_id", auth.tenantId);

    if (profileError) return serverError(profileError.message);
  }

  // Return updated profile
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("tenant_id", auth.tenantId)
    .single();

  return ok({ profile });
}
