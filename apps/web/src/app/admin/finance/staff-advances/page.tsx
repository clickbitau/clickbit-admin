'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HandCoins, Plus, Wallet, CheckCircle2, XCircle, Trash2, Search } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchEmployees, fetchStaffAdvances, approveStaffAdvance, rejectStaffAdvance, deleteStaffAdvance } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
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

function recoveryPct(row: StaffAdvance) {
  const total = Number(row.total_amount) || 0;
  if (total === 0) return 0;
  const remaining = Number(row.remaining_balance) || 0;
  return Math.min(100, Math.round(((total - remaining) / total) * 100));
}

export default function StaffAdvancesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [employeeId, setEmployeeId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['staff-advances', token, status, type, employeeId, search, page],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 12 };
      if (status !== 'all') params.status = status;
      if (type !== 'all') params.advance_type = type;
      if (employeeId !== 'all') params.employee_id = employeeId;
      if (search.trim()) params.search = search.trim();
      return fetchStaffAdvances(token, params);
    },
    enabled: !!token,
  });

  const employeesQuery = useQuery({
    queryKey: ['employees', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployees(token, { limit: 250, status: 'active' });
    },
    enabled: !!token,
  });

  const approve = useMutation({
    mutationFn: ({ id }: { id: number }) => approveStaffAdvance(token!, id),
    onSuccess: (res) => { toast.success(res.message); queryClient.invalidateQueries({ queryKey: ['staff-advances'] }); },
    onError: () => toast.error('Approve failed'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectStaffAdvance(token!, id, reason),
    onSuccess: (res) => { toast.success(res.message); queryClient.invalidateQueries({ queryKey: ['staff-advances'] }); },
    onError: () => toast.error('Reject failed'),
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: number }) => deleteStaffAdvance(token!, id),
    onSuccess: (res) => { toast.success(res.message); queryClient.invalidateQueries({ queryKey: ['staff-advances'] }); },
    onError: () => toast.error('Delete failed'),
  });

  const advances = data?.data ?? [];
  const stats = data?.stats;
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0 };

  const employees = employeesQuery.data?.data ?? [];

  const statCards = stats
    ? [
        { label: 'Total Issued', value: formatCurrency(stats.totalIssued), icon: Wallet },
        { label: 'Outstanding', value: formatCurrency(stats.totalOutstanding), icon: HandCoins, accent: 'warning' as const },
        { label: 'Recovered', value: formatCurrency(stats.totalRecovered), icon: CheckCircle2, accent: 'success' as const },
        { label: 'Pending', value: stats.pendingCount ?? 0, icon: HandCoins, accent: 'primary' as const },
      ]
    : [];

  const handleReject = (id: number) => {
    const reason = window.prompt('Reason for rejection');
    if (reason === null) return;
    if (!reason.trim()) return toast.error('A reason is required');
    reject.mutate({ id, reason });
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Delete this advance permanently?')) {
      remove.mutate({ id });
    }
  };

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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => <SelectItem key={t} value={t}>{t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setPage(1); }}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {employees.map((e: any) => {
                const p = e.profiles || e.user;
                const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : `Employee #${e.id}`;
                return <SelectItem key={e.id} value={String(e.id)}>{name}</SelectItem>;
              })}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search title, employee, notes..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 w-full sm:w-[260px]"
            />
          </div>
        </div>

        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          onPageChange={setPage}
        />
      </div>

      {error ? (
        <div className="text-destructive">Failed to load staff advances.</div>
      ) : (
        <DataTable<StaffAdvance>
          headers={[
            { key: 'id', label: '#' },
            { key: 'employee', label: 'Employee' },
            { key: 'title', label: 'Advance' },
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status' },
            { key: 'progress', label: 'Recovery' },
            { key: 'total', label: 'Total', className: 'text-right' },
            { key: 'remaining', label: 'Remaining', className: 'text-right' },
            { key: 'actions', label: '', className: 'w-[100px]' },
          ]}
          data={advances}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => router.push(`/admin/finance/staff-advances/${row.id}`)}
          loading={isLoading}
          emptyText="No staff advances found."
          renderRow={(row) => {
            const pct = recoveryPct(row);
            return [
              <span key="id" className="text-muted-foreground">#{row.id}</span>,
              <span key="employee" className="font-medium">{employeeName(row.employee)}</span>,
              <div key="title">
                <p className="font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{row.description}</p>
              </div>,
              <Badge key="type" variant="outline" className="capitalize">{row.advance_type}</Badge>,
              <Badge key="status" variant={statusBadge(row.status)} className="capitalize">{row.status.replace('_', ' ')}</Badge>,
              <div key="progress" className="min-w-[100px]">
                <div className="flex justify-between text-xs mb-1"><span>{pct}%</span></div>
                <Progress value={pct} className="h-2" />
              </div>,
              <span key="total" className="text-right font-medium">{formatCurrency(row.total_amount)}</span>,
              <span key="remaining" className="text-right">{formatCurrency(row.remaining_balance)}</span>,
              <div key="actions" className="flex items-center justify-end gap-1">
                {row.status === 'pending' && (
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Approve" onClick={(e) => { e.stopPropagation(); approve.mutate({ id: row.id }); }}>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Reject" onClick={(e) => { e.stopPropagation(); handleReject(row.id); }}>
                      <XCircle className="h-4 w-4 text-red-600" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>,
            ];
          }}
        />
      )}
    </PageShell>
  );
}
