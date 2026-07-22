'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { fetchEmployeeTimeOff, fetchEmployeeMe } from '@/lib/api';
import { formatDate, formatLeaveHours } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Calendar, Plus, Plane, Search, Clock, CheckCircle2, XCircle, AlertCircle, CalendarRange } from 'lucide-react';
import type { TimeOffRequest } from '@clickbit/shared';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
];

function getYears() {
  const current = new Date().getFullYear();
  const years = [];
  for (let i = current; i >= current - 5; i--) years.push(i);
  return years;
}

export default function EmployeeTimeOffPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [year, setYear] = useState<string>('all');
  const [search, setSearch] = useState('');
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['employee-time-off', token, page, status, year],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: { page: number; limit: number; status?: string; year?: number } = { page, limit };
      if (status) params.status = status;
      if (year !== 'all') params.year = Number(year);
      return fetchEmployeeTimeOff(token, params);
    },
    enabled: !!token,
  });

  const { data: meData, isLoading: loadingMe } = useQuery({
    queryKey: ['employee-me', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployeeMe(token);
    },
    enabled: !!token,
  });

  const requests = useMemo(() => data?.data ?? [], [data]);
  const pagination = data?.pagination;
  const employee = meData?.data;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      r.leave_type.toLowerCase().includes(q) ||
      (r.reason?.toLowerCase() || '').includes(q) ||
      formatDate(r.start_date).toLowerCase().includes(q) ||
      formatDate(r.end_date).toLowerCase().includes(q) ||
      (r.request_number?.toLowerCase() || '').includes(q)
    );
  }, [requests, search]);

  const stats = useMemo(() => {
    return {
      annual: employee?.annual_leave_balance ?? 0,
      sick: employee?.sick_leave_balance ?? 0,
      personal: employee?.personal_leave_balance ?? 0,
      pending: requests.filter((r) => r.status === 'pending').length,
    };
  }, [employee, requests]);

  return (
    <PageShell
      title="My Time Off"
      icon={Plane}
      description="Request leave and track your balances."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={status === s.key ? 'default' : 'outline'}
                onClick={() => { setStatus(s.key); setPage(1); }}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <Button asChild>
            <Link href="/employee/time-off/new">
              <Plus className="mr-1 h-4 w-4" /> New Request
            </Link>
          </Button>
        </div>
      }
    >
      <StatCards
        cards={[
          { label: 'Annual Leave', value: formatLeaveHours(stats.annual), icon: Calendar, accent: 'success' },
          { label: 'Sick Leave', value: formatLeaveHours(stats.sick), icon: AlertCircle, accent: 'warning' },
          { label: 'Personal Leave', value: formatLeaveHours(stats.personal), icon: Clock, accent: 'primary' },
          { label: 'Pending', value: stats.pending, icon: CheckCircle2, accent: 'secondary' },
        ]}
      />

      <Card className="nm-raised p-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={year} onValueChange={(v) => { setYear(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {getYears().map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading || loadingMe ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="nm-raised p-8 text-center text-sm text-muted-foreground">
          {search ? 'No requests match your search.' : 'No time-off requests found.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: TimeOffRequest) => (
            <Card
              key={r.id}
              className={cn(
                'nm-raised hover:shadow-md transition-all border-l-4',
                r.status === 'approved' ? 'border-l-emerald-500' :
                r.status === 'pending' ? 'border-l-amber-500' :
                r.status === 'rejected' ? 'border-l-red-500' :
                r.status === 'cancelled' ? 'border-l-gray-400' : 'border-l-primary'
              )}
            >
              <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 p-4">
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-primary" />
                    {r.request_number ? `${r.request_number} · ` : ''}{formatDate(r.start_date)} – {formatDate(r.end_date)}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">{r.leave_type?.replace(/_/g, ' ')} · {r.total_days ?? '-'} day(s)</p>
                </div>
                <StatusBadge status={r.status || undefined} />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {r.reason && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Reason</p>
                    <p className="line-clamp-2">{r.reason}</p>
                  </div>
                )}
                {r.reviewer && (
                  <div>
                    <p className="text-xs text-muted-foreground">Reviewed By</p>
                    <p>{`${r.reviewer.first_name || ''} ${r.reviewer.last_name || ''}`.trim() || '-'}</p>
                  </div>
                )}
                {r.reviewed_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Reviewed At</p>
                    <p>{formatDate(r.reviewed_at)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          onPageChange={setPage}
        />
      )}
    </PageShell>
  );
}
