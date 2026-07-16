'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';

interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  avatar?: string | null;
}

interface AuthContextValue {
  token: string | null;
  user: UserProfile | null;
  setToken: (token: string) => void;
  clearToken: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'clickbit-staged:access_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    setTokenState(stored);
    setMounted(true);
  }, []);

  const fetchUser = useCallback(async (t: string) => {
    try {
      const { data } = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (data?.data?.user) setUser(data.data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (token) fetchUser(token);
    else setUser(null);
  }, [token, fetchUser]);

  const setToken = (value: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, value);
    }
    setTokenState(value);
  };

  const clearToken = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setTokenState(null);
    setUser(null);
  };

  if (!mounted) {
    return null;
  }

  if (!token) {
    return (
      <AuthContext.Provider value={{ token: null, user: null, setToken, clearToken }}>
        <TokenGate onSetToken={setToken} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ token, user, setToken, clearToken }}>
      {children}
    </AuthContext.Provider>
  );
}

function TokenGate({ onSetToken }: { onSetToken: (token: string) => void }) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onSetToken(trimmed);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl nm-raised p-8"
      >
        <div className="flex items-center gap-3">
          <div className="nm-raised-sm w-10 h-10 flex items-center justify-center">
            <span className="text-primary font-bold text-lg">C</span>
          </div>
          <h1 className="text-2xl font-bold">Admin Access</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste a Supabase Bearer access token to view the admin dashboard.
        </p>
        <Input
          type="password"
          placeholder="eyJhbGciOiJIUzI1NiIs..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <Button type="submit" className="w-full">
          Continue
        </Button>
      </form>
    </div>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
