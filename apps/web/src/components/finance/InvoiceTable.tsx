'use client';

import Link from 'next/link';
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
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface InvoiceTableProps {
  invoices: Invoice[];
  loading: boolean;
  onRowClick?: (invoice: Invoice) => void;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
  onSort?: (field: string) => void;
}

export function InvoiceTable({ invoices, loading, onRowClick, sortField, sortOrder, onSort }: InvoiceTableProps) {
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
    return <div className="rounded-lg border p-8 text-center text-muted-foreground">No invoices found.</div>;
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

  const sortable = (label: string, field: string) => {
    if (!onSort) return <TableHead>{label}</TableHead>;
    const active = sortField === field;
    return (
      <TableHead className="cursor-pointer" onClick={() => onSort(field)}>
        <div className="flex items-center gap-1">
          {label}
          {active ? (
            sortOrder === 'ASC' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </TableHead>
    );
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {sortable('Number', 'invoice_number')}
            {sortable('Client', 'client_name')}
            {sortable('Title', 'title')}
            {sortable('Status', 'status')}
            {sortable('Type', 'document_type')}
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id} className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''} onClick={() => onRowClick?.(invoice)}>
              <TableCell className="font-medium">
                {onRowClick ? (
                  <span className="hover:underline">{invoice.invoice_number || invoice.package_code}</span>
                ) : (
                  <Link href={`/admin/finance/invoices/${invoice.id}`} className="hover:underline">
                    {invoice.invoice_number || invoice.package_code}
                  </Link>
                )}
              </TableCell>
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
