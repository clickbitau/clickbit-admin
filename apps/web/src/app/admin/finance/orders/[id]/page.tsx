'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { DataTable } from '@/components/design-system/DataTable';
import { fetchAdminOrder, updateAdminOrderStatus, deleteAdminOrder } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { ShoppingBag, ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-order', id, token],
    queryFn: () => fetchAdminOrder(token!, id),
    enabled: !!token && !!id,
  });

  const order = data?.data;

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateAdminOrderStatus(token!, Number(id), status),
    onSuccess: () => {
      toast.success('Order status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-order', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update order'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAdminOrder(token!, Number(id)),
    onSuccess: () => {
      toast.success('Order deleted');
      router.push('/admin/finance/orders');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to delete order'),
  });

  const items = order?.order_items ?? [];
  const currency = order?.currency || 'AUD';

  return (
    <PageShell
      title={`Order ${order?.order_number || `#${id}`}`}
      icon={ShoppingBag}
      description="Order details and line items."
      actions={
        <Button variant="outline" asChild>
          <Link href="/admin/finance/orders"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link>
        </Button>
      }
    >
      {!isLoading && !order && <p className="text-muted-foreground">Order not found.</p>}
      {order && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="nm-raised">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-3">
                <StatusBadge status={order.status} />
                <select
                  value={order.status}
                  onChange={(e) => statusMutation.mutate(e.target.value)}
                  className="px-2 py-1 rounded-lg nm-raised-sm text-sm bg-transparent"
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </CardContent>
            </Card>
            <Card className="nm-raised">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Payment</CardTitle></CardHeader>
              <CardContent><StatusBadge status={order.payment_status || 'pending'} /></CardContent>
            </Card>
            <Card className="nm-raised">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
              <CardContent className="text-lg font-semibold">{formatCurrency(Number(order.total_amount || 0), currency)}</CardContent>
            </Card>
          </div>

          <Card className="nm-raised">
            <CardHeader>
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <p><span className="text-muted-foreground">Customer:</span> {order.guest_email || order.contacts?.email || '-'}</p>
              <p><span className="text-muted-foreground">Created:</span> {formatDate(order.created_at)}</p>
              <p><span className="text-muted-foreground">Subtotal:</span> {formatCurrency(Number(order.subtotal || 0), currency)}</p>
              <p><span className="text-muted-foreground">Tax:</span> {formatCurrency(Number(order.tax_amount || 0), currency)}</p>
              <p><span className="text-muted-foreground">Shipping:</span> {formatCurrency(Number(order.shipping_amount || 0), currency)}</p>
              <p><span className="text-muted-foreground">Discount:</span> {formatCurrency(Number(order.discount_amount || 0), currency)}</p>
            </CardContent>
          </Card>

          <Card className="nm-raised">
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                headers={[
                  { key: 'product', label: 'Product' },
                  { key: 'quantity', label: 'Qty' },
                  { key: 'unit_price', label: 'Unit' },
                  { key: 'total', label: 'Total' },
                  { key: 'status', label: 'Status' },
                ]}
                data={items}
                keyExtractor={(i) => i.id}
                emptyText="No items."
                renderRow={(i: any) => [
                  <span key="product" className="text-sm font-medium">{i.product_name || i.product_id}</span>,
                  <span key="quantity" className="text-sm">{i.quantity}</span>,
                  <span key="unit_price" className="text-sm">{formatCurrency(Number(i.unit_price || 0), currency)}</span>,
                  <span key="total" className="text-sm">{formatCurrency(Number(i.total_price || 0), currency)}</span>,
                  <StatusBadge key="status" status={i.status} />,
                ]}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete Order
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
