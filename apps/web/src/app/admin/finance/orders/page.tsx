'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { useDebounce } from '@/lib/useDebounce';
import { fetchAdminOrders, updateAdminOrderStatus, deleteAdminOrder } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { ShoppingBag, Search, Trash2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

const PAYMENT_STATUS_OPTIONS = ['all', 'pending', 'paid', 'failed', 'refunded'];

export default function AdminOrdersPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [status, setStatus] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const limit = 25;

  const params: Record<string, string | number> = { page, limit };
  if (status !== 'all') params.status = status;
  if (paymentStatus !== 'all') params.payment_status = paymentStatus;
  if (debouncedSearch) params.search = debouncedSearch;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', params],
    queryFn: () => fetchAdminOrders(token!, params),
    enabled: !!token,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status: newStatus }: { id: number; status: string }) => updateAdminOrderStatus(token!, id, newStatus),
    onSuccess: () => {
      toast.success('Order status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update order'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminOrder(token!, id),
    onSuccess: () => {
      toast.success('Order deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to delete order'),
  });

  const orders = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <PageShell title="Orders" icon={ShoppingBag} description="View and manage customer orders.">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders by number or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl nm-raised-sm text-sm bg-transparent"
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl nm-raised-sm text-sm bg-transparent"
        >
          {PAYMENT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All payment statuses' : s}</option>)}
        </select>
      </div>

      <DataTable
        headers={[
          { key: 'order_number', label: 'Order' },
          { key: 'customer', label: 'Customer' },
          { key: 'total', label: 'Total' },
          { key: 'status', label: 'Status' },
          { key: 'payment_status', label: 'Payment' },
          { key: 'created_at', label: 'Created' },
          { key: 'actions', label: '' },
        ]}
        data={orders}
        keyExtractor={(o) => o.id}
        loading={isLoading}
        emptyText="No orders found."
        onRowClick={(o) => router.push(`/admin/finance/orders/${o.id}`)}
        renderRow={(o: any) => [
          <div key="order_number">
            <p className="font-medium">{o.order_number || `#${o.id}`}</p>
            <p className="text-xs text-muted-foreground">{o.items_count || 0} item(s)</p>
          </div>,
          <span key="customer" className="text-sm">{o.guest_email || o.contacts?.email || '-'}</span>,
          <span key="total" className="text-sm font-medium">{formatCurrency(Number(o.total_amount || 0), o.currency)}</span>,
          <StatusBadge key="status" status={o.status} />,
          <StatusBadge key="payment_status" status={o.payment_status || 'pending'} />,
          <span key="created_at" className="text-sm">{formatDate(o.created_at)}</span>,
          <div key="actions" className="flex items-center justify-end gap-2">
            <select
              value={o.status}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => statusMutation.mutate({ id: o.id, status: e.target.value })}
              className="px-2 py-1 rounded-lg nm-raised-sm text-xs bg-transparent"
            >
              {STATUS_OPTIONS.filter((s) => s !== 'all').map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(o.id); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>,
        ]}
      />

      {pagination && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          onPageChange={setPage}
        />
      )}
    </PageShell>
  );
}
