'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle, Copy, Plus, Search, Trash2 } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { ShiftForm } from '@/components/hr/ShiftForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/AuthProvider';
import { confirmShift, copyShiftsWeek, createShift, deleteShift, fetchHrStats, fetchShifts, publishShifts } from '@/lib/api';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { formatDate } from '@/lib/format';
import type { Shift } from '@/types/hr';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const LIMIT = 20;

export default function AdminHrShiftsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [newShift, setNewShift] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string | number> = {};
    if (startDate) p.start_date = startDate;
    if (endDate) p.end_date = endDate;
    if (status) p.status = status;
    return p;
  }, [startDate, endDate, status]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['shifts', token, params],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchShifts(token, params); },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['hr-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchHrStats(token); },
    enabled: !!token,
  });

  useRealtimeRefresh(['shifts'], ['shifts'], { enabled: !!token });

  const allShifts = useMemo(() => data?.data ?? [], [data?.data]);
  const stats = statsData?.data;

  const filtered = useMemo(() => {
    let rows = [...allShifts];
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      rows = rows.filter((s) =>
        (s.employee?.name || '').toLowerCase().includes(q) ||
        (s.department || '').toLowerCase().includes(q) ||
        (s.position || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [allShifts, debouncedSearch]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const pageSafe = Math.min(page, totalPages);
  const shifts = useMemo(() => filtered.slice((pageSafe - 1) * LIMIT, pageSafe * LIMIT), [filtered, pageSafe]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['shifts', token] });
    queryClient.invalidateQueries({ queryKey: ['hr-stats', token] });
  };

  const create = useMutation({
    mutationFn: () => createShift(token!, newShift),
    onSuccess: () => { refresh(); setNewShift({}); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteShift(token!, id),
    onSuccess: refresh,
  });

  const publish = useMutation({
    mutationFn: (ids: number[]) => publishShifts(token!, ids),
    onSuccess: refresh,
  });

  const confirm = useMutation({
    mutationFn: (id: number) => confirmShift(token!, id),
    onSuccess: refresh,
  });

  const copy = useMutation({
    mutationFn: (source: string) => {
      const target = new Date(source);
      target.setDate(target.getDate() + 7);
      return copyShiftsWeek(token!, source, target.toISOString().slice(0, 10));
    },
    onSuccess: refresh,
  });

  const statCards = useMemo(() => {
    const fromData = {
      open: allShifts.filter((s) => s.is_open_shift).length,
      confirmed: allShifts.filter((s) => s.employee_confirmed).length,
      published: allShifts.filter((s) => s.status === 'published').length,
    };
    if (!stats) {
      return [
        { label: 'Total', value: allShifts.length, icon: Calendar },
        { label: 'Open', value: fromData.open, icon: Calendar, accent: 'warning' as const },
        { label: 'Published', value: fromData.published, icon: Calendar },
        { label: 'Confirmed', value: fromData.confirmed, icon: CheckCircle, accent: 'success' as const },
      ];
    }
    return [
      { label: 'Total', value: stats.shifts.total, icon: Calendar },
      { label: 'Today', value: stats.shifts.today, icon: Calendar, accent: 'primary' as const },
      { label: 'Upcoming', value: stats.shifts.upcoming, icon: Calendar, accent: 'warning' as const },
      { label: 'Completed', value: stats.shifts.completed, icon: CheckCircle, accent: 'success' as const },
    ];
  }, [stats, allShifts]);

  return (
    <PageShell
      title="Shifts"
      icon={Calendar}
      description="Manage employee shift rosters and open shift claims."
      actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Shift</Button>}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle>Quick Add Shift</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <Input placeholder="Employee ID" value={newShift.employee_id ?? ''} onChange={(e) => setNewShift({ ...newShift, employee_id: e.target.value })} />
          <Input type="date" value={newShift.shift_date ?? ''} onChange={(e) => setNewShift({ ...newShift, shift_date: e.target.value })} />
          <Input type="time" value={newShift.start_time ?? ''} onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })} />
          <Input type="time" value={newShift.end_time ?? ''} onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })} />
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search shifts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
        <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
        <Button variant="outline" onClick={() => { const source = startDate || new Date().toISOString().slice(0, 10); copy.mutate(source); }} disabled={copy.isPending}>
          <Copy className="mr-2 h-4 w-4" /> Copy Week
        </Button>
        <Button variant="outline" onClick={() => publish.mutate(allShifts.filter((s) => s.status === 'draft').map((s) => s.id))} disabled={publish.isPending}>
          Publish Drafts
        </Button>
      </div>

      {error ? (
        <div className="text-destructive text-sm">Failed to load shifts.</div>
      ) : (
        <>
          <DataTable
            headers={[
              { key: 'employee', label: 'Employee' },
              { key: 'date', label: 'Date' },
              { key: 'start', label: 'Start' },
              { key: 'end', label: 'End' },
              { key: 'department', label: 'Department' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '' },
            ]}
            data={shifts}
            keyExtractor={(s) => s.id}
            loading={isLoading}
            onRowClick={(s) => router.push(`/admin/hr/shifts/${s.id}`)}
            emptyText="No shifts found."
            emptyDescription="Try adjusting date range or search."
            renderRow={(s: Shift) => [
              <div key="employee" className="flex items-center gap-3">
              <PersonAvatar name={s.employee?.name || `Employee ${s.employee_id}`} />
              <span>{s.employee?.name || `Employee ${s.employee_id}`}</span>
            </div>,
              <span key="date">{formatDate(s.shift_date)}</span>,
              <span key="start">{s.start_time || '-'}</span>,
              <span key="end">{s.end_time || '-'}</span>,
              <span key="department">{s.department || '-'}</span>,
              <div key="status" className="flex flex-wrap gap-1">
                <StatusBadge status={s.status} />
                {s.is_open_shift && <StatusBadge status="open" />}
                {s.employee_confirmed && <StatusBadge status="confirmed" />}
              </div>,
              <div key="actions" className="flex justify-end gap-1">
                {s.status !== 'cancelled' && !s.employee_confirmed && (
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); confirm.mutate(s.id); }} disabled={confirm.isPending}>
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); remove.mutate(s.id); }} disabled={remove.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>,
            ]}
          />
          <Pagination currentPage={pageSafe} totalPages={totalPages} totalItems={total} onPageChange={setPage} />
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Shift</DialogTitle>
            <DialogDescription>Add an employee shift to the roster.</DialogDescription>
          </DialogHeader>
          {token && (
            <ShiftForm
              token={token}
              onSuccess={() => { setCreateOpen(false); refresh(); }}
              onCancel={() => setCreateOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
