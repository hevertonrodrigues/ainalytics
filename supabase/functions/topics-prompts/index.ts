import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import {
  ok,
  created,
  badRequest,
  notFound,
  noContent,
  conflict,
  serverError,
} from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    // segments[0] = "topics-prompts", segments[1] = "prompts" (optional)
    const isPromptRoute = segments.length >= 2 && segments[segments.length - 1] === "prompts";

    if (isPromptRoute) {
      return withCors(req, await handlePrompts(req));
    } else {
      return withCors(req, await handleTopics(req));
    }
  } catch (err) {
    console.error("[topics-prompts]", err);
    if (err.status) {
      return withCors(
        req,
        new Response(
          JSON.stringify({
            success: false,
            error: {
              message: err.message,
              code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
            },
          }),
          {
            status: err.status,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }
    return withCors(req, serverError(err.message || "Internal server error"));
  }
});

// ────────────────────────────────────────────────────────────
// Topics handlers
// ────────────────────────────────────────────────────────────

async function handleTopics(req: Request): Promise<Response> {
  switch (req.method) {
    case "GET":
      return getTopics(req);
    case "POST":
      return createTopic(req);
    case "PUT":
      return updateTopic(req);
    case "DELETE":
      return deleteTopic(req);
    default:
      return badRequest(`Method ${req.method} not allowed`);
  }
}

async function getTopics(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const db = createAdminClient();

  // Get topics with prompt counts
  const { data, error } = await db
    .from("topics")
    .select("*, prompts(count)")
    .eq("tenant_id", auth.tenantId)
    .order("name");

  if (error) return serverError(error.message);

  // Flatten prompt count from [{count: n}] to a number
  const topics = (data || []).map((t: Record<string, unknown>) => ({
    ...t,
    prompt_count: Array.isArray(t.prompts) && t.prompts.length > 0
      ? (t.prompts[0] as Record<string, number>).count
      : 0,
    prompts: undefined, // remove nested array
  }));

  return ok(topics);
}

async function createTopic(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const body = await req.json();

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return badRequest("name is required");
  }

  const db = createAdminClient();

  const { data, error } = await db
    .from("topics")
    .insert({
      tenant_id: auth.tenantId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      is_active: body.is_active !== undefined ? body.is_active : true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return conflict("A topic with this name already exists");
    }
    return serverError(error.message);
  }

  return created({ ...data, prompt_count: 0 });
}

async function updateTopic(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const body = await req.json();

  if (!body.id) return badRequest("id is required");

  const db = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0) {
    return badRequest("No fields to update");
  }

  const { data, error } = await db
    .from("topics")
    .update(updates)
    .eq("id", body.id)
    .eq("tenant_id", auth.tenantId)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return conflict("A topic with this name already exists");
    }
    return serverError(error.message);
  }
  if (!data) return notFound("Topic not found");

  return ok(data);
}

async function deleteTopic(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) return badRequest("id query parameter is required");

  const db = createAdminClient();

  const { error } = await db
    .from("topics")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) return serverError(error.message);

  return noContent();
}

// ────────────────────────────────────────────────────────────
// Prompts handlers
// ────────────────────────────────────────────────────────────

async function handlePrompts(req: Request): Promise<Response> {
  switch (req.method) {
    case "GET":
      return getPrompts(req);
    case "POST":
      return createPrompt(req);
    case "PUT":
      return updatePrompt(req);
    case "DELETE":
      return deletePrompt(req);
    default:
      return badRequest(`Method ${req.method} not allowed`);
  }
}

async function getPrompts(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const url = new URL(req.url);
  const topicId = url.searchParams.get("topicId");

  if (!topicId) return badRequest("topicId query parameter is required");

  const db = createAdminClient();

  const { data, error } = await db
    .from("prompts")
    .select("*")
    .eq("tenant_id", auth.tenantId)
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false });

  if (error) return serverError(error.message);

  return ok(data);
}

async function createPrompt(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const body = await req.json();

  if (!body.topic_id) return badRequest("topic_id is required");
  if (!body.text || typeof body.text !== "string" || !body.text.trim()) {
    return badRequest("text is required");
  }

  const db = createAdminClient();

  // Verify topic belongs to tenant
  const { data: topic } = await db
    .from("topics")
    .select("id")
    .eq("id", body.topic_id)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (!topic) return notFound("Topic not found");

  const { data, error } = await db
    .from("prompts")
    .insert({
      tenant_id: auth.tenantId,
      topic_id: body.topic_id,
      text: body.text.trim(),
      description: body.description?.trim() || null,
      is_active: body.is_active !== undefined ? body.is_active : true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return conflict("A prompt with this text already exists in this topic");
    }
    return serverError(error.message);
  }

  return created(data);
}

async function updatePrompt(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const body = await req.json();

  if (!body.id) return badRequest("id is required");

  const db = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (body.text !== undefined) updates.text = body.text.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0) {
    return badRequest("No fields to update");
  }

  const { data, error } = await db
    .from("prompts")
    .update(updates)
    .eq("id", body.id)
    .eq("tenant_id", auth.tenantId)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return conflict("A prompt with this text already exists in this topic");
    }
    return serverError(error.message);
  }
  if (!data) return notFound("Prompt not found");

  return ok(data);
}

async function deletePrompt(req: Request): Promise<Response> {
  const auth = await verifyAuth(req);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) return badRequest("id query parameter is required");

  const db = createAdminClient();

  const { error } = await db
    .from("prompts")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) return serverError(error.message);

  return noContent();
}
