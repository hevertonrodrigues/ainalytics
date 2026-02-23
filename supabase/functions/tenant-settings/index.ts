import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, created, badRequest, noContent, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    switch (req.method) {
      case "GET":
        return withCors(req, await handleGet(req));
      case "PUT":
        return withCors(req, await handleUpsert(req));
      case "DELETE":
        return withCors(req, await handleDelete(req));
      default:
        return withCors(req, badRequest(`Method ${req.method} not allowed`));
    }
  } catch (err) {
    console.error("[tenant-settings]", err);
    if (err.status) {
      return withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: err.message, code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
          { status: err.status, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return withCors(req, serverError(err.message || "Internal server error"));
  }
});

// ────────────────────────────────────────────────────────────
// GET /tenant-settings — list all settings for current tenant
// ────────────────────────────────────────────────────────────

async function handleGet(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const db = createAdminClient();

  const { data, error } = await db
    .from("tenant_settings")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .order("key");

  if (error) return serverError(error.message);

  return ok(data);
}

// ────────────────────────────────────────────────────────────
// PUT /tenant-settings — upsert a setting (key/value)
// ────────────────────────────────────────────────────────────

interface UpsertBody {
  key: string;
  value: string;
}

async function handleUpsert(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const body: UpsertBody = await req.json();

  if (!body.key) {
    return badRequest("key is required");
  }

  const db = createAdminClient();

  // Check if setting exists
  const { data: existing } = await db
    .from("tenant_settings")
    .select("id")
    .eq("tenant_id", auth.tenantId)
    .eq("key", body.key)
    .single();

  if (existing) {
    // Update
    const { data, error } = await db
      .from("tenant_settings")
      .update({ value: body.value || "" })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return serverError(error.message);
    return ok(data);
  } else {
    // Insert
    const { data, error } = await db
      .from("tenant_settings")
      .insert({
        tenant_id: auth.tenantId,
        key: body.key,
        value: body.value || "",
      })
      .select()
      .single();

    if (error) return serverError(error.message);
    return created(data);
  }
}

// ────────────────────────────────────────────────────────────
// DELETE /tenant-settings?key=xxx — delete a setting
// ────────────────────────────────────────────────────────────

async function handleDelete(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return badRequest("key query parameter is required");
  }

  const db = createAdminClient();

  const { error } = await db
    .from("tenant_settings")
    .delete()
    .eq("tenant_id", auth.tenantId)
    .eq("key", key);

  if (error) return serverError(error.message);

  return noContent();
}
