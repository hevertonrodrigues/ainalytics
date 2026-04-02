/**
 * Shared subscription guard — blocks write operations for inactive subscriptions.
 *
 * Usage:
 *   import { requireActiveSubscription } from "../_shared/subscription-guard.ts";
 *
 *   const guardResponse = await requireActiveSubscription(db, tenantId);
 *   if (guardResponse) return guardResponse;
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { forbidden } from "./response.ts";

/**
 * Returns a 403 Response if the tenant does NOT have an active or trialing subscription.
 * Returns null if the tenant is allowed to proceed.
 */
export async function requireActiveSubscription(
  db: SupabaseClient,
  tenantId: string,
): Promise<Response | null> {
  const { data, error } = await db
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trialing"])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[subscription-guard] Error checking subscription:", error.message);
    // Fail-closed: deny if we can't verify
    return forbidden("Unable to verify subscription status");
  }

  if (!data) {
    return forbidden("An active subscription is required to perform this action");
  }

  return null;
}
