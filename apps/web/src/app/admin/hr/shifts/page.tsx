'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle, Copy, Plus, Trash2 } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/components/auth/AuthProvider';
import { confirmShift, copyShiftsWeek, createShift, deleteShift, fetchShifts, publishShifts } from '@/lib/api';

export default function AdminHrShiftsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [newShift, setNewShift] = useState<Record<string, string>>({});

  const params = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: 20 };
    if (startDate) p.start_date = startDate;
    if (endDate) p.end_date = endDate;
    return p;
  }, [startDate, endDate, page]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['shifts', token, params],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchShifts(token, params);
    },
    enabled: !!token,
  });

  const shifts = useMemo(() => data?.data ?? [], [data?.data]);
  const stats = useMemo(() => {
    const total = shifts.length;
    const open = shifts.filter((s: any) => s.is_open_shift).length;
    const published = shifts.filter((s: any) => s.status === 'published').length;
    const confirmed = shifts.filter((s: any) => s.employee_confirmed).length;
    return { total, open, published, confirmed };
  }, [shifts]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['shifts', token] });

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

  const statCards = [
    { label: 'Total Shifts', value: stats.total, icon: Calendar },
    { label: 'Open Shifts', value: stats.open, icon: Calendar, accent: stats.open ? ('warning' as const) : undefined },
    { label: 'Published', value: stats.published, icon: CheckCircle },
    { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle, accent: stats.confirmed ? ('success' as const) : undefined },
  ];

  return (
    <PageShell title="Shifts" icon={Calendar} description="Manage employee shift rosters and open shift claims." actions={<Button asChild><Link href="/admin/hr/shifts/new"><Plus className="mr-2 h-4 w-4" /> New Shift</Link></Button>}>
      <StatCards cards={statCards} />

      <div className="flex flex-wrap gap-2">
        <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-auto" />
        <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-auto" />
        <Button
          variant="outline"
          onClick={() => {
            const source = startDate || new Date().toISOString().slice(0, 10);
            copy.mutate(source);
          }}
          disabled={copy.isPending}
        >
          <Copy className="mr-2 h-4 w-4" /> Copy Week
        </Button>
      </div>

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle>Quick Add Shift</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <Input placeholder="Employee ID" value={newShift.employee_id ?? ''} onChange={(e) => setNewShift({ ...newShift, employee_id: e.target.value })} />
          <Input type="date" value={newShift.shift_date ?? ''} onChange={(e) => setNewShift({ ...newShift, shift_date: e.target.value })} />
          <Input type="time" value={newShift.start_time ?? ''} onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })} />
          <Input type="time" value={newShift.end_time ?? ''} onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })} />
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </CardContent>
      </Card>

      <Card className="nm-raised">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Shifts</CardTitle>
          <Button size="sm" variant="outline" onClick={() => publish.mutate(shifts.filter((s: any) => s.status === 'draft').map((s: any) => s.id))} disabled={publish.isPending}>
            Publish Drafts
          </Button>
        </CardHeader>
        <CardContent>
          {error && <div className="text-destructive">Failed to load shifts.</div>}
          {isLoading && <div className="text-muted-foreground">Loading...</div>}

          {!isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No shifts found.</TableCell>
                  </TableRow>
                )}
                {shifts.map((shift: any) => (
                  <TableRow
                    key={shift.id}
                    className="cursor-pointer hover:bg-primary/5"
                    onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; router.push(`/admin/hr/shifts/${shift.id}`); }}
                  >
                    <TableCell>{shift.employee?.name || `Employee ${shift.employee_id}`}</TableCell>
                    <TableCell>{shift.shift_date ? new Date(shift.shift_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{shift.start_time || '-'}</TableCell>
                    <TableCell>{shift.end_time || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Badge variant={shift.status === 'published' ? 'default' : 'secondary'}>{shift.status}</Badge>
                        {shift.is_open_shift && <Badge variant="outline">Open</Badge>}
                        {shift.employee_confirmed && <Badge variant="outline">Confirmed</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {!shift.employee_confirmed && (
                        <Button size="sm" variant="outline" onClick={() => confirm.mutate(shift.id)} disabled={confirm.isPending}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => remove.mutate(shift.id)} disabled={remove.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">Page {page}</p>
            <div className="space-x-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
