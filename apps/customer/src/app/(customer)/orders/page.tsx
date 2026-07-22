'use client';

import { useRouter } from 'next/navigation';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchCustomerOrders } from '@/lib/api';
import type { Order } from '@/types/crm';
import { formatCurrency, formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { ShoppingCart } from 'lucide-react';

export default function CustomerOrdersPage() {
  const router = useRouter();

  return (
    <ResourceListPage<Order>
      title="Orders"
      icon={ShoppingCart}
      resourceKey="data"
      fetcher={fetchCustomerOrders}
      getRowId={(row) => row.id}
      columns={[
        { key: 'order_number', header: 'Order #', accessor: 'order_number' },
        {
          key: 'status',
          header: 'Status',
          cell: (row) => <StatusBadge status={row.status} />,
        },
        {
          key: 'payment_status',
          header: 'Payment',
          cell: (row) => <StatusBadge status={row.payment_status} />,
        },
        {
          key: 'total_amount',
          header: 'Total',
          cell: (row) => formatCurrency(row.total_amount),
        },
        { key: 'currency', header: 'Currency', accessor: 'currency' },
        {
          key: 'created_at',
          header: 'Created',
          cell: (row) => formatDate(row.created_at),
        },
      ]}
      onRowClick={(row) => router.push(`/orders/${row.id}`)}
      searchPlaceholder="Search orders..."
    />
  );
}
