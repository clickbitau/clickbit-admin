'use client';
import { DollarSign as DollarSignIcon, Plus } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InvoiceTable } from '@/components/finance/InvoiceTable';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchInvoices, fetchInvoiceStats } from '@/lib/api';
import Link from 'next/link';

const statusOptions = ['', 'draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'];

interface StatItem { label: string; value: number | string; icon: typeof DollarSignIcon; accent?: 'success' | 'warning' | 'destructive'; filter?: string; }

export default function AdminFinanceInvoicesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', token, page, search, status],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12, sort_by: 'created_at', sort_order: 'DESC' };
      if (search) params.search = search;
      if (status) params.status = status;
      return fetchInvoices(token, params);
    },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['invoice-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchInvoiceStats(token); },
    enabled: !!token,
  });

  const invoices = data?.invoices ?? data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };
  const stats = statsData?.data;

  const totalUnpaid = useMemo(() => {
    if (!stats) return 0;
    return stats.sent + stats.viewed + stats.partial + stats.overdue;
  }, [stats]);

  const statItems: StatItem[] = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total', value: stats.total, icon: DollarSignIcon, filter: '' },
      { label: 'Paid', value: stats.paid, icon: DollarSignIcon, accent: 'success', filter: 'paid' },
      { label: 'Outstanding', value: totalUnpaid, icon: DollarSignIcon, accent: 'warning', filter: 'outstanding' },
      { label: 'Overdue', value: stats.overdue, icon: DollarSignIcon, accent: 'destructive', filter: 'overdue' },
    ];
  }, [stats, totalUnpaid]);

  const handleStatClick = (filter?: string) => {
    if (filter === 'outstanding') {
      // outstanding is a virtual filter; show sent+viewed+partial+overdue via status sent (closest)
      setStatus('sent');
    } else if (filter !== undefined) {
      setStatus(filter);
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

  return (
    <PageShell
      title="Invoices"
      icon={DollarSignIcon}
      description="Invoices, estimates and quotes"
      actions={<Button asChild><Link href="/admin/finance/invoices/new"><Plus className="mr-2 h-4 w-4" /> New Invoice</Link></Button>}
    >
      <StatCards cards={statCards} />

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
          <SummaryCard label="Draft" value={stats.draft} />
          <SummaryCard label="Sent" value={stats.sent} />
          <SummaryCard label="Viewed" value={stats.viewed} />
          <SummaryCard label="Partial" value={stats.partial} />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search invoices..."
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
            <option key={s} value={s}>{s ? s.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'All statuses'}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-destructive">Failed to load invoices.</div>
          ) : (
            <InvoiceTable invoices={invoices} loading={isLoading} onRowClick={(i) => router.push(`/admin/finance/invoices/${i.id}`)} />
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
