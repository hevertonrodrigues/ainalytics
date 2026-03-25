import { createAdminClient } from "./supabase.ts";

/**
 * Super Admin Auth context
 */
export interface AdminAuthContext {
  user: { id: string; email: string };
  token: string;
}

/**
 * Verify the JWT from the Authorization header and ensure the user has the is_sa flag.
 * Throws on invalid/missing auth or if the user is not a Super Admin.
 *
 * This uses standard Supabase Auth with an extra security layer.
 */
export async function verifySuperAdmin(req: Request): Promise<AdminAuthContext> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw { status: 401, message: "Missing Authorization header" };
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    throw { status: 401, message: "Invalid Authorization header" };
  }

  const db = createAdminClient();

  // 1. Standard Supabase Auth: Verify token
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);

  if (authError || !user) {
    throw { status: 401, message: "Invalid or expired token" };
  }

  // 2. Extra Security Layer: Verify is_sa flag in profiles table
  const { data: profile } = await db
    .from("profiles")
    .select("is_sa")
    .eq("user_id", user.id)
    .single();

  if (!profile || !profile.is_sa) {
    throw { status: 403, message: "Forbidden: Super Admin access required" };
  }

  return {
    user: { id: user.id, email: user.email || "" },
    token,
  };
}
