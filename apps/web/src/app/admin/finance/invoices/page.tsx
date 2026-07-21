'use client';
import { DollarSign as DollarSignIcon, Plus, FileText } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { Pagination } from '@/components/design-system/Pagination';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InvoiceTable } from '@/components/finance/InvoiceTable';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchInvoices, fetchInvoiceStats, fetchContacts, sendInvoice, downloadInvoicePdf, voidInvoice, markInvoicePaid, deleteInvoice, recordInvoicePayment } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Invoice } from '@/types/finance';
import Link from 'next/link';
import { toast } from 'sonner';
import { useDebounce } from '@/lib/useDebounce';

const statusOptions = ['', 'draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'];
const documentTypeOptions = ['', 'invoice', 'estimate', 'quote'];
const sortFields = [
  { key: 'created_at', label: 'Created' },
  { key: 'issue_date', label: 'Issue Date' },
  { key: 'title', label: 'Title' },
  { key: 'client_name', label: 'Client' },
  { key: 'total_amount', label: 'Total' },
  { key: 'status', label: 'Status' },
];

export default function AdminFinanceInvoicesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [customer, setCustomer] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [copiedLinkId, setCopiedLinkId] = useState<string | number | null>(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [recordInvoice, setRecordInvoice] = useState<Invoice | null>(null);
  const [recordAmount, setRecordAmount] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', token, page, debouncedSearch, status, documentType, customer, sortBy, sortOrder],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = {
        page,
        limit: 12,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (status) params.status = status;
      if (documentType) params.document_type = documentType;
      if (customer) params.customer = customer;
      return fetchInvoices(token, params);
    },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['invoice-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchInvoiceStats(token); },
    enabled: !!token,
  });

  const { data: contactsData } = useQuery({
    queryKey: ['contacts', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchContacts(token, { limit: 250 }); },
    enabled: !!token,
  });

  const invoices = data?.invoices ?? data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };
  const stats = statsData?.data;

  const onSuccess = (message: string) => {
    toast.success(message);
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
  };

  const sendMutation = useMutation({
    mutationFn: (id: number) => sendInvoice(token!, id),
    onSuccess: () => onSuccess('Invoice sent'),
    onError: () => toast.error('Failed to send invoice'),
  });

  const voidMutation = useMutation({
    mutationFn: (id: number) => voidInvoice(token!, id),
    onSuccess: () => onSuccess('Invoice voided'),
    onError: () => toast.error('Failed to void invoice'),
  });

  const paidMutation = useMutation({
    mutationFn: (id: number) => markInvoicePaid(token!, id),
    onSuccess: () => onSuccess('Marked as paid'),
    onError: () => toast.error('Failed to mark invoice as paid'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInvoice(token!, id),
    onSuccess: () => onSuccess('Invoice deleted'),
    onError: () => toast.error('Failed to delete invoice'),
  });

  const recordMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => recordInvoicePayment(token!, id, { amount, method: 'manual' }),
    onSuccess: () => {
      onSuccess('Payment recorded');
      setRecordDialogOpen(false);
      setRecordInvoice(null);
      setRecordAmount('');
    },
    onError: () => toast.error('Failed to record payment'),
  });

  const handleDownload = async (invoice: any) => {
    try {
      const blob = await downloadInvoicePdf(token!, invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number || invoice.package_code || 'invoice'}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  const handleCopyLink = async (invoice: any) => {
    const url = `${window.location.origin}/pay/${invoice.invoice_number || invoice.package_code || invoice.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(invoice.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const totalUnpaid = useMemo(() => {
    if (!stats) return 0;
    return stats.sent + stats.viewed + stats.partial + stats.overdue;
  }, [stats]);

  const statItems = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total', value: stats.total, sub: formatCurrency(stats.totalAmount || 0), icon: DollarSignIcon, filter: '' },
      { label: 'Paid', value: stats.paid, sub: formatCurrency(stats.paidAmount || 0), icon: DollarSignIcon, accent: 'success' as const, filter: 'paid' },
      { label: 'Outstanding', value: totalUnpaid, sub: formatCurrency(stats.outstandingAmount || 0), icon: DollarSignIcon, accent: 'warning' as const, filter: 'outstanding' },
      { label: 'Overdue', value: stats.overdue, sub: formatCurrency(stats.overdueAmount || 0), icon: DollarSignIcon, accent: 'destructive' as const, filter: 'overdue' },
      { label: 'Draft', value: stats.draft, sub: formatCurrency(stats.draftAmount || 0), icon: DollarSignIcon, filter: 'draft' },
      { label: 'Sent', value: stats.sent, sub: formatCurrency(stats.sentAmount || 0), icon: DollarSignIcon, filter: 'sent' },
      { label: 'Viewed', value: stats.viewed, sub: formatCurrency(stats.viewedAmount || 0), icon: DollarSignIcon, filter: 'viewed' },
      { label: 'Partial', value: stats.partial, sub: formatCurrency(stats.partialAmount || 0), icon: DollarSignIcon, filter: 'partial' },
    ];
  }, [stats, totalUnpaid]);

  const handleStatClick = (filter?: string) => {
    if (filter === 'outstanding') {
      setStatus('sent,viewed,partial');
      setDocumentType('');
    } else if (filter !== undefined) {
      setStatus(filter);
    }
    setPage(1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  const tabConfig = [
    { key: 'all', label: 'All', status: '', docType: '' },
    { key: 'invoices', label: 'Invoices', status: '', docType: 'invoice' },
    { key: 'estimates', label: 'Estimates', status: '', docType: 'estimate' },
    { key: 'draft', label: 'Draft', status: 'draft', docType: '' },
    { key: 'sent-due', label: 'Sent / Due', status: 'sent,viewed', docType: '' },
    { key: 'paid', label: 'Paid', status: 'paid', docType: '' },
    { key: 'partial', label: 'Partial', status: 'partial', docType: '' },
    { key: 'overdue', label: 'Overdue', status: 'overdue', docType: '' },
    { key: 'voided', label: 'Voided', status: 'cancelled', docType: '' },
  ];

  const activeTab = tabConfig.find((t) => t.status === status && t.docType === documentType)?.key || 'all';

  const handleTabClick = (tab: typeof tabConfig[0]) => {
    setStatus(tab.status);
    setDocumentType(tab.docType);
    setPage(1);
  };

  const statCards = statItems.map((s) => ({
    label: s.label,
    value: statsLoading ? '...' : s.value,
    sub: s.sub,
    icon: s.icon,
    accent: s.accent,
    onClick: s.filter !== undefined ? () => handleStatClick(s.filter) : undefined,
  }));

  const contacts = contactsData?.contacts ?? [];

  return (
    <PageShell
      title="Invoices"
      icon={DollarSignIcon}
      description="Invoices, estimates and quotes"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/finance/invoices/new?document_type=estimate"><FileText className="mr-2 h-4 w-4" /> New Estimate</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/finance/invoices/new"><Plus className="mr-2 h-4 w-4" /> New Invoice</Link>
          </Button>
        </div>
      }
    >
      <StatCards cards={statCards} />

      <div className="border-b">
        <nav className="flex space-x-1 overflow-x-auto pb-px -mb-px">
          {tabConfig.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = tab.key === 'all'
              ? pagination.total
              : tab.status && stats
                ? (tab.status.includes(',') ? tab.status.split(',').reduce((sum, k) => sum + (stats[k] || 0), 0) : stats[tab.status])
                : undefined;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab)}
                className={`shrink-0 py-2.5 px-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                }`}
              >
                {tab.label}
                {count !== undefined && count > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search invoices..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="sm:max-w-sm"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s ? s.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'All statuses'}</option>
          ))}
        </select>
        <select
          value={documentType}
          onChange={(e) => { setDocumentType(e.target.value); setPage(1); }}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          {documentTypeOptions.map((t) => (
            <option key={t} value={t}>{t ? t.charAt(0).toUpperCase() + t.slice(1) : 'All types'}</option>
          ))}
        </select>
        <select
          value={customer}
          onChange={(e) => { setCustomer(e.target.value); setPage(1); }}
          className="h-10 rounded-md border bg-background px-3 text-sm min-w-[160px]"
        >
          <option value="">All customers</option>
          {contacts.map((c: any) => (
            <option key={c.id} value={c.id}>{`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          {sortFields.map((s) => <option key={s.key} value={s.key}>Sort by {s.label}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={() => setSortOrder((prev) => prev === 'ASC' ? 'DESC' : 'ASC')} className="h-10">
          {sortOrder === 'ASC' ? 'Ascending' : 'Descending'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-destructive">Failed to load invoices.</div>
          ) : (
            <InvoiceTable
              invoices={invoices}
              loading={isLoading}
              onRowClick={(i) => router.push(`/admin/finance/invoices/${i.id}`)}
              sortField={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              onView={(i) => router.push(`/admin/finance/invoices/${i.id}`)}
              onDownload={handleDownload}
              onSend={(i) => sendMutation.mutate(i.id)}
              onCopyLink={handleCopyLink}
              onMarkPaid={(i) => {
                if (window.confirm('Mark this invoice as fully paid?')) paidMutation.mutate(i.id);
              }}
              onVoid={(i) => {
                if (window.confirm('Void this invoice?')) voidMutation.mutate(i.id);
              }}
              onDelete={(i) => {
                if (window.confirm('Delete this invoice?')) deleteMutation.mutate(i.id);
              }}
              onRecordPayment={(i) => {
                setRecordInvoice(i);
                setRecordAmount(String(i.amount_due ?? i.total_amount ?? ''));
                setRecordDialogOpen(true);
              }}
              copiedLinkId={copiedLinkId}
            />
          )}
        </CardContent>
      </Card>

      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.pages}
        totalItems={pagination.total}
        onPageChange={setPage}
      />

      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for {recordInvoice?.invoice_number || recordInvoice?.package_code || `invoice #${recordInvoice?.id}`}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={recordAmount}
              onChange={(e) => setRecordAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
            {recordInvoice && (
              <p className="text-xs text-muted-foreground">
                Total: {formatCurrency(recordInvoice.total_amount, recordInvoice.currency)} · Due: {formatCurrency(recordInvoice.amount_due, recordInvoice.currency)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const amount = parseFloat(recordAmount);
                if (!amount || amount <= 0 || !recordInvoice) return;
                recordMutation.mutate({ id: recordInvoice.id, amount });
              }}
              disabled={recordMutation.isPending}
            >
              {recordMutation.isPending ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
