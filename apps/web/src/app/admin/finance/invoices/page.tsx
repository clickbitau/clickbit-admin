'use client';
import { DollarSign as DollarSignIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InvoiceTable } from '@/components/finance/InvoiceTable';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchInvoices } from '@/lib/api';

export default function AdminFinanceInvoicesPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', token, page, search, status],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12 };
      if (search) params.search = search;
      if (status) params.status = status;
      return fetchInvoices(token, params);
    },
    enabled: !!token,
  });

  const invoices = data?.invoices ?? data?.data ?? data?.packages ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };

  const statCards = [
    { label: 'Total Invoices', value: pagination.total ?? invoices.length, icon: DollarSignIcon },
    { label: 'Paid', value: invoices.filter((i: any) => i.status === 'paid').length, icon: DollarSignIcon, accent: 'success' as const },
    { label: 'Outstanding', value: invoices.filter((i: any) => ['sent', 'viewed', 'partial'].includes(i.status)).length, icon: DollarSignIcon, accent: 'warning' as const },
    { label: 'Overdue', value: invoices.filter((i: any) => i.status === 'overdue').length, icon: DollarSignIcon, accent: 'destructive' as const },
  ];

  return (
    <PageShell
      title="Finance"
      icon={DollarSignIcon}
      description="Invoices, estimates and quotes"
    >
      <StatCards cards={statCards} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Input
          placeholder="Search invoices..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="viewed">Viewed</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
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
            <InvoiceTable invoices={invoices} loading={isLoading} />
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