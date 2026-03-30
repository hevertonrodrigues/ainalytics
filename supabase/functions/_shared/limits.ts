/**
 * Shared subscription limit checking utilities.
 *
 * Usage:
 *   import { checkPromptLimit, checkModelLimit } from "../_shared/limits.ts";
 *
 *   const check = await checkPromptLimit(db, tenantId);
 *   if (!check.allowed) return forbidden(`Prompt limit reached (${check.current}/${check.max})`);
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

interface LimitCheck {
  allowed: boolean;
  current: number;
  max: number | null; // null = unlimited
}

/**
 * Check if the tenant can create another prompt.
 * Counts active prompts vs the subscription's max_prompts.
 */
export async function checkPromptLimit(
  db: SupabaseClient,
  tenantId: string,
): Promise<LimitCheck> {
  const { data, error } = await db.rpc("get_tenant_subscription_limits", {
    p_tenant_id: tenantId,
  });

  if (error || !data || data.length === 0) {
    // No active subscription — deny by default
    return { allowed: false, current: 0, max: 0 };
  }

  const row = data[0];
  const max = row.max_prompts;
  const current = Number(row.current_prompt_count);

  // NULL max = unlimited
  if (max === null || max === undefined) {
    return { allowed: true, current, max: null };
  }

  return { allowed: current < max, current, max };
}

/**
 * Check if the tenant can activate another model.
 * Counts active tenant_platform_models vs the subscription's max_models.
 */
export async function checkModelLimit(
  db: SupabaseClient,
  tenantId: string,
): Promise<LimitCheck> {
  const { data, error } = await db.rpc("get_tenant_subscription_limits", {
    p_tenant_id: tenantId,
  });

  if (error || !data || data.length === 0) {
    // No active subscription — deny by default
    return { allowed: false, current: 0, max: 0 };
  }

  const row = data[0];
  const max = row.max_models;
  const current = Number(row.current_model_count);

  // NULL max = unlimited
  if (max === null || max === undefined) {
    return { allowed: true, current, max: null };
  }

  return { allowed: current < max, current, max };
}

/**
 * Get full subscription limits and usage for a tenant.
 * Used by the plans GET and dashboard-overview endpoints.
 */
export async function getSubscriptionLimits(
  db: SupabaseClient,
  tenantId: string,
): Promise<{
  max_prompts: number | null;
  max_models: number | null;
  refresh_frequency: string | null;
  current_prompts: number;
  current_models: number;
} | null> {
  const { data, error } = await db.rpc("get_tenant_subscription_limits", {
    p_tenant_id: tenantId,
  });

  if (error || !data || data.length === 0) {
    return null;
  }

  const row = data[0];
  return {
    max_prompts: row.max_prompts,
    max_models: row.max_models,
    refresh_frequency: row.refresh_frequency,
    current_prompts: Number(row.current_prompt_count),
    current_models: Number(row.current_model_count),
  };
}
