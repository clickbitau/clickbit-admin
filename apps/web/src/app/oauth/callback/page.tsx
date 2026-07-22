'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { Loader2, AlertCircle } from 'lucide-react';

const TOKEN_KEY = 'clickbit:access_token';
const REFRESH_KEY = 'clickbit:refresh_token';

function getDashboardPath(role?: string) {
  const r = (role || 'customer').toLowerCase();
  if (['admin', 'manager', 'employee'].includes(r)) return '/admin';
  if (r === 'agent') return '/agent/dashboard';
  return '/login';
}

function OAuthHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const code = searchParams.get('code');
  const provider = searchParams.get('provider');

  useEffect(() => {
    if (!code) {
      setError('No authorization code provided');
      return;
    }

    const exchange = async () => {
      try {
        const { data } = await axios.get(`/api/auth/callback?code=${encodeURIComponent(code)}${provider ? `&provider=${encodeURIComponent(provider)}` : ''}`);
        const result = data?.data;
        if (!result?.accessToken) throw new Error('OAuth callback failed');
        localStorage.setItem(TOKEN_KEY, result.accessToken);
        if (result.refreshToken) localStorage.setItem(REFRESH_KEY, result.refreshToken);
        router.replace(getDashboardPath(result.user?.role));
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message || 'OAuth sign in failed');
      }
    };

    exchange();
  }, [code, provider, router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center admin-surface px-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-semibold">Sign in failed</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-md text-center">{error}</p>
        <a href="/login" className="mt-6 text-primary hover:underline">
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center admin-surface">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <p className="text-sm text-muted-foreground">Completing sign in...</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center admin-surface">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    }>
      <OAuthHandler />
    </Suspense>
  );
}
