'use client';

import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchCustomerPayments } from '@/lib/api';
import type { Payment } from '@/types/finance';
import { formatCurrency, formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { CreditCard } from 'lucide-react';

export default function CustomerPaymentsPage() {
  return (
    <ResourceListPage<Payment>
      title="Payments"
      icon={CreditCard}
      resourceKey="data"
      fetcher={fetchCustomerPayments}
      getRowId={(row) => row.id}
      columns={[
        { key: 'id', header: 'ID', accessor: 'id' },
        {
          key: 'status',
          header: 'Status',
          cell: (row) => <StatusBadge status={row.status} />,
        },
        {
          key: 'amount',
          header: 'Amount',
          cell: (row) => formatCurrency(row.amount, row.currency),
        },
        { key: 'payment_method', header: 'Method', accessor: 'payment_method' },
        { key: 'payment_provider', header: 'Gateway', accessor: 'payment_provider' },
        {
          key: 'payment_date',
          header: 'Date',
          cell: (row) => formatDate(row.payment_date),
        },
      ]}
      searchPlaceholder="Search payments..."
    />
  );
}
