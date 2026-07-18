'use client';

import { useEffect, useState } from 'react';
import { Smartphone, X, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

interface Factor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: 'verified' | 'unverified';
}

export function MfaSection() {
  const { token, refreshToken, setToken } = useAuth();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(false);
  const [enrollData, setEnrollData] = useState<{ id: string; qr_code: string; secret: string; uri: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');

  async function ensureSession() {
    if (!supabase || !token || !refreshToken) throw new Error('Session not available');
    const { error } = await supabase.auth.setSession({ access_token: token, refresh_token: refreshToken });
    if (error) throw new Error(error.message);
    return supabase;
  }

  async function loadFactors() {
    if (!supabase || !token || !refreshToken) return;
    setLoading(true);
    try {
      const client = await ensureSession();
      const { data, error } = await client.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(((data?.all as unknown as Factor[]) || []).filter((f) => !!f));
    } catch {
      setFactors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshToken]);

  async function startEnroll() {
    setLoading(true);
    try {
      const client = await ensureSession();
      const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp' });
      if (error || !data) throw error || new Error('Enrollment failed');
      setEnrollData({ id: data.id, qr_code: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri });
    } catch (e: any) {
      alert(e?.message || 'Could not start MFA enrollment');
    } finally {
      setLoading(false);
    }
  }

  async function verifyFactor() {
    if (!enrollData || verifyCode.length < 6) return;
    setLoading(true);
    try {
      const client = await ensureSession();
      const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId: enrollData.id, code: verifyCode });
      if (error || !data?.access_token) throw error || new Error('Invalid code');
      setToken(data.access_token, data.refresh_token);
      setEnrollData(null);
      setVerifyCode('');
      await loadFactors();
    } catch (e: any) {
      alert(e?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function removeFactor(id: string) {
    if (!confirm('Remove this authenticator?')) return;
    setLoading(true);
    try {
      const client = await ensureSession();
      const { error } = await client.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      await loadFactors();
    } catch (e: any) {
      alert(e?.message || 'Could not remove factor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Two-factor authentication</CardTitle>
        <CardDescription>Manage authenticator apps for your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {factors.length === 0 && !enrollData && <p className="text-sm text-muted-foreground">No authenticators set up.</p>}
        <div className="space-y-2">
          {factors.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{f.friendly_name || `${f.factor_type} authenticator`}</p>
                <p className="text-xs text-muted-foreground capitalize">{f.status}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => removeFactor(f.id)} disabled={loading}>Remove</Button>
            </div>
          ))}
        </div>

        {!enrollData ? (
          <Button type="button" variant="outline" onClick={startEnroll} disabled={loading} className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Add authenticator</Button>
        ) : (
          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Scan the QR code with your authenticator app</p>
              <button type="button" onClick={() => setEnrollData(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            {enrollData.qr_code && (
              <img src={enrollData.qr_code} alt="Authenticator QR code" className="mx-auto h-40 w-40" />
            )}
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Or enter this secret manually</p>
              <code className="rounded bg-muted px-2 py-1 text-xs break-all">{enrollData.secret}</code>
            </div>
            <div>
              <Label htmlFor="verify-code">6-digit code</Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center tracking-[0.5em] text-lg font-semibold"
              />
            </div>
            <Button type="button" onClick={verifyFactor} disabled={loading || verifyCode.length < 6}>Verify and enable</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
