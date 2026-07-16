'use client';

import { useRouter } from 'next/navigation';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchCustomerInvoices } from '@/lib/api';
import type { Invoice } from '@/types/finance';
import { formatCurrency } from '@/lib/format';
import { formatDate } from '@/lib/format';
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
          key: 'total_amount',
          header: 'Total',
          cell: (row) => formatCurrency(row.total_amount),
        },
        {
          key: 'amount_paid',
          header: 'Paid',
          cell: (row) => formatCurrency(row.amount_paid),
        },
        { key: 'status', header: 'Status', accessor: 'status' },
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
