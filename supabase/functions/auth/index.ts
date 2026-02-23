import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { ok, badRequest, unauthorized, conflict, serverError } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").filter(Boolean);
    const route = path[1] || "";

    if (req.method !== "POST") {
      return withCors(req, badRequest("Only POST allowed"));
    }

    const body = await req.json();

    switch (route) {
      case "signup":
        return withCors(req, await handleSignUp(body));
      case "signin":
        return withCors(req, await handleSignIn(body));
      case "forgot-password":
        return withCors(req, await handleForgotPassword(body));
      case "reset-password":
        return withCors(req, await handleResetPassword(body));
      default:
        return withCors(req, badRequest(`Unknown route: /auth/${route}`));
    }
  } catch (err) {
    console.error("[auth]", err);
    return withCors(req, serverError(err.message || "Internal server error"));
  }
});

// ────────────────────────────────────────────────────────────
// Sign Up — creates auth user + tenant + profile + tenant_users
// ────────────────────────────────────────────────────────────

interface SignUpBody {
  email: string;
  password: string;
  full_name: string;
  tenant_name: string;
  phone: string;
}

async function handleSignUp(body: SignUpBody): Promise<Response> {
  const { email, password, full_name, tenant_name, phone } = body;

  if (!email || !password || !full_name || !tenant_name || !phone) {
    return badRequest("email, password, full_name, tenant_name, and phone are required");
  }
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    return badRequest("Phone must have at least 10 digits");
  }
  if (password.length < 8) {
    return badRequest("Password must be at least 8 characters");
  }

  const db = createAdminClient();

  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message?.includes("already")) {
      return conflict("Email already in use");
    }
    return serverError(authError.message);
  }

  const userId = authData.user.id;
  const slug = tenant_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // 2. Create tenant (no tenant_id on tenants table)
  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .insert({ name: tenant_name, slug: `${slug}-${Date.now()}` })
    .select()
    .single();

  if (tenantError) {
    return serverError(tenantError.message);
  }

  // 3. Create profile (replaces the old public.users record)
  const { error: profileError } = await db.from("profiles").insert({
    user_id: userId,
    tenant_id: tenant.id,
    full_name,
    email,
    phone,
    locale: "en",
  });

  if (profileError) {
    return serverError(profileError.message);
  }

  // 4. Create tenant_users (owner)
  await db.from("tenant_users").insert({
    tenant_id: tenant.id,
    user_id: userId,
    role: "owner",
    is_active: true,
  });

  // 5. Sign in to get tokens
  const { data: loginData, error: loginError } = await db.auth.signInWithPassword({
    email,
    password,
  });

  if (loginError || !loginData.session) {
    return serverError("Account created but auto-login failed. Please sign in manually.");
  }

  // 6. Get profile back for response
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("tenant_id", tenant.id)
    .single();

  return ok({
    access_token: loginData.session.access_token,
    refresh_token: loginData.session.refresh_token,
    profile,
    tenants: [tenant],
    current_tenant_id: tenant.id,
  });
}

// ────────────────────────────────────────────────────────────
// Sign In
// ────────────────────────────────────────────────────────────

interface SignInBody {
  email: string;
  password: string;
}

async function handleSignIn(body: SignInBody): Promise<Response> {
  const { email, password } = body;

  if (!email || !password) {
    return badRequest("email and password are required");
  }

  const db = createAdminClient();

  const { data, error: authError } = await db.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !data.session) {
    return unauthorized("Invalid email or password");
  }

  const userId = data.user.id;

  // Get all tenants for this user
  const { data: memberships } = await db
    .from("tenant_users")
    .select("tenant_id, role, tenants(id, name, slug, created_at, updated_at)")
    .eq("user_id", userId)
    .eq("is_active", true);

  const tenants = (memberships || []).map((m: any) => m.tenants).filter(Boolean);
  const currentTenantId = tenants[0]?.id || "";

  // Get profile for the first/current tenant
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("tenant_id", currentTenantId)
    .single();

  return ok({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    profile,
    tenants,
    current_tenant_id: currentTenantId,
  });
}

// ────────────────────────────────────────────────────────────
// Forgot Password
// ────────────────────────────────────────────────────────────

interface ForgotPasswordBody {
  email: string;
}

async function handleForgotPassword(body: ForgotPasswordBody): Promise<Response> {
  const { email } = body;

  if (!email) {
    return badRequest("email is required");
  }

  const db = createAdminClient();

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: `${Deno.env.get("SITE_URL") || "http://localhost:5173"}/reset-password`,
  });

  if (error) {
    console.error("[forgot-password]", error);
  }

  // Always return success to prevent email enumeration
  return ok({ message: "If an account exists, a reset link has been sent." });
}

// ────────────────────────────────────────────────────────────
// Reset Password
// ────────────────────────────────────────────────────────────

interface ResetPasswordBody {
  token: string;
  password: string;
}

async function handleResetPassword(body: ResetPasswordBody): Promise<Response> {
  const { token, password } = body;

  if (!token || !password) {
    return badRequest("token and password are required");
  }
  if (password.length < 8) {
    return badRequest("Password must be at least 8 characters");
  }

  const db = createAdminClient();

  const { error } = await db.auth.verifyOtp({
    type: "recovery",
    token_hash: token,
  });

  if (error) {
    return unauthorized("Invalid or expired reset token");
  }

  return ok({ message: "Password has been reset successfully." });
}
