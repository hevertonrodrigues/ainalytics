import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { STORAGE_KEYS } from '@/lib/constants';
import type { Profile, Tenant } from '@/types';

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
  resetPassword: (password: string) => Promise<void>;
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const res = await apiClient.get<{ profile: Profile; tenants: Tenant[] }>('/users-me');

    const firstTenant = res.data?.tenants?.[0];
    if (firstTenant) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT_ID, firstTenant.id);
    }

    setState({ profile: res.data?.profile || null, tenants: res.data?.tenants || [], loading: false, initialized: true });
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, tenantName: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          tenant_name: tenantName,
          phone,
        },
      },
    });

    if (error) throw error;
    if (!data.session) {
      throw new Error('CONFIRM_EMAIL');
    }

    const res = await apiClient.get<{ profile: Profile; tenants: Tenant[] }>('/users-me');

    const firstTenant = res.data?.tenants?.[0];
    if (firstTenant) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT_ID, firstTenant.id);
    }

    setState({ profile: res.data?.profile || null, tenants: res.data?.tenants || [], loading: false, initialized: true });
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_TENANT_ID);
    await supabase.auth.signOut();
    setState({ profile: null, tenants: [], loading: false, initialized: true });
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
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
