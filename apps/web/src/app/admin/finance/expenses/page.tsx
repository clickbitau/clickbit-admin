'use client';
import { Wallet as WalletIcon, Plus } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExpenseTable } from '@/components/finance/ExpenseTable';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchExpenses, fetchExpenseStats } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';

const statusOptions = ['', 'pending', 'approved', 'rejected', 'reimbursed'];

export default function AdminFinanceExpensesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['expenses', token, page, search, status],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12, sortBy: 'expense_date', sortOrder: 'DESC' };
      if (search) params.search = search;
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
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };
  const stats = statsData?.data;

  const statItems = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Expenses', value: stats.total_count, icon: WalletIcon },
      { label: 'Total Amount', value: formatCurrency(stats.total_amount), icon: WalletIcon },
      { label: 'Pending Approval', value: stats.pending_approval, icon: WalletIcon, accent: 'warning' as const },
      { label: 'Billable Unbilled', value: stats.billable_unbilled, icon: WalletIcon, accent: 'destructive' as const },
    ];
  }, [stats]);

  const statCards = statItems.map((s) => ({
    label: s.label,
    value: statsLoading ? '...' : s.value,
    icon: s.icon,
    accent: s.accent,
  }));

  return (
    <PageShell
      title="Expenses"
      icon={WalletIcon}
      description="Track and reimburse business expenses"
      actions={<Button asChild><Link href="/admin/finance/expenses/new"><Plus className="mr-2 h-4 w-4" /> New Expense</Link></Button>}
    >
      <StatCards cards={statCards} />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search expenses..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All statuses'}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-destructive">Failed to load expenses.</div>
          ) : (
            <ExpenseTable expenses={expenses} loading={isLoading} onRowClick={(e) => router.push(`/admin/finance/expenses/${e.id}`)} />
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
