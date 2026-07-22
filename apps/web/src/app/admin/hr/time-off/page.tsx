'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Pagination } from '@/components/design-system/Pagination';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { TimeOffForm } from '@/components/hr/TimeOffForm';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchTimeOff, fetchHrStats, approveTimeOff, rejectTimeOff } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { TimeOffRequest } from '@/types/hr';
import {
  Palmtree,
  Plus,
  Search,
  CalendarRange,
  CheckCircle,
  XCircle,
  Edit,
} from 'lucide-react';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const leaveTypeOptions = [
  { value: '', label: 'All leave types' },
  { value: 'annual', label: 'Annual' },
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'paternity', label: 'Paternity' },
  { value: 'study', label: 'Study' },
  { value: 'jury_duty', label: 'Jury Duty' },
  { value: 'other', label: 'Other' },
];

const sortOptions = [
  { value: 'start_date', label: 'Start date' },
  { value: 'created_at', label: 'Created' },
  { value: 'total_days', label: 'Days' },
];

function leaveTypeConfig(type?: string | null) {
  const map: Record<string, string> = {
    annual: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    sick: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    personal: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    unpaid: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    bereavement: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    maternity: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    paternity: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    study: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    jury_duty: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
    other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };
  return map[type || 'other'] || map.other;
}

function employeeName(req: TimeOffRequest) {
  if (req.employee?.user) {
    const u = req.employee.user;
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    return name || u.email || `Employee #${req.employee_id}`;
  }
  if (req.employee_id) return `Employee #${req.employee_id}`;
  return 'Unknown';
}

export default function AdminHrTimeOffPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [sortBy, setSortBy] = useState('start_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit: 12, sortBy, sortOrder };
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.status = status;
    if (leaveType) params.leave_type = leaveType;
    return params;
  }, [page, debouncedSearch, status, leaveType, sortBy, sortOrder]);

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

  useRealtimeRefresh(['time_off'], ['time-off'], { enabled: !!token });

  const requests = useMemo(() => data?.data ?? [], [data?.data]);
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };
  const stats = statsData?.data;

  const statCards = useMemo(() => {
    const total = stats?.timeOff?.total ?? pagination.total ?? requests.length;
    const pending = stats?.timeOff?.pending ?? requests.filter((r) => r.status === 'pending').length;
    const approved = stats?.timeOff?.approved ?? requests.filter((r) => r.status === 'approved').length;
    const rejected = stats?.timeOff?.rejected ?? requests.filter((r) => r.status === 'rejected').length;
    return [
      { label: 'Total', value: total, icon: Palmtree },
      { label: 'Pending', value: pending, icon: CheckCircle, accent: 'warning' as const, onClick: () => { setStatus('pending'); setPage(1); } },
      { label: 'Approved', value: approved, icon: CheckCircle, accent: 'success' as const, onClick: () => { setStatus('approved'); setPage(1); } },
      { label: 'Rejected', value: rejected, icon: XCircle, accent: 'destructive' as const, onClick: () => { setStatus('rejected'); setPage(1); } },
    ];
  }, [stats, pagination.total, requests]);

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveTimeOff(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-off'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => rejectTimeOff(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-off'] }),
  });

  const displayed = requests;

  return (
    <PageShell
      title="Time Off"
      icon={Palmtree}
      description="Leave requests and approvals."
      actions={canManage ? <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Request</Button> : undefined}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="nm-raised p-4">
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
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>{sortOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}>
            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="text-destructive text-sm">Failed to load time off requests.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading && displayed.length === 0 ? (
            <div className="col-span-full flex items-center justify-center h-64 text-muted-foreground">Loading time off…</div>
          ) : displayed.length === 0 ? (
            <div className="col-span-full nm-raised p-12 text-center text-muted-foreground">
              <Palmtree className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No time off requests found</p>
              <p className="text-sm mt-1">Try adjusting filters or submit a new request.</p>
            </div>
          ) : (
            displayed.map((r: TimeOffRequest) => (
              <div key={r.id} className="nm-raised p-5 flex flex-col h-full">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <PersonAvatar name={employeeName(r)} size="sm" />
                    <span className="font-medium truncate">{employeeName(r)}</span>
                  </div>
                  <StatusBadge status={r.status || 'pending'} />
                </div>

                <h3 className="font-semibold mb-2 line-clamp-2">
                  <Link href={`/admin/hr/time-off/${r.id}`} className="hover:underline">{(r.leave_type || 'Other').replace(/_/g, ' ')}</Link>
                </h3>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="secondary" className={`capitalize ${leaveTypeConfig(r.leave_type)}`}>
                    {(r.leave_type || 'other').replace(/_/g, ' ')}
                  </Badge>
                  {r.total_days !== null && r.total_days !== undefined && (
                    <Badge variant="outline">{r.total_days} day{r.total_days === 1 ? '' : 's'}</Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><CalendarRange className="w-4 h-4" /> {formatDate(r.start_date)} – {formatDate(r.end_date)}</span>
                </div>

                {r.reason && <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{r.reason}</p>}

                <div className="mt-auto flex items-center gap-2 pt-3 border-t border-border/30">
                  {r.status === 'pending' && canManage && (
                    <>
                      <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => approveMutation.mutate(Number(r.id))}>
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => rejectMutation.mutate(Number(r.id))}>
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => router.push(`/admin/hr/time-off/${r.id}`)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Pagination currentPage={pagination.page} totalPages={pagination.pages} totalItems={pagination.total} onPageChange={setPage} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Time Off Request</DialogTitle>
            <DialogDescription>Submit a leave request for an employee.</DialogDescription>
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
