// blog-newsletter — POST /blog-newsletter/register
// Single-opt-in subscription. Rate-limited per IP.
// Body: { email, lang, source?, topics?, consent, captchaToken? }
// 202 → { status: "subscribed", subscriberId }
// 409 → already subscribed
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleOriginCors, withOriginCors } from "../_shared/blog-cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { errors, jsonResponse } from "../_shared/blog-response.ts";
import { isSupportedLang, type Lang } from "../_shared/blog-langs.ts";
import { createRequestLogger } from "../_shared/logger.ts";
import { verifyRecaptcha } from "../_shared/verify-recaptcha.ts";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function ipHash(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = (h * 31 + ip.charCodeAt(i)) | 0;
  return `ip-${(h >>> 0).toString(36)}`;
}

function randomToken(len = 32): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function rateLimit(req: Request): { allowed: boolean; retryAfterSeconds?: number } {
  const key = ipHash(req);
  const now = Date.now();
  const current = rateLimitBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (current.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count += 1;
  return { allowed: true };
}

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-newsletter", req);
  if (req.method === "OPTIONS") return handleOriginCors(req);

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const action = segments[1];

    if (action !== "register") {
      return logger.done(withOriginCors(req, errors.notFound(`Unknown action '${action}'`)));
    }
    if (req.method !== "POST") {
      return logger.done(withOriginCors(req, errors.badRequest(`Method ${req.method} not allowed`)));
    }

    const limited = rateLimit(req);
    if (!limited.allowed) {
      return logger.done(withOriginCors(req, errors.rateLimited(limited.retryAfterSeconds ?? 60)));
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const lang = String(body.lang || "pt").toLowerCase();
    const source = body.source ? String(body.source).slice(0, 64) : null;
    const topics = Array.isArray(body.topics) ? body.topics.map(String).slice(0, 20) : [];
    const consent = Boolean(body.consent);
    const captchaToken = body.captchaToken ? String(body.captchaToken) : null;

    if (!isEmail(email)) {
      return logger.done(withOriginCors(req, errors.validation("Invalid email", { field: "email" })));
    }
    if (!isSupportedLang(lang)) {
      return logger.done(withOriginCors(req, errors.invalidFilter("lang", lang)));
    }
    if (!consent) {
      return logger.done(withOriginCors(req, errors.validation("Consent is required", { field: "consent" })));
    }

    // Optional reCAPTCHA — only enforced when both the secret AND a token are present.
    if (Deno.env.get("RECAPTCHA_SECRET_KEY") && captchaToken) {
      const recap = await verifyRecaptcha(captchaToken, "newsletter_register").catch(() => ({ valid: false } as const));
      if (!recap.valid) {
        return logger.done(withOriginCors(req, errors.validation("Captcha verification failed", { field: "captchaToken" })));
      }
    }

    const db = createAdminClient();

    const { data: existing } = await db
      .from("blog_newsletter_subscribers")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (existing && existing.status === "active") {
      return logger.done(withOriginCors(req, await jsonResponse(
        { error: "conflict", message: "Already subscribed" },
        { status: 409, cacheControl: "no-store" },
      )));
    }

    const unsubscribeToken = randomToken();
    const insert = {
      email,
      lang: lang as Lang,
      topics,
      source,
      status: "active" as const,        // single opt-in
      confirmation_token: null,
      unsubscribe_token: unsubscribeToken,
      ip_hash: ipHash(req),
      user_agent: req.headers.get("user-agent") || null,
      confirmed_at: new Date().toISOString(),
    };

    let subscriberId: number;
    if (existing) {
      const { data, error } = await db
        .from("blog_newsletter_subscribers")
        .update(insert)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      subscriberId = (data as { id: number }).id;
    } else {
      const { data, error } = await db
        .from("blog_newsletter_subscribers")
        .insert(insert)
        .select("id")
        .single();
      if (error) throw error;
      subscriberId = (data as { id: number }).id;
    }

    return logger.done(withOriginCors(req, await jsonResponse(
      { status: "subscribed", subscriberId: `sub_${subscriberId}` },
      { status: 202, cacheControl: "no-store" },
    )));
  } catch (err) {
    console.error("[blog-newsletter]", err);
    return logger.done(withOriginCors(req, errors.internal()));
  }
});
