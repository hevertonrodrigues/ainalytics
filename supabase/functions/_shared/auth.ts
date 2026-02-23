import { createAdminClient } from "./supabase.ts";

/**
 * Auth context extracted from JWT.
 */
export interface AuthContext {
  user: { id: string; email: string };
  tenantId: string;
  token: string;
}

/**
 * Verify the JWT from the Authorization header and extract user + tenant.
 * Throws on invalid/missing auth.
 *
 * Tenant is resolved from:
 * 1. x-tenant-id header (explicit tenant selection)
 * 2. First active tenant membership (fallback)
 */
export async function verifyAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw { status: 401, message: "Missing Authorization header" };
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    throw { status: 401, message: "Invalid Authorization header" };
  }

  const db = createAdminClient();

  // Verify token with Supabase Auth
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);

  if (authError || !user) {
    throw { status: 401, message: "Invalid or expired token" };
  }

  // Resolve tenant
  const explicitTenantId = req.headers.get("x-tenant-id");
  let tenantId: string;

  if (explicitTenantId) {
    // Verify user belongs to this tenant
    const { data: membership } = await db
      .from("tenant_users")
      .select("tenant_id")
      .eq("tenant_id", explicitTenantId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!membership) {
      throw { status: 403, message: "Not a member of this tenant" };
    }
    tenantId = membership.tenant_id;
  } else {
    // Fallback: first active tenant
    const { data: firstMembership } = await db
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!firstMembership) {
      throw { status: 403, message: "User has no active tenant membership" };
    }
    tenantId = firstMembership.tenant_id;
  }

  return {
    user: { id: user.id, email: user.email || "" },
    tenantId,
    token,
  };
}
