'use client';
import { Shield as ShieldIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAuditLogs } from '@/lib/api';

export default function AdminSettingsAuditLogsPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['audit-logs', token, search], queryFn: () => { if (!token) throw new Error('No token'); return fetchAuditLogs(token, { search }); }, enabled: !!token });

  return (
    <PageShell
      title="Audit Logs"
      icon={ShieldIcon}
    >
      <Input placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="space-y-2">
          {data?.data?.map((log: any) => (
            <Card key={log.id}>
              <CardHeader><CardTitle className="text-sm">{log.action} &middot; {log.entity_type}</CardTitle></CardHeader>
              <CardContent><pre className="text-xs text-muted-foreground">{JSON.stringify(log, null, 2)}</pre></CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}