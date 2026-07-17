'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { HandCoins, Plus, Wallet } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { DataTable } from '@/components/design-system/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchStaffAdvances } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { StaffAdvance } from '@/types/staff-advances';

const statuses = ['all', 'pending', 'active', 'cleared', 'written_off', 'rejected'];
const types = ['all', 'asset', 'cash', 'loan'];

function statusBadge(status: string) {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'active':
      return 'default';
    case 'cleared':
      return 'success' as any;
    case 'written_off':
      return 'outline';
    case 'rejected':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function employeeName(employee: StaffAdvance['employee']) {
  const p = employee?.profiles;
  return p ? `${p.first_name} ${p.last_name}`.trim() : employee?.employee_number || `Employee #${employee?.id}`;
}

export default function StaffAdvancesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['staff-advances', token, status, type, page],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12 };
      if (status !== 'all') params.status = status;
      if (type !== 'all') params.advance_type = type;
      return fetchStaffAdvances(token, params);
    },
    enabled: !!token,
  });

  const advances = data?.data ?? [];
  const stats = data?.stats;
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0 };

  const statCards = stats
    ? [
        { label: 'Total Issued', value: formatCurrency(stats.totalIssued), icon: Wallet },
        { label: 'Outstanding', value: formatCurrency(stats.totalOutstanding), icon: HandCoins, accent: 'warning' as const },
        { label: 'Recovered', value: formatCurrency(stats.totalRecovered), icon: Wallet, accent: 'success' as const },
        { label: 'Active', value: stats.activeCount, icon: HandCoins },
      ]
    : [];

  return (
    <PageShell
      title="Staff Advances"
      icon={HandCoins}
      description="Employee pay advances, loans and asset advances"
      actions={
        <Button asChild>
          <Link href="/admin/finance/staff-advances/new"><Plus className="mr-2 h-4 w-4" /> New Advance</Link>
        </Button>
      }
    >
      <StatCards cards={statCards} />

      <div className="flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm">
          {statuses.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}</option>)}
        </select>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm">
          {types.map((t) => <option key={t} value={t}>{t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>

      {error ? (
        <div className="text-destructive">Failed to load staff advances.</div>
      ) : (
        <DataTable<StaffAdvance>
          headers={[
            { key: 'id', label: '#' },
            { key: 'employee', label: 'Employee' },
            { key: 'title', label: 'Title' },
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status' },
            { key: 'total', label: 'Total', className: 'text-right' },
            { key: 'remaining', label: 'Remaining', className: 'text-right' },
            { key: 'date', label: 'Date' },
          ]}
          data={advances}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => router.push(`/admin/finance/staff-advances/${row.id}`)}
          loading={isLoading}
          emptyText="No staff advances found."
          renderRow={(row) => [
            <span key="id" className="text-muted-foreground">#{row.id}</span>,
            <span key="employee">{employeeName(row.employee)}</span>,
            <div key="title"><p className="font-medium">{row.title}</p><p className="text-xs text-muted-foreground line-clamp-1">{row.description}</p></div>,
            <Badge key="type" variant="outline" className="capitalize">{row.advance_type}</Badge>,
            <Badge key="status" variant={statusBadge(row.status)} className="capitalize">{row.status}</Badge>,
            <span key="total" className="text-right">{formatCurrency(row.total_amount)}</span>,
            <span key="remaining" className="text-right">{formatCurrency(row.remaining_balance)}</span>,
            <span key="date" className="text-sm text-muted-foreground">{formatDate(row.advance_date)}</span>,
          ]}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} total)</p>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </PageShell>
  );
}
