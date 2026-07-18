'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  avatar?: string | null;
}

interface MfaFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
}

interface AuthContextValue {
  token: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  mfaRequired: boolean;
  mfaFactors: MfaFactor[];
  setToken: (token: string, refreshToken?: string) => void;
  clearToken: () => void;
  login: (email: string, password: string) => Promise<{ user: UserProfile; accessToken: string; refreshToken: string; requiresMfa?: boolean }>;
  completeMfa: (factorId: string, code: string) => Promise<void>;
  cancelMfa: () => void;
  register: (data: RegisterData) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  sendMagicLink: (email: string) => Promise<{ message: string }>;
  oauthSignIn: (provider: string) => Promise<void>;
  clearError: () => void;
}

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

const TOKEN_KEY = 'clickbit:access_token';
const REFRESH_KEY = 'clickbit:refresh_token';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getDashboardPath(role?: string) {
  const r = (role || 'customer').toLowerCase();
  if (['admin', 'manager', 'employee'].includes(r)) return '/admin';
  if (r === 'agent') return '/agent/dashboard';
  return '/customer/dashboard';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token, setTokenState] = useState<string | null>(null);
  const [refreshToken, setRefreshTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaRefreshToken, setMfaRefreshToken] = useState<string | null>(null);

  const fetchUser = useCallback(async (t: string) => {
    try {
      const { data } = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (data?.data?.user) {
        setUser(data.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedRefresh = localStorage.getItem(REFRESH_KEY);
    setTokenState(storedToken);
    setRefreshTokenState(storedRefresh);
    if (storedToken) {
      fetchUser(storedToken);
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  useEffect(() => {
    if (token) fetchUser(token);
  }, [token, fetchUser]);

  const setToken = useCallback((value: string, refresh?: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, value);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    }
    setTokenState(value);
    if (refresh) setRefreshTokenState(refresh);
  }, []);

  const clearMfa = useCallback(() => {
    setMfaRequired(false);
    setMfaFactors([]);
    setMfaToken(null);
    setMfaRefreshToken(null);
  }, []);

  const clearToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    }
    setTokenState(null);
    setRefreshTokenState(null);
    setUser(null);
    clearMfa();
  }, [clearMfa]);

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      clearMfa();
      try {
        const { data } = await axios.post('/api/auth/login', { email, password });
        const result = data?.data;
        if (!result?.accessToken) throw new Error('Login failed');
        if (result.requiresMfa) {
          setMfaRequired(true);
          setMfaFactors(result.factors || []);
          setMfaToken(result.accessToken);
          setMfaRefreshToken(result.refreshToken);
          return result;
        }
        setToken(result.accessToken, result.refreshToken);
        if (result.user) setUser(result.user);
        router.replace(getDashboardPath(result.user?.role));
        return result;
      } catch (err: any) {
        const message = err?.response?.data?.message || err.message || 'Login failed';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [router, setToken, clearMfa],
  );

  const completeMfa = useCallback(
    async (factorId: string, code: string) => {
      if (!mfaToken || !mfaRefreshToken || !supabase) throw new Error('MFA session not available');
      setLoading(true);
      setError(null);
      try {
        const { error: sessionError } = await supabase.auth.setSession({ access_token: mfaToken, refresh_token: mfaRefreshToken });
        if (sessionError) throw new Error(sessionError.message);
        const { data, error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
        if (verifyError || !data?.access_token) throw new Error(verifyError?.message || 'Invalid MFA code');
        setToken(data.access_token, data.refresh_token);
        clearMfa();
        const { data: me } = await axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${data.access_token}` } });
        if (me?.data?.user) {
          setUser(me.data.user);
          router.replace(getDashboardPath(me.data.user.role));
        }
      } catch (err: any) {
        const message = err?.message || 'MFA verification failed';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [mfaToken, mfaRefreshToken, setToken, clearMfa, router],
  );

  const cancelMfa = useCallback(() => {
    clearMfa();
    setError(null);
  }, [clearMfa]);

  const register = useCallback(
    async (data: RegisterData) => {
      setLoading(true);
      setError(null);
      try {
        const { data: response } = await axios.post('/api/auth/register', data);
        return { message: response?.message || 'Registration successful' };
      } catch (err: any) {
        const message = err?.response?.data?.message || err.message || 'Registration failed';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await axios.post('/api/auth/logout', {});
    } finally {
      clearToken();
      router.replace('/login');
    }
  }, [clearToken, router]);

  const forgotPassword = useCallback(
    async (email: string) => {
      setError(null);
      try {
        const { data } = await axios.post('/api/auth/forgot-password', { email });
        return { message: data?.message || 'Reset email sent' };
      } catch (err: any) {
        const message = err?.response?.data?.message || err.message || 'Failed to send reset email';
        setError(message);
        throw new Error(message);
      }
    },
    [],
  );

  const sendMagicLink = useCallback(
    async (email: string) => {
      setError(null);
      try {
        const { data } = await axios.post('/api/auth/magic-link', { email });
        return { message: data?.message || 'Magic link sent' };
      } catch (err: any) {
        const message = err?.response?.data?.message || err.message || 'Failed to send magic link';
        setError(message);
        throw new Error(message);
      }
    },
    [],
  );

  const oauthSignIn = useCallback(async (provider: string) => {
    if (!supabase) throw new Error('Supabase client not configured');
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: { redirectTo: `${origin}/oauth/callback` },
    });
    if (error || !data.url) throw new Error(error?.message || 'OAuth sign in failed');
    window.location.href = data.url;
  }, []);

  const value: AuthContextValue = {
    token,
    refreshToken,
    user,
    loading,
    error,
    mfaRequired,
    mfaFactors,
    setToken,
    clearToken,
    login,
    completeMfa,
    cancelMfa,
    register,
    logout,
    forgotPassword,
    sendMagicLink,
    oauthSignIn,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
