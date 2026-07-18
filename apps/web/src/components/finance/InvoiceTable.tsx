'use client';

import { useState, useRef, useEffect } from 'react';
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
import { StatusBadge } from '@/components/design-system/StatusBadge';
import type { Invoice } from '@/types/finance';
import { formatCurrency, formatDate } from '@/lib/format';
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Eye, Download, Send, CheckCircle, XCircle, Trash2, Link2, Check, CreditCard } from 'lucide-react';

export interface InvoiceTableActions {
  onView?: (invoice: Invoice) => void;
  onDownload?: (invoice: Invoice) => void;
  onSend?: (invoice: Invoice) => void;
  onCopyLink?: (invoice: Invoice) => void;
  onMarkPaid?: (invoice: Invoice) => void;
  onRecordPayment?: (invoice: Invoice) => void;
  onVoid?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
}

interface InvoiceTableProps extends InvoiceTableActions {
  invoices: Invoice[];
  loading: boolean;
  onRowClick?: (invoice: Invoice) => void;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
  onSort?: (field: string) => void;
  copiedLinkId?: string | number | null;
}

export function InvoiceTable({
  invoices,
  loading,
  onRowClick,
  sortField,
  sortOrder,
  onSort,
  copiedLinkId,
  ...actions
}: InvoiceTableProps) {
  const [openId, setOpenId] = useState<string | number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenId(null);
      }
    };
    if (openId !== null) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [openId]);

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

  const hasActions = Object.values(actions).some((fn) => typeof fn === 'function');

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

  const docTypeLabel = (invoice: Invoice) => {
    const t = (invoice.document_type || invoice.type || 'invoice').toLowerCase();
    if (t === 'estimate' || t === 'quote') return 'EST';
    if (t === 'package') return 'PKG';
    return 'INV';
  };

  const isEstimate = (invoice: Invoice) => {
    const t = (invoice.document_type || invoice.type || '').toLowerCase();
    return t === 'estimate' || t === 'quote';
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
            {sortable('Due Date', 'due_date')}
            {hasActions && <TableHead className="w-[60px]"> </TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow
              key={invoice.id}
              className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
              onClick={() => onRowClick?.(invoice)}
            >
              <TableCell className="font-medium">
                {onRowClick ? (
                  <span className="hover:underline">{invoice.invoice_number || invoice.package_code}</span>
                ) : (
                  <Link href={`/admin/finance/invoices/${invoice.id}`} className="hover:underline">
                    {invoice.invoice_number || invoice.package_code}
                  </Link>
                )}
                {' '}
                <span className="shrink-0 inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                  {docTypeLabel(invoice)}
                </span>
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
                <StatusBadge status={invoice.status} />
              </TableCell>
              <TableCell className="capitalize">{invoice.document_type || invoice.type || 'invoice'}</TableCell>
              <TableCell className="text-right">{formatCurrency(invoice.total_amount, invoice.currency)}</TableCell>
              <TableCell className="text-right">{formatCurrency(invoice.amount_due, invoice.currency)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatDate(invoice.due_date)}</TableCell>
              {hasActions && (
                <TableCell>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {actions.onView && (
                      <button onClick={() => actions.onView?.(invoice)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="View">
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    {actions.onDownload && (
                      <button onClick={() => actions.onDownload?.(invoice)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Download PDF">
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                    <div className="relative" ref={openId === invoice.id ? menuRef : undefined}>
                      <button
                        onClick={() => setOpenId(openId === invoice.id ? null : invoice.id)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="More actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openId === invoice.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 nm-raised rounded-xl z-50 py-1">
                          {actions.onSend && invoice.status === 'draft' && (
                            <ActionItem icon={Send} label="Send to Client" onClick={() => { actions.onSend?.(invoice); setOpenId(null); }} />
                          )}
                          {actions.onCopyLink && !isEstimate(invoice) && (
                            <ActionItem icon={copiedLinkId === invoice.id ? Check : Link2} label={copiedLinkId === invoice.id ? 'Copied!' : 'Copy Payment Link'} onClick={() => { actions.onCopyLink?.(invoice); setOpenId(null); }} />
                          )}
                          {actions.onRecordPayment && !isEstimate(invoice) && invoice.status !== 'paid' && (
                            <ActionItem icon={CreditCard} label="Record Payment" onClick={() => { actions.onRecordPayment?.(invoice); setOpenId(null); }} />
                          )}
                          {actions.onMarkPaid && !isEstimate(invoice) && invoice.status !== 'paid' && (
                            <ActionItem icon={CheckCircle} label="Mark Fully Paid" onClick={() => { actions.onMarkPaid?.(invoice); setOpenId(null); }} />
                          )}
                          {actions.onVoid && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                            <ActionItem icon={XCircle} label="Void" onClick={() => { actions.onVoid?.(invoice); setOpenId(null); }} />
                          )}
                          {actions.onDelete && (
                            <ActionItem icon={Trash2} label="Delete" onClick={() => { actions.onDelete?.(invoice); setOpenId(null); }} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ActionItem({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors">
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
