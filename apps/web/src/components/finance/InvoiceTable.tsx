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
import type { Invoice } from '@/types/finance';

interface InvoiceTableProps {
  invoices: Invoice[];
  loading: boolean;
}

export function InvoiceTable({ invoices, loading }: InvoiceTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No invoices found.
      </div>
    );
  }

  const formatCurrency = (value: number | string | undefined) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(value ?? 0));

  const statusVariant = (status?: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'sent':
      case 'viewed':
        return 'secondary';
      case 'partial':
        return 'outline';
      case 'overdue':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">{invoice.invoice_number || invoice.package_code}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{invoice.client_name}</span>
                  {invoice.client_company && (
                    <span className="text-xs text-muted-foreground">{invoice.client_company}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>{invoice.title}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(invoice.status)}>{invoice.status || 'draft'}</Badge>
              </TableCell>
              <TableCell className="capitalize">{invoice.document_type || invoice.type || 'invoice'}</TableCell>
              <TableCell className="text-right">{formatCurrency(invoice.total)}</TableCell>
              <TableCell className="text-right">{formatCurrency(invoice.amount_due)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
