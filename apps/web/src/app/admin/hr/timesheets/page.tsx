'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle, Clock, Coffee, FileClock, Plus, XCircle } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/components/auth/AuthProvider';
import { approveTimesheet, deleteTimesheet, fetchTimesheets, rejectTimesheet } from '@/lib/api';

function formatDuration(minutes?: number | null) {
  if (!minutes) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function AdminHrTimesheetsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: 20 };
    if (status) p.status = status;
    if (startDate) p.start_date = startDate;
    if (endDate) p.end_date = endDate;
    return p;
  }, [status, startDate, endDate, page]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['timesheets', token, params],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimesheets(token, params);
    },
    enabled: !!token,
  });

  const entries = data?.data ?? [];
  const summary = data?.summary ?? { totalHours: 0, totalBreakHours: 0, entriesCount: 0, pendingApprovals: 0 };
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 20 };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['timesheets', token] });

  const approve = useMutation({ mutationFn: (id: number) => approveTimesheet(token!, id), onSuccess: refresh });
  const reject = useMutation({ mutationFn: (id: number) => rejectTimesheet(token!, id, 'Rejected from UI'), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => deleteTimesheet(token!, id), onSuccess: refresh });

  const statCards = [
    { label: 'Total Hours', value: Number(summary.totalHours || 0).toFixed(2), icon: Clock },
    { label: 'Break Hours', value: Number(summary.totalBreakHours || 0).toFixed(2), icon: Coffee },
    { label: 'Entries', value: summary.entriesCount ?? 0, icon: FileClock },
    { label: 'Pending Approvals', value: summary.pendingApprovals ?? 0, icon: Calendar, accent: summary.pendingApprovals ? ('warning' as const) : undefined },
  ];

  const statusColor: Record<string, string> = {
    active: 'default',
    completed: 'secondary',
    approved: 'default',
    rejected: 'destructive',
    edited: 'outline',
  };

  return (
    <PageShell title="Timesheets" icon={FileClock} description="Review, approve, and manage employee time entries." actions={<Button asChild><Link href="/admin/hr/timesheets/new"><Plus className="mr-1 h-4 w-4" /> New Entry</Link></Button>}>
      <StatCards cards={statCards} />

      <div className="flex flex-wrap gap-2">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="edited">Edited</option>
        </select>
        <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-auto" />
        <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-auto" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="text-destructive">Failed to load timesheets.</div>}
          {isLoading && <div className="text-muted-foreground">Loading...</div>}

          {!isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No entries found.</TableCell>
                  </TableRow>
                )}
                {entries.map((entry: any) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer hover:bg-primary/5"
                    onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; router.push(`/admin/hr/timesheets/${entry.id}`); }}
                  >
                    <TableCell>{entry.employee?.name || entry.employee?.email || `Employee ${entry.employee_id}`}</TableCell>
                    <TableCell>{entry.clock_in_time ? new Date(entry.clock_in_time).toLocaleString() : '-'}</TableCell>
                    <TableCell>{entry.clock_out_time ? new Date(entry.clock_out_time).toLocaleString() : '-'}</TableCell>
                    <TableCell>{formatDuration(entry.total_minutes)}</TableCell>
                    <TableCell>
                      <Badge variant={(statusColor[entry.status] as any) || 'secondary'}>{entry.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {entry.status !== 'approved' && (
                        <Button size="sm" variant="outline" onClick={() => approve.mutate(entry.id)} disabled={approve.isPending}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {entry.status !== 'rejected' && (
                        <Button size="sm" variant="outline" onClick={() => reject.mutate(entry.id)} disabled={reject.isPending}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => remove.mutate(entry.id)} disabled={remove.isPending}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.pages} ({pagination.total} total)</p>
            <div className="space-x-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
