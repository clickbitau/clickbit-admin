'use client';
import { Wallet as WalletIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExpenseTable } from '@/components/finance/ExpenseTable';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchExpenses } from '@/lib/api';
import Link from 'next/link';

export default function AdminFinanceExpensesPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['expenses', token, page, search],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12 };
      if (search) params.search = search;
      return fetchExpenses(token, params);
    },
    enabled: !!token,
  });

  const expenses = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };

  const totalAmount = expenses.reduce((sum: number, e: any) => sum + (e.amount ?? 0), 0);
  const statCards = [
    { label: 'Total Expenses', value: pagination.total ?? expenses.length, icon: WalletIcon },
    { label: 'Amount', value: `$${totalAmount.toLocaleString()}`, icon: WalletIcon },
    { label: 'Pending', value: expenses.filter((e: any) => e.status === 'pending').length, icon: WalletIcon, accent: 'warning' as const },
    { label: 'Approved', value: expenses.filter((e: any) => e.status === 'approved').length, icon: WalletIcon, accent: 'success' as const },
  ];

  return (
    <PageShell
      title="Expenses"
      icon={WalletIcon}
      description="Track and reimburse business expenses"
    >
      <StatCards cards={statCards} />

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search expenses..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <Button asChild>
          <Link href="/admin/finance/expenses/new">New Expense</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-destructive">Failed to load expenses.</div>
          ) : (
            <ExpenseTable expenses={expenses} loading={isLoading} />
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