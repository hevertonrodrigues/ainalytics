/**
 * Google reCAPTCHA v3 — Server-side verification.
 * Shared by Edge Functions that accept public (unauthenticated) requests.
 */

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export interface RecaptchaResult {
  valid: boolean;
  score: number;
  action: string;
}

/**
 * Verifies a reCAPTCHA v3 token against Google's API.
 *
 * @param token      - The token from the client-side `grecaptcha.execute()`.
 * @param expectedAction - The action name to validate against.
 * @param minScore   - Minimum acceptable score (0.0–1.0). Default 0.5.
 * @returns          - `{ valid, score, action }`.
 *
 * If `RECAPTCHA_SECRET_KEY` is not set, returns `{ valid: true, score: 1, action: expectedAction }`
 * to allow local development without keys.
 */
export async function verifyRecaptcha(
  token: string | undefined | null,
  expectedAction: string,
  minScore = 0.5,
): Promise<RecaptchaResult> {
  const secret = Deno.env.get("RECAPTCHA_SECRET_KEY");

  // Skip verification in dev when secret is not configured
  if (!secret) {
    console.warn("[recaptcha] RECAPTCHA_SECRET_KEY not set — skipping verification");
    return { valid: true, score: 1, action: expectedAction };
  }

  if (!token) {
    console.warn("[recaptcha] No token provided");
    return { valid: false, score: 0, action: "" };
  }

  try {
    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });

    const data = await res.json();

    const valid =
      data.success === true &&
      (data.score ?? 0) >= minScore &&
      data.action === expectedAction;

    if (!valid) {
      console.warn("[recaptcha] Verification failed:", {
        success: data.success,
        score: data.score,
        action: data.action,
        expectedAction,
        errors: data["error-codes"],
      });
    }

    return {
      valid,
      score: data.score ?? 0,
      action: data.action ?? "",
    };
  } catch (err) {
    console.error("[recaptcha] Verification error:", err);
    return { valid: false, score: 0, action: "" };
  }
}
