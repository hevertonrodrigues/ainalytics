import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { ok, created, badRequest, serverError, conflict } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";

/**
 * Company Edge Function
 * - GET  → Returns the current tenant's company (or null)
 * - POST → Creates a new company for the tenant
 */

serve(async (req: Request) => {
  const logger = createRequestLogger("company", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { tenantId, user } = await verifyAuth(req);
    const authCtx = { tenant_id: tenantId, user_id: user.id };
    const db = createAdminClient();

    // Verify tenant membership
    const { data: tenantUser, error: tuErr } = await db
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single();

    if (tuErr || !tenantUser) {
      return logger.done(withCors(req, badRequest("User not found in tenant.")), authCtx);
    }

    switch (req.method) {
      case "GET": {
        // Fetch company belonging to this tenant
        const { data: company, error: cErr } = await db
          .from("companies")
          .select("*")
          .eq("tenant_id", tenantId)
          .single();

        if (cErr || !company) {
          return logger.done(withCors(req, ok(null)), authCtx);
        }

        // Fetch latest analysis for this company
        const { data: latestAnalysis } = await db
          .from("geo_analyses")
          .select("*")
          .eq("company_id", company.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        return logger.done(withCors(req, ok({
          ...company,
          latest_analysis: latestAnalysis || null,
        })), authCtx);
      }

      case "POST": {
        // Only owners and admins can create a company
        if (tenantUser.role !== "owner" && tenantUser.role !== "admin") {
          return logger.done(withCors(req, badRequest("Only owners and admins can create a company.")), authCtx);
        }

        // Check if tenant already has a company
        const { data: existingCompany } = await db
          .from("companies")
          .select("id")
          .eq("tenant_id", tenantId)
          .single();

        if (existingCompany) {
          return logger.done(withCors(req, conflict("This tenant already has a company linked.")), authCtx);
        }

        const body = await req.json();
        const { domain, description, target_language, company_name } = body;

        if (!domain || typeof domain !== "string" || domain.trim().length === 0) {
          return logger.done(withCors(req, badRequest("Domain is required.")), authCtx);
        }

        // Normalize domain
        let normalizedDomain = domain.trim().toLowerCase();
        if (normalizedDomain.startsWith("http://") || normalizedDomain.startsWith("https://")) {
          try {
            const parsed = new URL(normalizedDomain);
            normalizedDomain = parsed.hostname.toLowerCase();
          } catch {
            return logger.done(withCors(req, badRequest("Invalid domain URL.")), authCtx);
          }
        }

        // Remove www. prefix
        if (normalizedDomain.startsWith("www.")) {
          normalizedDomain = normalizedDomain.slice(4);
        }

        // Basic domain validation
        if (
          !normalizedDomain.includes(".") ||
          normalizedDomain.length > 253 ||
          /[^a-z0-9.-]/.test(normalizedDomain)
        ) {
          return logger.done(withCors(req, badRequest("Invalid domain format.")), authCtx);
        }

        // Create company
        const { data: company, error: createErr } = await db
          .from("companies")
          .insert({
            domain: normalizedDomain,
            description: description?.trim() || null,
            target_language: target_language || "en",
            tenant_id: tenantId,
            company_name: company_name?.trim() || null,
          })
          .select("*")
          .single();

        if (createErr || !company) {
          console.error("[company] Failed to create company:", createErr);
          return logger.done(withCors(req, serverError("Failed to create company.")), authCtx);
        }


        // Update tenant
        const tenantUpdates: Record<string, string> = {};
        if (company_name?.trim()) {
          tenantUpdates.name = company_name.trim();
        }
        if (normalizedDomain) {
          tenantUpdates.main_domain = normalizedDomain;
        }

        if (Object.keys(tenantUpdates).length > 0) {
          const { error: tenantErr } = await db
            .from("tenants")
            .update(tenantUpdates)
            .eq("id", tenantId);
            
          if (tenantErr) {
            console.error("[company] Failed to update tenant:", tenantErr);
            // Non-fatal, we still return success for company creation
          }
        }

        return logger.done(withCors(req, created(company)), authCtx);
      }

      case "PATCH": {
        // Only owners and admins can edit a company
        if (tenantUser.role !== "owner" && tenantUser.role !== "admin") {
          return logger.done(withCors(req, badRequest("Only owners and admins can edit a company.")), authCtx);
        }

        // Find company belonging to tenant
        const { data: patchCompany } = await db
          .from("companies")
          .select("id")
          .eq("tenant_id", tenantId)
          .single();

        if (!patchCompany) {
          return logger.done(withCors(req, badRequest("No company linked to this tenant.")), authCtx);
        }

        const patchBody = await req.json();
        const updates: Record<string, unknown> = {};

        if (patchBody.domain !== undefined) {
          let normalizedDomain = patchBody.domain.trim().toLowerCase();
          if (normalizedDomain.startsWith("http://") || normalizedDomain.startsWith("https://")) {
            try { normalizedDomain = new URL(normalizedDomain).hostname.toLowerCase(); } catch { /* keep as-is */ }
          }
          if (normalizedDomain.startsWith("www.")) normalizedDomain = normalizedDomain.slice(4);
          updates.domain = normalizedDomain;
        }
        if (patchBody.company_name !== undefined) {
          updates.company_name = patchBody.company_name?.trim() || null;
        }
        if (patchBody.description !== undefined) {
          updates.description = patchBody.description?.trim() || null;
        }
        if (patchBody.target_language !== undefined) {
          updates.target_language = patchBody.target_language;
        }

        if (Object.keys(updates).length === 0) {
          return logger.done(withCors(req, badRequest("No valid fields to update.")), authCtx);
        }

        updates.updated_at = new Date().toISOString();

        const { data: updatedCompany, error: updateErr } = await db
          .from("companies")
          .update(updates)
          .eq("id", patchCompany.id)
          .select("*")
          .single();

        if (updateErr || !updatedCompany) {
          console.error("[company] Failed to update company:", updateErr);
          return logger.done(withCors(req, serverError("Failed to update company.")), authCtx);
        }

        // Update tenant if name or domain changed
        const tenantUpdates: Record<string, string> = {};
        if (updates.domain) tenantUpdates.main_domain = updates.domain as string;
        if (updates.company_name !== undefined && updates.company_name !== null) {
            tenantUpdates.name = updates.company_name as string;
        }
        
        if (Object.keys(tenantUpdates).length > 0) {
           const { error: tenantErr } = await db
             .from("tenants")
             .update(tenantUpdates)
             .eq("id", tenantId);
           if (tenantErr) {
             console.error("[company] Failed to update tenant:", tenantErr);
             // Non-fatal, we still return success
           }
        }

        return logger.done(withCors(req, ok(updatedCompany)), authCtx);
      }

      default:
        return logger.done(withCors(req, badRequest(`Method ${req.method} not allowed`)), authCtx);
    }
  } catch (err: unknown) {
    console.error("[company]", err);
    const e = err as { status?: number; message?: string };
    if (e.status) {
      return logger.done(withCors(
        req,
        new Response(
          JSON.stringify({ success: false, error: { message: e.message, code: e.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
          { status: e.status, headers: { "Content-Type": "application/json" } },
        ),
      ));
    }
    return logger.done(withCors(req, serverError(e.message || "Internal server error")));
  }
});
