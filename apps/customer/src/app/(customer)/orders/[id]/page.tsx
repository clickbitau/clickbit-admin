'use client';

import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchCustomerOrder } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Order } from '@/types/crm';
import { ShoppingCart } from 'lucide-react';

export default function CustomerOrderDetailPage() {
  return (
    <ResourceDetailPage
      title="Order"
      icon={ShoppingCart}
      backHref="/orders"
      titleKey="order_number"
      getFn={(token, id) => fetchCustomerOrder(token, id).then((r) => r.data as Order)}
      fields={[
        { key: 'order_number', label: 'Order #', type: 'text', readOnly: true },
        { key: 'status', label: 'Status', type: 'text', readOnly: true },
        { key: 'payment_status', label: 'Payment Status', type: 'text', readOnly: true },
        { key: 'total_amount', label: 'Total', type: 'number', readOnly: true },
        { key: 'currency', label: 'Currency', type: 'text', readOnly: true },
        { key: 'estimated_delivery', label: 'Estimated Delivery', type: 'date', readOnly: true },
      ]}
      extraReadOnly={(item: Record<string, any>) => {
        const order = item as Order;
        if (!order.order_items?.length) return null;
        return (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {order.order_items.map((line) => (
                  <div key={line.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{line.product_name || `Item #${line.id}`}</p>
                      <p className="text-muted-foreground">Qty: {line.quantity ?? 1}</p>
                    </div>
                    <div className="text-right">
                      <p>{formatCurrency(line.total_price)}</p>
                      <p className="text-xs text-muted-foreground">{line.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      }}
    />
  );
}
