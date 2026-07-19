'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchEmployeeTimeOff, fetchEmployeeMe } from '@/lib/api';
import { formatDate, formatLeaveHours } from '@/lib/format';
import { Calendar, Plus, Plane, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { TimeOffRequest } from '@clickbit/shared';

const STATUS_TABS = [
  { key: '', label: 'All', icon: Calendar },
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'rejected', label: 'Rejected', icon: XCircle },
  { key: 'cancelled', label: 'Cancelled', icon: AlertCircle },
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

  const summary = useMemo(() => {
    const all = requests;
    return {
      total: all.length,
      pending: all.filter((r) => r.status === 'pending').length,
      approved: all.filter((r) => r.status === 'approved').length,
      rejected: all.filter((r) => r.status === 'rejected').length,
    };
  }, [requests]);

  return (
    <PageShell title="My Time Off" icon={Plane} description="Request leave and track your balances.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="nm-raised">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Annual Leave</p>
            <p className="text-2xl font-bold mt-1">{formatLeaveHours(employee?.annual_leave_balance)}</p>
          </CardContent>
        </Card>
        <Card className="nm-raised">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sick Leave</p>
            <p className="text-2xl font-bold mt-1">{formatLeaveHours(employee?.sick_leave_balance)}</p>
          </CardContent>
        </Card>
        <Card className="nm-raised">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal Leave</p>
            <p className="text-2xl font-bold mt-1">{formatLeaveHours(employee?.personal_leave_balance)}</p>
          </CardContent>
        </Card>
        <Card className="nm-raised">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Requests</p>
            <p className="text-2xl font-bold mt-1">{summary.pending}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((s) => {
            const Icon = s.icon;
            return (
              <Button
                key={s.key}
                size="sm"
                variant={status === s.key ? 'default' : 'outline'}
                onClick={() => { setStatus(s.key); setPage(1); }}
              >
                <Icon className="mr-1 h-4 w-4" /> {s.label}
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={year} onValueChange={(v) => { setYear(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {getYears().map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild>
            <Link href="/employee/time-off/new">
              <Plus className="mr-1 h-4 w-4" /> New Request
            </Link>
          </Button>
        </div>
      </div>

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Leave Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || loadingMe ? (
            <div className="space-y-3">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : (
            <DataTable
              headers={[
                { key: 'type', label: 'Type' },
                { key: 'dates', label: 'Dates' },
                { key: 'days', label: 'Days' },
                { key: 'status', label: 'Status' },
                { key: 'reviewer', label: 'Reviewed By' },
              ]}
              data={requests}
              keyExtractor={(r: TimeOffRequest) => r.id}
              loading={isLoading}
              emptyText="No time-off requests found."
              renderRow={(r: TimeOffRequest) => [
                <span key="type" className="capitalize">{r.leave_type?.replace(/_/g, ' ')}</span>,
                <span key="dates">{formatDate(r.start_date)} - {formatDate(r.end_date)}</span>,
                <span key="days">{r.total_days ?? '-'}</span>,
                <StatusBadge key="status" status={r.status || undefined} />,
                <span key="reviewer">{r.reviewer ? `${r.reviewer.first_name || ''} ${r.reviewer.last_name || ''}`.trim() || '-' : '-'}</span>,
              ]}
            />
          )}
          {pagination && (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
