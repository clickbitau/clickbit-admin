'use client';
import Link from 'next/link';
import { Wallet as WalletIcon, Plus, CheckCircle, XCircle, Banknote, Trash2, Copy, Search, ArrowUpDown, Receipt, Tag } from 'lucide-react';
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
import { fetchExpenses, fetchExpenseStats, approveExpense, rejectExpense, reimburseExpense, deleteExpense, duplicateExpense } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { useDebounce } from '@/lib/useDebounce';
import type { Expense } from '@/types/finance';

const categories = [
  { value: '', label: 'All categories' },
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals' },
  { value: 'office_supplies', label: 'Office Supplies' },
  { value: 'software', label: 'Software' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'advertising', label: 'Advertising' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'training', label: 'Training' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'other', label: 'Other' },
];

const sortFields = [
  { key: 'expense_date', label: 'Date' },
  { key: 'total_amount', label: 'Amount' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Created' },
];

function statusBadge(status?: string) {
  switch (status) {
    case 'approved':
    case 'reimbursed':
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{status}</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">{status}</Badge>;
    case 'rejected':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{status}</Badge>;
    case 'paid':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{status}</Badge>;
    default:
      return <Badge variant="outline">{status || 'draft'}</Badge>;
  }
}

function categoryLabel(value?: string) {
  return categories.find((c) => c.value === value)?.label || value || 'Other';
}

export default function AdminFinanceExpensesPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('expense_date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, error } = useQuery({
    queryKey: ['expenses', token, page, debouncedSearch, category, status, sortBy, sortOrder],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 20, sortBy, sortOrder };
      if (debouncedSearch) params.search = debouncedSearch;
      if (category) params.category = category;
      if (status) params.status = status;
      return fetchExpenses(token, params);
    },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['expense-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchExpenseStats(token); },
    enabled: !!token,
  });

  const expenses = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 20 };
  const stats = statsData?.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
  };

  const approve = useMutation({
    mutationFn: (id: number) => approveExpense(token!, id),
    onSuccess: () => { toast.success('Expense approved'); invalidate(); },
    onError: () => toast.error('Approve failed'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectExpense(token!, id, reason),
    onSuccess: () => { toast.success('Expense rejected'); invalidate(); },
    onError: () => toast.error('Reject failed'),
  });

  const reimburse = useMutation({
    mutationFn: (id: number) => reimburseExpense(token!, id),
    onSuccess: () => { toast.success('Expense reimbursed'); invalidate(); },
    onError: () => toast.error('Reimburse failed'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteExpense(token!, id),
    onSuccess: () => { toast.success('Expense deleted'); invalidate(); },
    onError: () => toast.error('Delete failed'),
  });

  const duplicate = useMutation({
    mutationFn: (id: number) => duplicateExpense(token!, id),
    onSuccess: () => { toast.success('Expense duplicated'); invalidate(); },
    onError: () => toast.error('Duplicate failed'),
  });

  const handleApprove = (id: number) => approve.mutate(id);
  const handleReject = (id: number) => {
    const reason = window.prompt('Reason for rejection');
    if (reason === null) return;
    if (!reason.trim()) return toast.error('A reason is required');
    reject.mutate({ id, reason });
  };
  const handleReimburse = (id: number) => reimburse.mutate(id);
  const handleDelete = (id: number) => {
    if (window.confirm('Delete this expense?')) remove.mutate(id);
  };
  const handleDuplicate = (id: number) => duplicate.mutate(id);

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Expenses', value: stats.total_count, sub: formatCurrency(stats.total_amount), icon: WalletIcon },
      { label: 'Pending Approval', value: stats.pending_approval, icon: WalletIcon, accent: 'warning' as const },
      { label: 'Pending Reimbursement', value: stats.pending_reimbursement, icon: WalletIcon, accent: 'primary' as const },
      { label: 'Billable Unbilled', value: stats.billable_unbilled, icon: WalletIcon, accent: 'destructive' as const },
    ];
  }, [stats]);

  const statusTabs = useMemo(() => {
    const byStatus = stats?.by_status || {};
    const tabs = [
      { key: '', label: 'All', count: stats?.total_count || 0 },
      { key: 'pending', label: 'Pending', count: byStatus.pending?.count ?? 0 },
      { key: 'approved', label: 'Approved', count: byStatus.approved?.count ?? 0 },
      { key: 'rejected', label: 'Rejected', count: byStatus.rejected?.count ?? 0 },
      { key: 'paid', label: 'Paid', count: byStatus.paid?.count ?? 0 },
      { key: 'reimbursed', label: 'Reimbursed', count: byStatus.reimbursed?.count ?? 0 },
      { key: 'draft', label: 'Draft', count: byStatus.draft?.count ?? 0 },
    ];
    return tabs;
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
      title="Expenses"
      icon={WalletIcon}
      description="Track, approve and reimburse business expenses"
      actions={
        <Button asChild>
          <Link href="/admin/finance/expenses/new"><Plus className="mr-2 h-4 w-4" /> New Expense</Link>
        </Button>
      }
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
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
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
        <div className="text-destructive">Failed to load expenses.</div>
      ) : (
        <DataTable<Expense>
          headers={[
            { key: 'number', label: sortHeader('Number', 'expense_number') },
            { key: 'description', label: 'Description' },
            { key: 'category', label: sortHeader('Category', 'category') },
            { key: 'status', label: sortHeader('Status', 'status') },
            { key: 'date', label: sortHeader('Date', 'expense_date') },
            { key: 'amount', label: sortHeader('Amount', 'total_amount'), className: 'text-right' },
            { key: 'actions', label: '', className: 'w-[140px]' },
          ]}
          data={expenses}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          emptyText="No expenses found."
          onRowClick={(row) => router.push(`/admin/finance/expenses/${row.id}`)}
          renderRow={(row) => [
            <div key="number">
              <p className="font-medium">{row.expense_number || `#${row.id}`}</p>
              {row.receipts && row.receipts.length > 0 && <p className="text-xs text-muted-foreground flex items-center gap-1"><Receipt className="h-3 w-3" /> {row.receipts.length} receipt{row.receipts.length > 1 ? 's' : ''}</p>}
            </div>,
            <div key="description">
              <p className="font-medium line-clamp-1">{row.description || '-'}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{row.vendor?.name || 'No vendor'}</p>
            </div>,
            <div key="category" className="flex items-center gap-1 text-sm">
              <Tag className="h-3 w-3 text-muted-foreground" />
              {categoryLabel(row.category)}
            </div>,
            statusBadge(row.status),
            <div key="date" className="text-sm">
              <p>{formatDate(row.expense_date)}</p>
              {row.is_billable && <Badge variant="outline" className="text-[10px]">Billable</Badge>}
            </div>,
            <span key="amount" className="text-right font-medium">{formatCurrency(row.total_amount)}</span>,
            <div key="actions" className="flex items-center justify-end gap-1">
              {row.status === 'pending' && isManager && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Approve" onClick={(e) => { e.stopPropagation(); handleApprove(row.id); }}>
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Reject" onClick={(e) => { e.stopPropagation(); handleReject(row.id); }}>
                    <XCircle className="h-4 w-4 text-red-600" />
                  </Button>
                </>
              )}
              {row.status === 'approved' && row.is_reimbursable && isManager && (
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Reimburse" onClick={(e) => { e.stopPropagation(); handleReimburse(row.id); }}>
                  <Banknote className="h-4 w-4 text-purple-600" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicate" onClick={(e) => { e.stopPropagation(); handleDuplicate(row.id); }}>
                <Copy className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>,
          ]}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {pagination.page} of {pagination.pages} ({pagination.total} total)
        </p>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </PageShell>
  );
}
