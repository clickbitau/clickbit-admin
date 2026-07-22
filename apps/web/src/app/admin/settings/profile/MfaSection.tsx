'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Smartphone, X, Shield, Key, Copy, RefreshCw, Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { fetchMfaFactors, generateBackupCodes, listBackupCodes } from '@/lib/api';

interface Factor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: 'verified' | 'unverified';
}

export function MfaSection() {
  const { token, refreshToken, setToken } = useAuth();
  const queryClient = useQueryClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(false);
  const [enrollData, setEnrollData] = useState<{ id: string; qr_code: string; secret: string; uri: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [revealCodes, setRevealCodes] = useState<Record<number, boolean>>({});

  async function ensureSession() {
    if (!supabase || !token || !refreshToken) throw new Error('Session not available');
    const { error } = await supabase.auth.setSession({ access_token: token, refresh_token: refreshToken });
    if (error) throw new Error(error.message);
    return supabase;
  }

  const factorsQuery = useQuery({
    queryKey: ['mfa-factors', token],
    queryFn: async () => {
      if (!token) return { data: { factors: [] } };
      return fetchMfaFactors(token);
    },
    enabled: !!token,
  });

  useEffect(() => {
    const raw = (factorsQuery.data?.data?.factors ?? factorsQuery.data?.factors ?? []) as Factor[];
    setFactors(raw.filter((f) => !!f));
    setLoading(factorsQuery.isLoading);
  }, [factorsQuery.data, factorsQuery.isLoading]);

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
      queryClient.invalidateQueries({ queryKey: ['mfa-factors', token] });
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
      queryClient.invalidateQueries({ queryKey: ['mfa-factors', token] });
    } catch (e: any) {
      alert(e?.message || 'Could not remove factor');
    } finally {
      setLoading(false);
    }
  }

  const backupCodesQuery = useQuery({
    queryKey: ['backup-codes', token],
    queryFn: async () => {
      if (!token) return { success: true, data: [] };
      return listBackupCodes(token);
    },
    enabled: !!token,
  });

  const generateBackupCodesMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      const res = await generateBackupCodes(token);
      return res;
    },
    onSuccess: (res) => {
      setNewBackupCodes(res.data?.codes ?? []);
      setCopiedAll(false);
      queryClient.invalidateQueries({ queryKey: ['backup-codes', token] });
    },
    onError: (err: Error) => alert(err?.message || 'Could not generate backup codes'),
  });

  const backupStatuses = useMemo(() => (backupCodesQuery.data?.data ?? []) as { id: number; used_at: string | null; created_at: string }[], [backupCodesQuery.data]);
  const maskedCodes = useMemo(() => newBackupCodes?.map((c) => c.replace(/[^-]/g, '•')) ?? [], [newBackupCodes]);

  function copyCodesToClipboard() {
    if (!newBackupCodes) return;
    navigator.clipboard.writeText(newBackupCodes.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
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

        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <p className="text-sm font-semibold">Backup codes</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => generateBackupCodesMutation.mutate()} disabled={generateBackupCodesMutation.isPending} className="flex items-center gap-1">
              <RefreshCw className={cn('h-3.5 w-3.5', generateBackupCodesMutation.isPending && 'animate-spin')} /> Generate new
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">If you lose your authenticator, use one of these single-use codes to sign in. Save them somewhere safe.</p>

          {newBackupCodes && (
            <div className="space-y-2 rounded-lg bg-muted p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">Save these codes - they will not be shown again</p>
                <Button type="button" variant="ghost" size="sm" onClick={copyCodesToClipboard} className="h-7 gap-1 text-xs">
                  {copiedAll ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedAll ? 'Copied' : 'Copy all'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {newBackupCodes.map((code, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded bg-background px-2 py-1.5 font-mono text-xs">
                    <span>{revealCodes[idx] ? code : maskedCodes[idx]}</span>
                    <button type="button" onClick={() => setRevealCodes((prev) => ({ ...prev, [idx]: !prev[idx] }))} className="text-muted-foreground hover:text-foreground">
                      {revealCodes[idx] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {backupStatuses.length > 0 && !newBackupCodes && (
            <div className="space-y-2">
              <p className="text-xs font-medium">Existing codes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {backupStatuses.map((code) => (
                  <div key={code.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span className="font-mono text-xs">Code {String(code.id).slice(-4)}</span>
                    {code.used_at ? (
                      <Badge variant="secondary" className="text-xs">Used</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200">Unused</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
