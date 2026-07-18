'use client';
import Link from 'next/link';
import {
  CreditCard as CreditCardIcon, Plus, Search, Trash2, ArrowUpDown,
  Landmark, CreditCard, Banknote, ReceiptText, Smartphone, Building2, Clock, CheckCircle2, XCircle, RefreshCw
} from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/design-system/DataTable';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchPayments, fetchPaymentStats, deletePayment } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { useDebounce } from '@/lib/useDebounce';
import type { Payment } from '@/types/finance';

const sortFields = [
  { key: 'payment_date', label: 'Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'payment_method', label: 'Method' },
  { key: 'status', label: 'Status' },
  { key: 'transaction_id', label: 'Transaction' },
  { key: 'created_at', label: 'Created' },
];

const methodConfig: Record<string, { label: string; icon: any }> = {
  bank_transfer: { label: 'Bank Transfer', icon: Landmark },
  card: { label: 'Card', icon: CreditCard },
  cash: { label: 'Cash', icon: Banknote },
  cheque: { label: 'Cheque', icon: ReceiptText },
  stripe: { label: 'Stripe', icon: Smartphone },
  paypal: { label: 'PayPal', icon: Building2 },
};

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  processing: { label: 'Processing', icon: Clock, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  failed: { label: 'Failed', icon: XCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  refunded: { label: 'Refunded', icon: RefreshCw, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  partially_refunded: { label: 'Part. Refunded', icon: RefreshCw, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
};

function MethodBadge({ method }: { method?: string }) {
  const cfg = methodConfig[method || ''] || { label: method || '-', icon: CreditCard };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const cfg = statusConfig[status || ''] || statusConfig.pending;
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.color} border-0`}>
      <Icon className="h-3 w-3 mr-1" /> {cfg.label}
    </Badge>
  );
}

export default function AdminFinancePaymentsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('payment_date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', token, page, debouncedSearch, status, method, sortBy, sortOrder],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 20, sortBy, sortOrder };
      if (debouncedSearch) params.search = debouncedSearch;
      if (status) params.status = status;
      if (method) params.payment_method = method;
      return fetchPayments(token, params);
    },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['payment-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchPaymentStats(token); },
    enabled: !!token,
  });

  const payments = data?.payments ?? [];
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 20 };
  const stats = statsData?.data;

  const remove = useMutation({
    mutationFn: (id: string | number) => deletePayment(token!, id),
    onSuccess: () => { toast.success('Payment deleted'); queryClient.invalidateQueries({ queryKey: ['payments'] }); queryClient.invalidateQueries({ queryKey: ['payment-stats'] }); },
    onError: () => toast.error('Delete failed'),
  });

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Payments', value: stats.totalCount, sub: formatCurrency(stats.totalValue), icon: CreditCardIcon },
      { label: 'Completed', value: stats.completedCount, sub: formatCurrency(stats.completedTotal), icon: CreditCardIcon, accent: 'success' as const },
      { label: 'Pending / Processing', value: stats.pendingCount, icon: CreditCardIcon, accent: 'warning' as const },
      { label: 'Refunded', value: stats.refundedCount, sub: formatCurrency(stats.refundedTotal), icon: CreditCardIcon, accent: 'destructive' as const },
    ];
  }, [stats]);

  const statusTabs = useMemo(() => {
    const byStatus = stats?.byStatus || [];
    const dict: Record<string, { count: number; total: number }> = {};
    for (const row of byStatus) dict[row.status] = { count: row.count, total: row.total };
    const tabs = [
      { key: '', label: 'All', count: stats?.totalCount || 0 },
      { key: 'completed', label: 'Completed', count: dict.completed?.count ?? 0 },
      { key: 'pending', label: 'Pending', count: dict.pending?.count ?? 0 },
      { key: 'processing', label: 'Processing', count: dict.processing?.count ?? 0 },
      { key: 'failed', label: 'Failed', count: dict.failed?.count ?? 0 },
      { key: 'cancelled', label: 'Cancelled', count: dict.cancelled?.count ?? 0 },
      { key: 'refunded', label: 'Refunded', count: dict.refunded?.count ?? 0 },
      { key: 'partially_refunded', label: 'Part. Refunded', count: dict.partially_refunded?.count ?? 0 },
    ];
    return tabs;
  }, [stats]);

  const methods = useMemo(() => {
    const list = stats?.byMethod?.map((m: any) => m.method).filter(Boolean) || [];
    return ['', ...list];
  }, [stats]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };

  const sortHeader = (label: string, field: string) => (
    <button
      onClick={(e) => { e.stopPropagation(); handleSort(field); }}
      className="flex items-center gap-1 font-medium"
    >
      {label} <ArrowUpDown className={`h-3 w-3 ${sortBy === field ? 'text-primary' : 'text-muted-foreground'}`} />
    </button>
  );

  return (
    <PageShell
      title="Payments"
      icon={CreditCardIcon}
      description="Recorded and gateway payments"
      actions={<Button asChild><Link href="/admin/finance/payments/new"><Plus className="mr-2 h-4 w-4" /> Record Payment</Link></Button>}
    >
      <StatCards cards={statCards} />

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatus(tab.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              status === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
            {tab.count > 0 && <span className="ml-1.5 text-xs opacity-80">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search payments..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <select
          value={method}
          onChange={(e) => { setMethod(e.target.value); setPage(1); }}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All methods</option>
          {methods.map((m: string) => (
            <option key={m} value={m}>{methodConfig[m]?.label || m}</option>
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

      {error ? (
        <div className="text-destructive">Failed to load payments.</div>
      ) : (
        <DataTable<Payment>
          headers={[
            { key: 'date', label: sortHeader('Date', 'payment_date') },
            { key: 'method', label: 'Method' },
            { key: 'transaction', label: sortHeader('Transaction', 'transaction_id') },
            { key: 'invoice', label: 'Invoice' },
            { key: 'status', label: sortHeader('Status', 'status') },
            { key: 'amount', label: sortHeader('Amount', 'amount'), className: 'text-right' },
            { key: 'actions', label: '', className: 'w-[80px]' },
          ]}
          data={payments}
          keyExtractor={(row) => String(row.transaction_id || row.id)}
          loading={isLoading}
          emptyText="No payments found."
          onRowClick={(row) => router.push(`/admin/finance/payments/${row.transaction_id || row.id}`)}
          renderRow={(row) => [
            <div key="date" className="text-sm">
              <p>{formatDate(row.payment_date || row.created_at)}</p>
              <p className="text-xs text-muted-foreground">{row.payment_provider || 'manual'}</p>
            </div>,
            <MethodBadge key="method" method={row.payment_method} />,
            <span key="transaction" className="font-mono text-xs">{row.transaction_id || '-'}</span>,
            <span key="invoice" className="text-sm">{row.invoice?.invoice_number || row.invoice?.package_code || '-'}</span>,
            <StatusBadge key="status" status={row.status} />,
            <span key="amount" className="text-right font-medium">{formatCurrency(row.amount, row.currency)}</span>,
            <div key="actions" className="flex items-center justify-end">
              {isManager && (
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Delete" onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this payment?')) remove.mutate(row.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>,
          ]}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} total)
        </p>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </PageShell>
  );
}
