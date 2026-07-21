'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { TimeOffForm } from '@/components/hr/TimeOffForm';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchTimeOff, fetchHrStats } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { TimeOffRequest } from '@/types/hr';
import { Calendar as CalendarIcon, Plus, Search } from 'lucide-react';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

const leaveTypeOptions = [
  { value: '', label: 'All types' },
  { value: 'annual', label: 'Annual' },
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'study', label: 'Study' },
  { value: 'parental', label: 'Parental' },
  { value: 'compassionate', label: 'Compassionate' },
  { value: 'unpaid', label: 'Unpaid' },
];

const sortOptions = [
  { value: 'submitted_at', label: 'Submitted' },
  { value: 'start_date', label: 'Start date' },
  { value: 'created_at', label: 'Created' },
  { value: 'leave_type', label: 'Leave type' },
];

export default function AdminHrTimeOffPage() {
  const { token } = useAuth();
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [year, setYear] = useState('');
  const [sortBy, setSortBy] = useState('submitted_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit: 12, sortBy, sortOrder };
    if (status) params.status = status;
    if (leaveType) params.leave_type = leaveType;
    if (year) params.year = year;
    return params;
  }, [page, status, leaveType, year, sortBy, sortOrder]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['time-off', queryParams],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchTimeOff(token, queryParams); },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['hr-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchHrStats(token); },
    enabled: !!token,
  });

  useRealtimeRefresh(['time-off'], ['time-off'], { enabled: !!token });

  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };
  const stats = statsData?.data;

  const requests = useMemo(() => {
    const rawRequests = data?.data ?? [];
    if (!debouncedSearch) return rawRequests;
    const q = debouncedSearch.toLowerCase();
    return rawRequests.filter((r) => {
      const employeeName = r.employee?.user
        ? `${r.employee.user.first_name || ''} ${r.employee.user.last_name || ''}`.trim() || r.employee.user.email || ''
        : '';
      return (
        employeeName.toLowerCase().includes(q) ||
        (r.leave_type || '').toLowerCase().includes(q) ||
        (r.request_number || '').toLowerCase().includes(q)
      );
    });
  }, [data, debouncedSearch]);

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total', value: stats.timeOff.total, icon: CalendarIcon },
      { label: 'Pending', value: stats.timeOff.pending, icon: CalendarIcon, accent: 'warning' as const, onClick: () => { setStatus('pending'); setPage(1); } },
      { label: 'Approved', value: stats.timeOff.approved, icon: CalendarIcon, accent: 'success' as const, onClick: () => { setStatus('approved'); setPage(1); } },
      { label: 'Rejected', value: stats.timeOff.rejected, icon: CalendarIcon, accent: 'destructive' as const, onClick: () => { setStatus('rejected'); setPage(1); } },
    ];
  }, [stats]);

  function employeeName(r: TimeOffRequest) {
    if (r.employee?.user) {
      const full = `${r.employee.user.first_name || ''} ${r.employee.user.last_name || ''}`.trim();
      return full || r.employee.user.email || `Employee #${r.employee_id}`;
    }
    return `Employee #${r.employee_id}`;
  }

  return (
    <PageShell
      title="Time Off"
      icon={CalendarIcon}
      description="Review and manage leave requests."
      actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Request</Button>}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search requests..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={leaveType} onValueChange={(v) => { setLeaveType(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Leave type" /></SelectTrigger>
          <SelectContent>{leaveTypeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" placeholder="Year" value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} />
        <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>{sortOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}>
          {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        </Button>
      </div>

      {error ? (
        <div className="text-destructive text-sm">Failed to load time off.</div>
      ) : (
        <DataTable
          headers={[
            { key: 'employee', label: 'Employee' },
            { key: 'type', label: 'Type' },
            { key: 'from', label: 'From' },
            { key: 'to', label: 'To' },
            { key: 'days', label: 'Days' },
            { key: 'status', label: 'Status' },
          ]}
          data={requests}
          keyExtractor={(r) => r.id}
          loading={isLoading}
          onRowClick={(r) => router.push(`/admin/hr/time-off/${r.id}`)}
          emptyText="No time-off requests found."
          emptyDescription="Try adjusting filters or submit a new request."
          renderRow={(r: TimeOffRequest) => [
            <Link key="employee" href={`/admin/hr/time-off/${r.id}`} className="font-medium hover:underline">{employeeName(r)}</Link>,
            <span key="type" className="capitalize">{r.leave_type || '-'}</span>,
            <span key="from">{formatDate(r.start_date)}</span>,
            <span key="to">{formatDate(r.end_date)}</span>,
            <span key="days">{r.total_days ?? '-'}</span>,
            <StatusBadge key="status" status={r.status || 'pending'} />,
          ]}
        />
      )}

      <Pagination currentPage={pagination.page} totalPages={pagination.pages} totalItems={pagination.total} onPageChange={setPage} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Time Off</DialogTitle>
            <DialogDescription>Submit a leave request on behalf of an employee.</DialogDescription>
          </DialogHeader>
          {token && (
            <TimeOffForm
              token={token}
              onSuccess={() => setCreateOpen(false)}
              onCancel={() => setCreateOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
