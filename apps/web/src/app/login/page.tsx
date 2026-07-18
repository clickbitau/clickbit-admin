'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Loader2, ShieldCheck, Fingerprint } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createPasskeyLoginOptions, verifyPasskeyLogin } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function getDashboardPath(role?: string) {
  const r = (role || 'customer').toLowerCase();
  if (['admin', 'manager'].includes(r)) return '/admin';
  if (r === 'agent') return '/agent/dashboard';
  if (r === 'employee') return '/employee/dashboard';
  return '/customer/dashboard';
}

export default function LoginPage() {
  const { user, loading, error, mfaRequired, mfaFactors, login, completeMfa, cancelMfa, clearError, oauthSignIn, sendMagicLink, setToken } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [selectedFactorId, setSelectedFactorId] = useState<string>('');
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  useEffect(() => {
    if (mfaRequired && mfaFactors.length > 0 && !selectedFactorId) {
      setSelectedFactorId(mfaFactors[0].id);
    }
  }, [mfaRequired, mfaFactors, selectedFactorId]);

  useEffect(() => {
    if (user && !loading && !mfaRequired) {
      router.replace(getDashboardPath(user.role));
    }
  }, [user, loading, mfaRequired, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();
    try {
      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFactorId || mfaCode.length < 6) return;
    setIsMfaLoading(true);
    try {
      await completeMfa(selectedFactorId, mfaCode, trustDevice);
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) return;
    setIsMagicLinkLoading(true);
    try {
      await sendMagicLink(email);
      setMagicLinkSent(true);
    } finally {
      setIsMagicLinkLoading(false);
    }
  };

  const handleOAuth = async (provider: string) => {
    setOauthLoading(provider);
    try {
      await oauthSignIn(provider);
    } catch (err: any) {
      alert(err.message || `${provider} sign in failed`);
      setOauthLoading(null);
    }
  };

  const handlePasskey = async () => {
    if (!window.PublicKeyCredential) {
      alert('Passkeys are not supported in this browser.');
      return;
    }
    setPasskeyLoading(true);
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const opts = await createPasskeyLoginOptions();
      const auth = await startAuthentication({ optionsJSON: opts.data });
      const res = await verifyPasskeyLogin({ ...auth, challenge: opts.data.challenge });
      setToken(res.data.accessToken, res.data.refreshToken);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        // cancelled
      } else {
        alert(err?.response?.data?.message || err?.message || 'Passkey sign in failed');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center admin-surface">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center admin-surface px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
        <div className="text-center">
          <div className="mx-auto mb-6 nm-raised-sm w-14 h-14 flex items-center justify-center rounded-2xl">
            <span className="text-primary font-bold text-2xl">C</span>
          </div>
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your account to continue</p>
        </div>

        <div className="nm-raised p-6 sm:p-8 rounded-3xl space-y-6">
          {mfaRequired ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 nm-raised-sm w-14 h-14 flex items-center justify-center rounded-2xl">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Two-factor authentication</h2>
                <p className="mt-2 text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
              </div>

              <form onSubmit={handleMfaSubmit} className="space-y-4">
                {mfaFactors.length > 1 && (
                  <div>
                    <Label htmlFor="factor">Authenticator</Label>
                    <select
                      id="factor"
                      value={selectedFactorId}
                      onChange={(e) => setSelectedFactorId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {mfaFactors.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.friendly_name || `${f.factor_type} authenticator`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <Label htmlFor="mfa-code">Authentication code</Label>
                  <Input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    minLength={6}
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="mt-1.5 text-center tracking-[0.5em] text-lg font-semibold"
                    placeholder="000000"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="rounded border-input"
                  />
                  Trust this device for 7 days
                </label>

                {error && (
                  <div className="rounded-xl bg-destructive/10 text-destructive text-sm p-3">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isMfaLoading || mfaCode.length < 6 || !selectedFactorId}>
                  {isMfaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  Verify
                </Button>

                <Button type="button" variant="outline" className="w-full" onClick={cancelMfa} disabled={isMfaLoading}>
                  Cancel
                </Button>
              </form>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email address</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot your password?
              </Link>
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 text-destructive text-sm p-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Sign in
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'google', label: 'Google' },
              { id: 'apple', label: 'Apple' },
              { id: 'facebook', label: 'Facebook' },
              { id: 'github', label: 'GitHub' },
            ].map((provider) => (
              <button
                key={provider.id}
                type="button"
                disabled={!!oauthLoading}
                onClick={() => handleOAuth(provider.id)}
                className="h-11 nm-raised-sm rounded-xl flex items-center justify-center text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                aria-label={`Sign in with ${provider.label}`}
                title={provider.label}
              >
                {oauthLoading === provider.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="uppercase text-xs">{provider.label[0]}</span>
                )}
              </button>
            ))}
          </div>

          <div>
            {magicLinkSent ? (
              <div className="rounded-xl bg-green-500/10 text-green-600 text-sm p-3 text-center">
                Check your email for the login link!
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isMagicLinkLoading || !email}
                onClick={handleMagicLink}
              >
                {isMagicLinkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                Email me a login link
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={passkeyLoading}
            onClick={handlePasskey}
          >
            {passkeyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Fingerprint className="h-4 w-4 mr-2" />}
            Sign in with passkey
          </Button>
        </>)}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary hover:underline">
            Sign up here
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
