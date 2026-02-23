import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants';

/**
 * Supabase client — used for SELECT queries and auth state only.
 * NEVER use .insert(), .update(), .delete(), or .upsert() from the frontend.
 * All mutations must go through the apiClient (Edge Functions).
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
