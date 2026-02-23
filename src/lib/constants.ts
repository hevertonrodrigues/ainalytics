export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Ainalytics';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export const LOCALES = {
  EN: 'en',
  ES: 'es',
  PT_BR: 'pt-br',
} as const;

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  CURRENT_TENANT_ID: 'current_tenant_id',
} as const;

export const EDGE_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;
