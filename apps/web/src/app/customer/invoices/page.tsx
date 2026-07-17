'use client';

import { useRouter } from 'next/navigation';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchCustomerInvoices } from '@/lib/api';
import type { Invoice } from '@/types/finance';
import { formatCurrency, formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Receipt } from 'lucide-react';

export default function CustomerInvoicesPage() {
  const router = useRouter();

  return (
    <ResourceListPage<Invoice>
      title="Invoices"
      icon={Receipt}
      resourceKey="data"
      fetcher={fetchCustomerInvoices}
      getRowId={(row) => row.id}
      columns={[
        { key: 'invoice_number', header: 'Invoice #', accessor: 'invoice_number' },
        { key: 'title', header: 'Title', accessor: 'title' },
        {
          key: 'document_type',
          header: 'Type',
          cell: (row) => <Badge variant="outline" className="capitalize">{row.document_type || 'invoice'}</Badge>,
        },
        {
          key: 'status',
          header: 'Status',
          cell: (row) => <StatusBadge status={row.status} />,
        },
        {
          key: 'total_amount',
          header: 'Total',
          cell: (row) => formatCurrency(row.total_amount),
        },
        {
          key: 'amount_paid',
          header: 'Paid',
          cell: (row) => formatCurrency(row.amount_paid),
        },
        {
          key: 'amount_due',
          header: 'Due',
          cell: (row) => formatCurrency(row.amount_due),
        },
        {
          key: 'due_date',
          header: 'Due',
          cell: (row) => formatDate(row.due_date),
        },
      ]}
      onRowClick={(row) => router.push(`/customer/invoices/${row.id}`)}
      searchPlaceholder="Search invoices..."
    />
  );
}
