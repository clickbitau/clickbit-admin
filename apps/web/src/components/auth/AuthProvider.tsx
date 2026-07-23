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
import { getSupabaseClient } from '@/lib/supabase';
import { checkTrust, trustDevice, verifyBackupCode } from '@/lib/api';
import { getSharedToken, getSharedRefreshToken, setSharedTokens, clearSharedTokens } from '@/lib/cookie';

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
  completeMfa: (factorId: string, code: string, trustDevice?: boolean) => Promise<void>;
  completeBackupCode: (code: string, rememberDevice?: boolean) => Promise<void>;
  cancelMfa: () => void;
  register: (data: RegisterData) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  sendMagicLink: (email: string) => Promise<{ message: string }>;
  oauthSignIn: (provider: string) => Promise<void>;
  linkOAuth: (provider: string) => Promise<void>;
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
const TRUST_TOKEN_KEY = 'clickbit:trust_token';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getDashboardPath(role?: string) {
  const r = (role || 'customer').toLowerCase();
  if (['admin', 'manager', 'employee'].includes(r)) return '/admin';
  if (r === 'agent') return '/agent/dashboard';
  return '/login';
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
      clearSharedTokens();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedToken = getSharedToken();
    const storedRefresh = getSharedRefreshToken();
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
    setSharedTokens(value, refresh);
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
    clearSharedTokens();
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
          const storedTrust = typeof window !== 'undefined' ? localStorage.getItem(TRUST_TOKEN_KEY) : null;
          if (storedTrust) {
            try {
              const trust = await checkTrust(result.accessToken, storedTrust);
              if (trust.data?.valid) {
                if (result.user?.role === 'customer') {
                  clearToken();
                  router.replace('/login?customer=1');
                  return result;
                }
                setToken(result.accessToken, result.refreshToken);
                if (result.user) setUser(result.user);
                router.replace(getDashboardPath(result.user?.role));
                return result;
              }
            } catch {
              // fall through to MFA
            }
          }
          setMfaRequired(true);
          setMfaFactors(result.factors || []);
          setMfaToken(result.accessToken);
          setMfaRefreshToken(result.refreshToken);
          return result;
        }
        if (result.user?.role === 'customer') {
          clearToken();
          router.replace('/login?customer=1');
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
    [router, setToken, clearMfa, clearToken],
  );

  const completeMfa = useCallback(
    async (factorId: string, code: string, rememberDevice = false) => {
      if (!mfaToken || !mfaRefreshToken) throw new Error('MFA session not available');
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Supabase client not configured');
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
          if (me.data.user.role === 'customer') {
            clearToken();
            router.replace('/login?customer=1');
            return;
          }
          setUser(me.data.user);
          if (rememberDevice) {
            try {
              const trusted = await trustDevice(data.access_token);
              if (typeof window !== 'undefined' && trusted.data?.token) {
                localStorage.setItem(TRUST_TOKEN_KEY, trusted.data.token);
              }
            } catch {
              // non-fatal
            }
          }
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
    [mfaToken, mfaRefreshToken, setToken, clearMfa, router, clearToken],
  );

  const completeBackupCode = useCallback(
    async (code: string, rememberDevice = false) => {
      if (!mfaToken || !mfaRefreshToken) throw new Error('MFA session not available');
      setLoading(true);
      setError(null);
      try {
        await verifyBackupCode(mfaToken, code, mfaRefreshToken);
        setToken(mfaToken, mfaRefreshToken);
        clearMfa();
        const { data: me } = await axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${mfaToken}` } });
        if (me?.data?.user) {
          if (me.data.user.role === 'customer') {
            clearToken();
            router.replace('/login?customer=1');
            return;
          }
          setUser(me.data.user);
          if (rememberDevice) {
            try {
              const trusted = await trustDevice(mfaToken);
              if (typeof window !== 'undefined' && trusted.data?.token) {
                localStorage.setItem(TRUST_TOKEN_KEY, trusted.data.token);
              }
            } catch {
              // non-fatal
            }
          }
          router.replace(getDashboardPath(me.data.user.role));
        }
      } catch (err: any) {
        const message = err?.response?.data?.message || err?.message || 'Backup code verification failed';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [mfaToken, mfaRefreshToken, setToken, clearMfa, router, clearToken],
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
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not configured');
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: { redirectTo: `${origin}/oauth/callback` },
    });
    if (error || !data.url) throw new Error(error?.message || 'OAuth sign in failed');
    window.location.href = data.url;
  }, []);

  const linkOAuth = useCallback(async (provider: string) => {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not configured');
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const auth = supabase.auth as any;
    const { data, error } = await auth.linkIdentity({
      provider: provider as any,
      options: { redirectTo: `${origin}/admin/settings/profile?oauth_link=1&provider=${encodeURIComponent(provider)}` },
    } as any);
    if (error || !data?.url) throw new Error(error?.message || 'OAuth link failed');
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
    completeBackupCode,
    cancelMfa,
    register,
    logout,
    forgotPassword,
    sendMagicLink,
    oauthSignIn,
    linkOAuth,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
