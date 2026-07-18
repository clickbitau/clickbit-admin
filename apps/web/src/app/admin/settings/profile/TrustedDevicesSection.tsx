'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Smartphone, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { fetchTrustedDevices, deleteTrustedDevice } from '@/lib/api';
import { formatDate } from '@/lib/format';

interface TrustedDevice {
  id: number;
  device_info: string;
  expires_at: string;
  created_at: string;
}

export function TrustedDevicesSection() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ['trusted-devices', token],
    queryFn: async () => { if (!token) return { data: { devices: [] } }; return fetchTrustedDevices(token); },
    enabled: !!token,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTrustedDevice(token!, id),
    onSuccess: () => { toast.success('Device revoked'); queryClient.invalidateQueries({ queryKey: ['trusted-devices', token] }); },
    onError: () => toast.error('Failed to revoke device'),
  });

  const devices = (listQuery.data?.data?.devices ?? []) as TrustedDevice[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Trusted devices</CardTitle>
        <CardDescription>Devices that can skip two-factor authentication for 7 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {listQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading devices…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trusted devices.</p>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{d.device_info || 'Unknown device'}</p>
                  <p className="text-xs text-muted-foreground">Expires {formatDate(d.expires_at)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => { setRevoking(d.id); deleteMutation.mutate(d.id); }}
                  disabled={deleteMutation.isPending || revoking === d.id}
                >
                  {revoking === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
