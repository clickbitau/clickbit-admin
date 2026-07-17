'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchCustomerTickets } from '@/lib/api';
import type { Ticket } from '@/types/support';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Plus, Ticket as TicketIcon } from 'lucide-react';

export default function CustomerTicketsPage() {
  const router = useRouter();

  return (
    <ResourceListPage<Ticket>
      title="Tickets"
      icon={TicketIcon}
      resourceKey="tickets"
      fetcher={fetchCustomerTickets}
      getRowId={(row) => row.id}
      actions={<Button asChild><Link href="/customer/tickets/new"><Plus className="mr-1 h-4 w-4" /> New Ticket</Link></Button>}
      columns={[
        { key: 'ticket_number', header: 'Ticket #', accessor: 'ticket_number' },
        { key: 'subject', header: 'Subject', accessor: 'subject' },
        { key: 'status', header: 'Status', accessor: 'status' },
        { key: 'priority', header: 'Priority', accessor: 'priority' },
        { key: 'category', header: 'Category', accessor: 'category' },
        {
          key: 'created_at',
          header: 'Created',
          cell: (row) => formatDate(row.created_at),
        },
      ]}
      onRowClick={(row) => router.push(`/customer/tickets/${row.id}`)}
      searchPlaceholder="Search tickets..."
    />
  );
}
