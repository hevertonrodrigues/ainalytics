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

/** Escape HTML for safe embedding in meta tags */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

serve(async (req: Request) => {
  const logger = createRequestLogger("proposals", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    // segments: ["proposals"] or ["proposals", "public", ":slug"] or ["proposals", ":id"]

    const db = createAdminClient();

    // ── Public route: GET /proposals/public/:slug/og — SSR HTML for social sharing ──
    if (segments[1] === "public" && segments[2] && segments[3] === "og" && req.method === "GET") {
      const slug = segments[2];
      const variant = url.searchParams.get("v") || ""; // "full" for full presentation page

      const { data: proposal } = await db
        .from("proposals")
        .select("custom_plan_name, status, theme, slug, user_id, tenant_id, client_name")
        .eq("slug", slug)
        .neq("status", "draft")
        .single();

      if (!proposal) {
        return logger.done(withCors(req, notFound("Proposal not found")));
      }

      // Fetch company name for richer OG description
      let companyName = "";
      if (proposal.tenant_id) {
        const { data: company } = await db
          .from("companies")
          .select("company_name")
          .eq("tenant_id", proposal.tenant_id)
          .limit(1)
          .single();
        if (company) companyName = company.company_name || "";
      }

      const clientName = proposal.client_name || "";
      const planName = proposal.custom_plan_name || "Custom Proposal";
      const title = `${planName} — Ainalytics`;
      const desc = clientName
        ? `Custom proposal for ${clientName}${companyName ? ` at ${companyName}` : ""}`
        : `Custom proposal${companyName ? ` for ${companyName}` : ""}`;
      const ogImage = `https://api.dicebear.com/9.x/shapes/svg?seed=${slug}&backgroundColor=4f46e5&size=1200`;
      const isDark = (proposal.theme || "dark") === "dark";
      const bgColor = isDark ? "#0a0a0f" : "#f8f9fc";
      const textColor = isDark ? "#ffffff" : "#1a1a2e";

      // Canonical SPA URL
      const siteUrl = "https://ainalytics.tech";
      const spaPath = variant === "full" ? `/proposal/${slug}/full` : `/proposal/${slug}`;
      const canonicalUrl = `${siteUrl}${spaPath}`;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="theme-color" content="${bgColor}" />
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <meta name="googlebot" content="noindex, nofollow, noarchive" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${esc(ogImage)}" />
  <meta property="og:site_name" content="Ainalytics" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${esc(ogImage)}" />

  <link rel="canonical" href="${esc(canonicalUrl)}" />
  <meta http-equiv="refresh" content="0;url=${esc(canonicalUrl)}" />
  <style>
    body{margin:0;padding:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${bgColor};color:${textColor}}
    a{color:#6366f1;text-decoration:none}
  </style>
</head>
<body>
  <p>Redirecting to <a href="${esc(canonicalUrl)}">${esc(planName)}</a>…</p>
  <script>window.location.replace(${JSON.stringify(canonicalUrl)})</script>
</body>
</html>`;

      return logger.done(new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      }));
    }

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
      let clientName = null;

      if (proposal.user_id) {
        const { data: profile } = await db
          .from("profiles")
          .select("full_name")
          .eq("id", proposal.user_id)
          .single();
        if (profile) {
          clientName = profile.full_name;
        }
      }

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
        client_name: clientName,
        company_name: companyName,
        company_domain: companyDomain,
        theme: proposal.theme || 'dark',
        default_lang: proposal.default_lang || 'en',
      };

      return logger.done(withCors(req, ok(publicData)));
    }

    // ── Public route: POST /proposals/public/:slug/accept ──
    if (segments[1] === "public" && segments[2] && segments[3] === "accept" && req.method === "POST") {
      const slug = segments[2];
      const body = await req.json();
      const submittedEmail = (body.email || "").trim().toLowerCase();

      if (!submittedEmail) {
        return logger.done(withCors(req, badRequest("email is required")));
      }

      // Fetch proposal
      const { data: proposal, error: fetchErr } = await db
        .from("proposals")
        .select("id, user_id, status")
        .eq("slug", slug)
        .single();

      if (fetchErr || !proposal) {
        return logger.done(withCors(req, notFound("Proposal not found")));
      }

      // Only allow acceptance for sent/viewed proposals
      if (!["sent", "viewed"].includes(proposal.status)) {
        return logger.done(withCors(req, badRequest("This proposal cannot be accepted in its current status")));
      }

      // Fetch user email from profiles
      if (!proposal.user_id) {
        return logger.done(withCors(req, badRequest("This proposal has no associated user")));
      }

      const { data: profile } = await db
        .from("profiles")
        .select("email")
        .eq("id", proposal.user_id)
        .single();

      if (!profile || !profile.email) {
        return logger.done(withCors(req, badRequest("User profile not found")));
      }

      // Compare emails (case-insensitive)
      if (submittedEmail !== profile.email.trim().toLowerCase()) {
        return logger.done(withCors(req, new Response(
          JSON.stringify({ success: false, error: { message: "Email does not match", code: "EMAIL_MISMATCH" } }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        )));
      }

      // Accept the proposal
      const { error: updateErr } = await db
        .from("proposals")
        .update({ status: "accepted" })
        .eq("id", proposal.id);

      if (updateErr) throw updateErr;

      return logger.done(withCors(req, ok({ accepted: true })));
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
          theme: body.theme || "dark",
          default_lang: body.default_lang || "en",
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
