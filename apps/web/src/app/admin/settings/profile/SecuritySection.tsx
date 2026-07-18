'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Trash2, Shield, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { changePassword, deleteAccount } from '@/lib/api';

interface Factor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: 'verified' | 'unverified';
}

export function SecuritySection() {
  const { token, refreshToken, setToken, logout } = useAuth();
  const router = useRouter();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(false);
  const [enrollData, setEnrollData] = useState<{ id: string; qr_code: string; secret: string; uri: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [password, setPassword] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passwordMsg, setPasswordMsg] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPasswordMsg('');
    if (password.new_password !== password.confirm_password) {
      setPasswordMsg('New passwords do not match');
      return;
    }
    try {
      const result: any = await changePassword(token, password);
      setPasswordMsg(result?.message || 'Password changed');
      setPassword({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setPasswordMsg(err?.response?.data?.message || 'Failed to change password');
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!confirm('This will deactivate your account. Continue?')) return;
    setDeleteMsg('');
    try {
      const result: any = await deleteAccount(token, deletePassword);
      setDeleteMsg(result?.message || 'Account deactivated');
      logout();
      router.replace('/login');
    } catch (err: any) {
      setDeleteMsg(err?.response?.data?.message || 'Failed to delete account');
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <form onSubmit={handleChangePassword} className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Key className="h-4 w-4" /> Change password
          </h3>
          <Input type="password" placeholder="Current password" value={password.current_password} onChange={(e) => setPassword({ ...password, current_password: e.target.value })} />
          <Input type="password" placeholder="New password" value={password.new_password} onChange={(e) => setPassword({ ...password, new_password: e.target.value })} />
          <Input type="password" placeholder="Confirm new password" value={password.confirm_password} onChange={(e) => setPassword({ ...password, confirm_password: e.target.value })} />
          {passwordMsg && <p className="text-sm text-muted-foreground">{passwordMsg}</p>}
          <Button type="submit" disabled={!password.current_password || !password.new_password || password.new_password.length < 8}>Update password</Button>
        </form>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> Two-factor authentication
          </h3>
          {factors.length === 0 && !enrollData && <p className="text-sm text-muted-foreground">No authenticators set up.</p>}
          <div className="space-y-2">
            {factors.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{f.friendly_name || `${f.factor_type} authenticator`}</p>
                  <p className="text-xs text-muted-foreground capitalize">{f.status}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => removeFactor(f.id)} disabled={loading}>Remove</Button>
              </div>
            ))}
          </div>

          {!enrollData ? (
            <Button type="button" variant="outline" onClick={startEnroll} disabled={loading}>Add authenticator</Button>
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
        </div>

        <form onSubmit={handleDeleteAccount} className="space-y-3 border-t pt-6">
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Delete account
          </h3>
          <p className="text-sm text-muted-foreground">Enter your password to deactivate your account.</p>
          <Input type="password" placeholder="Current password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
          {deleteMsg && <p className="text-sm text-muted-foreground">{deleteMsg}</p>}
          <Button type="submit" variant="destructive" disabled={!deletePassword}>Deactivate account</Button>
        </form>
      </CardContent>
    </Card>
  );
}
