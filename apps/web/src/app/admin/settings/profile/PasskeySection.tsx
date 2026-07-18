'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Trash2, Fingerprint, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  fetchPasskeys,
  createPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  deletePasskey,
} from '@/lib/api';
import { formatDistanceToNow } from '@/lib/format';

interface Passkey {
  id: number;
  credential_id: string;
  friendly_name?: string | null;
  user_agent?: string | null;
  last_used_at?: string | null;
  created_at?: string | null;
}

export function PasskeySection() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [registering, setRegistering] = useState(false);

  const listQuery = useQuery({
    queryKey: ['passkeys', token],
    queryFn: async () => { if (!token) return { data: [] }; return fetchPasskeys(token); },
    enabled: !!token,
  });

  const registerMutation = useMutation({
    mutationFn: (body: any) => verifyPasskeyRegistration(token!, body),
    onSuccess: () => {
      toast.success('Passkey registered');
      queryClient.invalidateQueries({ queryKey: ['passkeys', token] });
      setName('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to register passkey'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePasskey(token!, id),
    onSuccess: () => { toast.success('Passkey removed'); queryClient.invalidateQueries({ queryKey: ['passkeys', token] }); },
    onError: () => toast.error('Failed to remove passkey'),
  });

  async function handleRegister() {
    if (!token) return;
    setRegistering(true);
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const opts = await createPasskeyRegistrationOptions(token);
      const attestation = await startRegistration({ optionsJSON: opts.data });
      await registerMutation.mutateAsync({
        ...attestation,
        challenge: opts.data.challenge,
        friendly_name: name || undefined,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        toast.error('Passkey registration was cancelled or not allowed');
      } else {
        toast.error(err?.message || 'Passkey registration failed');
      }
    } finally {
      setRegistering(false);
    }
  }

  const passkeys = (listQuery.data?.data ?? []) as Passkey[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Fingerprint className="h-4 w-4" /> Passkeys</CardTitle>
        <CardDescription>Sign in with Face ID, Touch ID, or a security key.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="passkey-name">Friendly name</Label>
            <Input id="passkey-name" placeholder="e.g. MacBook Touch ID" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={handleRegister} disabled={registering || registerMutation.isPending}>
              {registering || registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Register passkey
            </Button>
          </div>
        </div>

        {listQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading passkeys…</p>
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No passkeys registered yet.</p>
        ) : (
          <div className="space-y-2">
            {passkeys.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <KeyRound className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.friendly_name || 'Passkey'}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.user_agent || 'Unknown device'}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.last_used_at ? `Last used ${formatDistanceToNow(p.last_used_at)}` : `Added ${p.created_at ? formatDistanceToNow(p.created_at) : '—'}`}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(p.id)} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
