'use client';
import { Headphones as HeadphonesIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

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
    <PageShell
      title="Agents"
      icon={HeadphonesIcon}
      description="Recruitment and commission agents"
    >

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
    </PageShell>
  );
}