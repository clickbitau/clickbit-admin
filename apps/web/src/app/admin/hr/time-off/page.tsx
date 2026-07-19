'use client';
import Link from 'next/link';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeOffTable } from '@/components/hr/TimeOffTable';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchTimeOff, fetchHrStats } from '@/lib/api';

const statusOptions = ['', 'pending', 'approved', 'rejected', 'cancelled', 'withdrawn'];

export default function AdminHrTimeOffPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['time-off', token, page, search, status],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12 };
      if (search) params.search = search;
      if (status) params.status = status;
      return fetchTimeOff(token, params);
    },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['hr-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchHrStats(token); },
    enabled: !!token,
  });

  const requests = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };
  const stats = statsData?.data;

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total', value: stats.timeOff.total, icon: CalendarIcon },
      { label: 'Pending', value: stats.timeOff.pending, icon: CalendarIcon, accent: 'warning' as const, onClick: () => { setStatus('pending'); setPage(1); } },
      { label: 'Approved', value: stats.timeOff.approved, icon: CalendarIcon, accent: 'success' as const, onClick: () => { setStatus('approved'); setPage(1); } },
      { label: 'Rejected', value: stats.timeOff.rejected, icon: CalendarIcon, accent: 'destructive' as const, onClick: () => { setStatus('rejected'); setPage(1); } },
    ];
  }, [stats]);

  return (
    <PageShell
      title="Time Off"
      icon={CalendarIcon}
      description="Review and manage leave requests."
      actions={<Button asChild><Link href="/admin/hr/time-off/new"><Plus className="mr-1 h-4 w-4" /> New Request</Link></Button>}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search time off..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="sm:max-w-sm"
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

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>{error ? <div className="text-destructive">Failed to load time off.</div> : <TimeOffTable requests={requests} loading={isLoading} />}</CardContent>
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
