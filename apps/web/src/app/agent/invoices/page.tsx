'use client';

import { useRouter } from 'next/navigation';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { api, authHeaders } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Receipt } from 'lucide-react';

interface AgentInvoice {
  id: number;
  package_code?: string;
  title?: string;
  status?: string;
  total_amount?: number | string;
  due_date?: string;
}

async function fetchAgentInvoices(token: string, params: { page: number; limit: number; search?: string }) {
  const response = await api.get('/api/agent/invoices', { params, headers: authHeaders(token) });
  return response.data;
}

export default function AgentInvoicesPage() {
  const router = useRouter();

  return (
    <ResourceListPage<AgentInvoice>
      title="Invoices"
      icon={Receipt}
      resourceKey="data"
      fetcher={fetchAgentInvoices}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(`/agent/invoices/${row.id}`)}
      columns={[
        { key: 'package_code', header: 'Invoice #', accessor: 'package_code' },
        { key: 'title', header: 'Title', accessor: 'title' },
        { key: 'total_amount', header: 'Total', accessor: 'total_amount', cell: (row) => formatCurrency(row.total_amount) },
        { key: 'status', header: 'Status', accessor: 'status' },
        { key: 'due_date', header: 'Due Date', accessor: 'due_date', cell: (row) => formatDate(row.due_date) },
      ]}
    />
  );
}
