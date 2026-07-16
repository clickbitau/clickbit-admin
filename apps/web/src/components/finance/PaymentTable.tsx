'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Payment } from '@/types/finance';

interface PaymentTableProps {
  payments: Payment[];
  loading: boolean;
}

export function PaymentTable({ payments, loading }: PaymentTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No payments found.
      </div>
    );
  }

  const formatCurrency = (value: number | string | undefined) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(value ?? 0));

  const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : '-');

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Transaction ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id || payment.transaction_id}>
              <TableCell>{formatDate(payment.payment_date || payment.created_at)}</TableCell>
              <TableCell className="capitalize">{payment.payment_method || '-'}</TableCell>
              <TableCell className="font-mono text-xs">{payment.transaction_id || '-'}</TableCell>
              <TableCell>
                <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>{payment.status || 'pending'}</Badge>
              </TableCell>
              <TableCell>{payment.invoice?.invoice_number || payment.invoice?.package_code || '-'}</TableCell>
              <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
