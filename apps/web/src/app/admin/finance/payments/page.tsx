'use client';
import Link from 'next/link';
import { CreditCard as CreditCardIcon, Plus } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentTable } from '@/components/finance/PaymentTable';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchPayments, fetchPaymentStats } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

const statusOptions = ['', 'completed', 'pending', 'processing', 'failed', 'cancelled', 'refunded'];

export default function AdminFinancePaymentsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', token, page, search, status],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12 };
      if (search) params.search = search;
      if (status) params.status = status;
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
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 12 };
  const stats = statsData?.data;

  const statItems = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Payments', value: stats.totalCount, icon: CreditCardIcon },
      { label: 'Total Value', value: formatCurrency(stats.totalValue), icon: CreditCardIcon },
      { label: 'Completed', value: `${stats.completedCount} · ${formatCurrency(stats.completedTotal)}`, icon: CreditCardIcon, accent: 'success' as const },
      { label: 'Pending', value: stats.pendingCount, icon: CreditCardIcon, accent: 'warning' as const },
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
      title="Payments"
      icon={CreditCardIcon}
      description="Recorded and gateway payments"
      actions={<Button asChild><Link href="/admin/finance/payments/new"><Plus className="mr-2 h-4 w-4" /> Record Payment</Link></Button>}
    >
      <StatCards cards={statCards} />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search payments..."
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
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-destructive">Failed to load payments.</div>
          ) : (
            <PaymentTable payments={payments} loading={isLoading} onRowClick={(p) => router.push(`/admin/finance/payments/${p.transaction_id || p.id}`)} />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} total)
        </p>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
