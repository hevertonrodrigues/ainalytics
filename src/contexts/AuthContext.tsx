import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { STORAGE_KEYS } from '@/lib/constants';
import type { Profile, Tenant, AuthSession } from '@/types';

interface AuthState {
  profile: Profile | null;
  tenants: Tenant[];
  loading: boolean;
  initialized: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, tenantName: string, phone: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    profile: null,
    tenants: [],
    loading: true,
    initialized: false,
  });

  // Restore session from stored tokens
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      // Set Supabase session for RLS queries (fire-and-forget)
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || '';
      supabase.auth.setSession({ access_token: token, refresh_token: refreshToken }).catch(() => {});

      apiClient
        .get<{ profile: Profile; tenants: Tenant[] }>('/users-me')
        .then((res) => {
          setState({
            profile: res.data.profile,
            tenants: res.data.tenants,
            loading: false,
            initialized: true,
          });
        })
        .catch(() => {
          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          setState({ profile: null, tenants: [], loading: false, initialized: true });
        });
    } else {
      setState({ profile: null, tenants: [], loading: false, initialized: true });
    }
  }, []);

  // Listen to Supabase auth state changes for token refresh
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, session.access_token);
        if (session.refresh_token) {
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, session.refresh_token);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<AuthSession>('/auth/signin', { email, password });
    const { access_token, refresh_token, profile, tenants, current_tenant_id } = res.data;

    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
    localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT_ID, current_tenant_id);

    // Set Supabase session for direct RLS queries (fire-and-forget, don't block)
    supabase.auth.setSession({ access_token, refresh_token }).catch(() => {});

    // Tokens are saved — the caller will do window.location.href = '/' for a full reload
    setState({ profile, tenants, loading: false, initialized: true });
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, tenantName: string, phone: string) => {
    const res = await apiClient.post<AuthSession>('/auth/signup', {
      email,
      password,
      full_name: fullName,
      tenant_name: tenantName,
      phone,
    });
    const { access_token, refresh_token, profile, tenants, current_tenant_id } = res.data;

    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
    localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT_ID, current_tenant_id);

    // Set Supabase session for direct RLS queries (fire-and-forget, don't block)
    supabase.auth.setSession({ access_token, refresh_token }).catch(() => {});

    // Tokens are saved — the caller will do window.location.href = '/' for a full reload
    setState({ profile, tenants, loading: false, initialized: true });
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_TENANT_ID);
    supabase.auth.signOut().catch(() => {});
    setState({ profile: null, tenants: [], loading: false, initialized: true });
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    await apiClient.post('/auth/forgot-password', { email });
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    await apiClient.post('/auth/reset-password', { token, password });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut, forgotPassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
