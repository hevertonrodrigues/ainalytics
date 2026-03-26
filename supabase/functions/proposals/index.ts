import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, created, badRequest, notFound, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/** Generate a URL-safe slug like "prop-a1b2c3d4" */
function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `prop-${id}`;
}

serve(async (req: Request) => {
  const logger = createRequestLogger("proposals", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    // segments: ["proposals"] or ["proposals", "public", ":slug"] or ["proposals", ":id"]

    const db = createAdminClient();

    // ── Public route: GET /proposals/public/:slug ──
    if (segments[1] === "public" && segments[2] && req.method === "GET") {
      const slug = segments[2];

      const { data: proposal, error: fetchErr } = await db
        .from("proposals")
        .select("*, plans(name, price, settings, features)")
        .eq("slug", slug)
        .neq("status", "draft")
        .single();

      if (fetchErr || !proposal) {
        return logger.done(withCors(req, notFound("Proposal not found")));
      }

      // Check expiration
      if (proposal.valid_until && new Date(proposal.valid_until) < new Date()) {
        // Mark as expired if not already
        if (proposal.status !== "expired") {
          await db.from("proposals").update({ status: "expired" }).eq("id", proposal.id);
          proposal.status = "expired";
        }
      }

      // Record first view
      if (!proposal.viewed_at && proposal.status === "sent") {
        const now = new Date().toISOString();
        await db
          .from("proposals")
          .update({ viewed_at: now, status: "viewed" })
          .eq("id", proposal.id);
        proposal.viewed_at = now;
        proposal.status = "viewed";
      }

      // Fetch user/tenant info for display
      let companyName = null;
      let companyDomain = null;
      if (proposal.tenant_id) {
        const { data: company } = await db
          .from("companies")
          .select("company_name, domain")
          .eq("tenant_id", proposal.tenant_id)
          .limit(1)
          .single();
        if (company) {
          companyName = company.company_name;
          companyDomain = company.domain;
        }
      }

      // Return public-safe data (strip internal fields)
      const publicData = {
        slug: proposal.slug,
        custom_plan_name: proposal.custom_plan_name,
        custom_price: proposal.custom_price,
        billing_interval: proposal.billing_interval,
        currency: proposal.currency,
        custom_features: proposal.custom_features,
        custom_description: proposal.custom_description,
        status: proposal.status,
        valid_until: proposal.valid_until,
        viewed_at: proposal.viewed_at,
        created_at: proposal.created_at,
        base_plan: proposal.plans
          ? {
              name: proposal.plans.name,
              price: proposal.plans.price,
            }
          : null,
        company_name: companyName,
        company_domain: companyDomain,
      };

      return logger.done(withCors(req, ok(publicData)));
    }

    // ── All other routes require Super Admin auth ──
    const { user } = await verifySuperAdmin(req);
    const authCtx = { user_id: user.id };

    switch (req.method) {
      // ── GET /proposals?user_id=X ──
      case "GET": {
        const userId = url.searchParams.get("user_id");
        if (!userId) {
          return logger.done(
            withCors(req, badRequest("user_id query parameter is required")),
            authCtx,
          );
        }

        const { data, error: listErr } = await db
          .from("proposals")
          .select("*, plans(name)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (listErr) throw listErr;
        return logger.done(withCors(req, ok(data)), authCtx);
      }

      // ── POST /proposals ──
      case "POST": {
        const body = await req.json();

        if (!body.custom_plan_name) {
          return logger.done(
            withCors(req, badRequest("custom_plan_name is required")),
            authCtx,
          );
        }
        if (body.custom_price == null || body.custom_price < 0) {
          return logger.done(
            withCors(req, badRequest("custom_price is required and must be >= 0")),
            authCtx,
          );
        }

        // Generate unique slug
        let slug = generateSlug();
        let attempts = 0;
        while (attempts < 5) {
          const { data: existing } = await db
            .from("proposals")
            .select("id")
            .eq("slug", slug)
            .single();
          if (!existing) break;
          slug = generateSlug();
          attempts++;
        }

        const insertData = {
          slug,
          user_id: body.user_id || null,
          tenant_id: body.tenant_id || null,
          created_by: user.id,
          plan_id: body.plan_id || null,
          custom_plan_name: body.custom_plan_name,
          custom_price: body.custom_price,
          billing_interval: body.billing_interval || "monthly",
          currency: body.currency || "usd",
          custom_features: body.custom_features || {},
          custom_description: body.custom_description || {},
          notes: body.notes || null,
          status: body.status || "draft",
          valid_until: body.valid_until || null,
        };

        const { data, error: insertErr } = await db
          .from("proposals")
          .insert(insertData)
          .select()
          .single();

        if (insertErr) throw insertErr;
        return logger.done(withCors(req, created(data)), authCtx);
      }

      // ── PUT /proposals/:id ──
      case "PUT": {
        const proposalId = segments[1];
        if (!proposalId) {
          return logger.done(
            withCors(req, badRequest("Proposal ID is required in path")),
            authCtx,
          );
        }

        const body = await req.json();

        // Build update object (only include provided fields)
        // deno-lint-ignore no-explicit-any
        const updateData: Record<string, any> = {};
        const allowedFields = [
          "custom_plan_name",
          "custom_price",
          "billing_interval",
          "currency",
          "custom_features",
          "custom_description",
          "notes",
          "status",
          "valid_until",
          "plan_id",
        ];

        for (const field of allowedFields) {
          if (body[field] !== undefined) {
            updateData[field] = body[field];
          }
        }

        if (Object.keys(updateData).length === 0) {
          return logger.done(
            withCors(req, badRequest("No fields to update")),
            authCtx,
          );
        }

        const { data, error: updateErr } = await db
          .from("proposals")
          .update(updateData)
          .eq("id", proposalId)
          .select()
          .single();

        if (updateErr) throw updateErr;
        if (!data) {
          return logger.done(
            withCors(req, notFound("Proposal not found")),
            authCtx,
          );
        }

        return logger.done(withCors(req, ok(data)), authCtx);
      }

      // ── DELETE /proposals/:id ──
      case "DELETE": {
        const proposalId = segments[1];
        if (!proposalId) {
          return logger.done(
            withCors(req, badRequest("Proposal ID is required in path")),
            authCtx,
          );
        }

        const { error: deleteErr } = await db
          .from("proposals")
          .delete()
          .eq("id", proposalId);

        if (deleteErr) throw deleteErr;

        return logger.done(
          withCors(
            req,
            new Response(null, { status: 204 }),
          ),
          authCtx,
        );
      }

      default:
        return logger.done(
          withCors(req, badRequest(`Method ${req.method} not allowed`)),
          authCtx,
        );
    }
    // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[proposals]", err);
    if (err.status) {
      return logger.done(
        withCors(
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
        ),
      );
    }
    return logger.done(withCors(req, serverError(err.message || "Internal server error")));
  }
});
