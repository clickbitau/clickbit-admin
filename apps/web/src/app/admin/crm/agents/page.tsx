'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { DataTable } from '@/components/design-system/DataTable';
import { Badge } from '@/components/ui/badge';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchAgents } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { CrmContact } from '@/types/crm';

export default function AgentsPage() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => fetchAgents(token!),
    enabled: !!token,
  });

  useRealtimeRefresh(['contacts'], ['agents'], { enabled: !!token });

  const agents = data ?? [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">Recruitment and commission agents</p>
        </div>

        <DataTable
          headers={[
            { key: 'agent', label: 'Agent' },
            { key: 'clients', label: 'Clients' },
            { key: 'revenue', label: 'Client Revenue' },
            { key: 'commission', label: 'Commission' },
          ]}
          data={agents}
          keyExtractor={(a) => a.id}
          loading={isLoading}
          renderRow={(a) => [
            <div key="agent">
              <Link href={`/admin/crm/agents/${a.id}`} className="font-medium hover:underline">{a.name}</Link>
              <p className="text-xs text-muted-foreground">{a.email}</p>
            </div>,
            <span key="clients">{a.client_count ?? 0}</span>,
            <span key="revenue">{formatCurrency(a.client_revenue ?? 0)}</span>,
            <Badge key="commission" variant="outline">{a.commission_type ? `${a.commission_type === 'percentage' ? `${a.commission_rate}%` : `$${a.commission_rate}`}` : '-'}</Badge>,
          ]}
        />
      </div>
    </div>
  );
}
