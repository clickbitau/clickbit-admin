'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { Button } from '@/components/ui/button';
import { api, authHeaders } from '@/lib/api';
import { formatDate } from '@/lib/format';

interface AgentTicket {
  id: number;
  ticket_number?: string;
  subject?: string;
  status?: string;
  priority?: string;
  created_at?: string;
}

async function fetchAgentTickets(token: string, params: { page: number; limit: number; search?: string }) {
  const response = await api.get('/api/agent/tickets', { params, headers: authHeaders(token) });
  return response.data;
}

export default function AgentTicketsPage() {
  const router = useRouter();

  return (
    <ResourceListPage<AgentTicket>
      title="Tickets"
      resourceKey="data"
      fetcher={fetchAgentTickets}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(`/agent/tickets/${row.id}`)}
      actions={
        <Link href="/agent/tickets/new">
          <Button size="sm">New Ticket</Button>
        </Link>
      }
      columns={[
        { key: 'ticket_number', header: 'Ticket #', accessor: 'ticket_number' },
        { key: 'subject', header: 'Subject', accessor: 'subject' },
        { key: 'status', header: 'Status', accessor: 'status' },
        { key: 'priority', header: 'Priority', accessor: 'priority' },
        { key: 'created_at', header: 'Created', accessor: 'created_at', cell: (row) => formatDate(row.created_at) },
      ]}
    />
  );
}
