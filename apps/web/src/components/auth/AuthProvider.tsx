'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AuthContextValue {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'clickbit-staged:access_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    setTokenState(stored);
    setMounted(true);
  }, []);

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
  };

  if (!mounted) {
    return null;
  }

  if (!token) {
    return (
      <AuthContext.Provider value={{ token: null, setToken, clearToken }}>
        <TokenGate onSetToken={setToken} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ token, setToken, clearToken }}>
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
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 shadow-sm"
      >
        <h1 className="text-2xl font-semibold">Admin Access</h1>
        <p className="text-sm text-muted-foreground">
          Paste a Supabase Bearer access token to view the companies list.
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
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
