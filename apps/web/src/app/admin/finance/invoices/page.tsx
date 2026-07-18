'use client';
import { DollarSign as DollarSignIcon, Plus } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InvoiceTable } from '@/components/finance/InvoiceTable';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchInvoices, fetchInvoiceStats, fetchContacts, sendInvoice, downloadInvoicePdf, voidInvoice, markInvoicePaid, deleteInvoice } from '@/lib/api';
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
      { label: 'Total', value: stats.total, icon: DollarSignIcon, filter: '' },
      { label: 'Paid', value: stats.paid, icon: DollarSignIcon, accent: 'success' as const, filter: 'paid' },
      { label: 'Outstanding', value: totalUnpaid, icon: DollarSignIcon, accent: 'warning' as const, filter: 'outstanding' },
      { label: 'Overdue', value: stats.overdue, icon: DollarSignIcon, accent: 'destructive' as const, filter: 'overdue' },
      { label: 'Draft', value: stats.draft, icon: DollarSignIcon, filter: 'draft' },
      { label: 'Sent', value: stats.sent, icon: DollarSignIcon, filter: 'sent' },
      { label: 'Viewed', value: stats.viewed, icon: DollarSignIcon, filter: 'viewed' },
      { label: 'Partial', value: stats.partial, icon: DollarSignIcon, filter: 'partial' },
    ];
  }, [stats, totalUnpaid]);

  const handleStatClick = (filter?: string) => {
    if (filter === 'outstanding') {
      setStatus('sent');
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

  const statCards = statItems.map((s) => ({
    label: s.label,
    value: statsLoading ? '...' : s.value,
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
      actions={<Button asChild><Link href="/admin/finance/invoices/new"><Plus className="mr-2 h-4 w-4" /> New Invoice</Link></Button>}
    >
      <StatCards cards={statCards} />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search invoices..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
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
              copiedLinkId={copiedLinkId}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {pagination.page} of {pagination.pages} ({pagination.total} total)
        </p>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
