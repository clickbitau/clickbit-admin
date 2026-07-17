'use client';
import Link from 'next/link';
import { CreditCard as CreditCardIcon, Plus } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentTable } from '@/components/finance/PaymentTable';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchPayments } from '@/lib/api';

export default function AdminFinancePaymentsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', token, page, search],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12 };
      if (search) params.search = search;
      return fetchPayments(token, params);
    },
    enabled: !!token,
  });

  const payments = data?.payments ?? [];
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 12 };

  const totalAmount = payments.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
  const statCards = [
    { label: 'Total Payments', value: pagination.totalItems ?? payments.length, icon: CreditCardIcon },
    { label: 'Amount', value: `$${totalAmount.toLocaleString()}`, icon: CreditCardIcon },
    { label: 'Completed', value: payments.filter((p: any) => p.status === 'completed').length, icon: CreditCardIcon, accent: 'success' as const },
    { label: 'Pending', value: payments.filter((p: any) => p.status === 'pending').length, icon: CreditCardIcon, accent: 'warning' as const },
  ];

  return (
    <PageShell
      title="Payments"
      icon={CreditCardIcon}
      description="Recorded and gateway payments"
      actions={<Button asChild><Link href="/admin/finance/payments/new"><Plus className="mr-2 h-4 w-4" /> Record Payment</Link></Button>}
    >
      <StatCards cards={statCards} />

      <Input
        placeholder="Search payments..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-sm"
      />

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