'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle, Clock, Coffee, FileClock, Plus, XCircle, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/auth/AuthProvider';
import { approveTimesheet, deleteTimesheet, fetchEmployees, fetchTimesheets, rejectTimesheet } from '@/lib/api';

function formatDuration(minutes?: number | null) {
  if (!minutes) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(date: Date) {
  return date.toISOString().split('T')[0];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AdminHrTimesheetsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [view, setView] = useState<'list' | 'schedule'>('list');
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [status, setStatus] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [page, setPage] = useState(1);

  const startDate = useMemo(() => toISODate(weekStart), [weekStart]);
  const endDate = useMemo(() => toISODate(addDays(weekStart, 6)), [weekStart]);

  const params = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: 50, start_date: startDate, end_date: endDate };
    if (status) p.status = status;
    if (employeeId && isManager) p.employee_id = employeeId;
    return p;
  }, [page, startDate, endDate, status, employeeId, isManager]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['timesheets', token, params],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimesheets(token, params);
    },
    enabled: !!token,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees', token, { limit: 200 }],
    queryFn: async () => {
      if (!token || !isManager) throw new Error('No token');
      return fetchEmployees(token, { limit: 200 });
    },
    enabled: !!token && isManager,
  });

  const entries = data?.data ?? [];
  const summary = data?.summary ?? { totalHours: 0, totalBreakHours: 0, entriesCount: 0, pendingApprovals: 0, totalEstimatedPay: 0 };
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 50 };
  const employees = employeesData?.data ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['timesheets', token] });

  const approve = useMutation({ mutationFn: (id: number) => approveTimesheet(token!, id), onSuccess: refresh });
  const reject = useMutation({ mutationFn: (id: number) => rejectTimesheet(token!, id, 'Rejected from UI'), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => deleteTimesheet(token!, id), onSuccess: refresh });

  const statCards = [
    { label: 'Total Hours', value: Number(summary.totalHours || 0).toFixed(2), icon: Clock },
    { label: 'Break Hours', value: Number(summary.totalBreakHours || 0).toFixed(2), icon: Coffee },
    { label: 'Entries', value: summary.entriesCount ?? 0, icon: FileClock },
    { label: 'Pending Approvals', value: summary.pendingApprovals ?? 0, icon: Calendar, accent: summary.pendingApprovals ? ('warning' as const) : undefined },
    ...(isManager ? [{ label: 'Est. Pay', value: `$${Number(summary.totalEstimatedPay || 0).toFixed(2)}`, icon: DollarSign }] : []),
  ];

  const statusColor: Record<string, string> = {
    active: 'default',
    completed: 'secondary',
    approved: 'default',
    rejected: 'destructive',
    edited: 'outline',
  };

  const schedule = useMemo(() => {
    const map = new Map<string | number, Record<string, { minutes: number; entries: number; onBreak: boolean }>>();
    const employeeList = employeesData?.data ?? [];
    const entryList = data?.data ?? [];
    employeeList.forEach((emp: any) => {
      map.set(emp.id, { name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || `Employee ${emp.id}` } as any);
      for (let i = 0; i < 7; i++) {
        const day = toISODate(addDays(weekStart, i));
        (map.get(emp.id) as any)[day] = { minutes: 0, entries: 0, onBreak: false };
      }
    });
    entryList.forEach((entry: any) => {
      const empId = entry.employee_id;
      const day = entry.clock_in_time ? entry.clock_in_time.split('T')[0] : '';
      if (!map.has(empId)) {
        map.set(empId, { name: entry.employee?.name || entry.employee?.email || `Employee ${empId}` } as any);
        for (let i = 0; i < 7; i++) {
          const d = toISODate(addDays(weekStart, i));
          (map.get(empId) as any)[d] = { minutes: 0, entries: 0, onBreak: false };
        }
      }
      if (day && (map.get(empId) as any)[day]) {
        (map.get(empId) as any)[day].minutes += entry.total_minutes || 0;
        (map.get(empId) as any)[day].entries += 1;
        if (entry.is_on_break) (map.get(empId) as any)[day].onBreak = true;
      }
    });
    return Array.from(map.entries()).map(([id, days]: [any, any]) => ({ id, name: days.name, days }));
  }, [data?.data, employeesData?.data, weekStart]);

  useEffect(() => {
    setPage(1);
  }, [weekStart, status, employeeId]);

  const weekRangeText = `${startDate} — ${endDate}`;

  return (
    <PageShell
      title="Timesheets"
      icon={FileClock}
      description={`${weekRangeText} · Review, approve, and manage employee time entries.`}
      actions={<Button asChild><Link href="/admin/hr/timesheets/new"><Plus className="mr-1 h-4 w-4" /> New Entry</Link></Button>}
    >
      <StatCards cards={statCards} />

      <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'schedule')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 nm-raised-sm rounded-md p-0.5">
              <Button size="sm" variant="ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm px-2 min-w-[140px] text-center font-medium">{weekRangeText}</span>
              <Button size="sm" variant="ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))}>This Week</Button>
          </div>
        </div>

        <TabsContent value="list" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2">
            {isManager && (
              <select
                value={employeeId}
                onChange={(e) => { setEmployeeId(e.target.value); setPage(1); }}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Employees</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {`${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || `Employee ${emp.id}`}
                  </option>
                ))}
              </select>
            )}
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
                          {entry.status !== 'approved' && entry.clock_out_time && (
                            <Button size="sm" variant="outline" onClick={() => approve.mutate(entry.id)} disabled={approve.isPending}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {entry.status !== 'rejected' && (
                            <Button size="sm" variant="outline" onClick={() => reject.mutate(entry.id)} disabled={reject.isPending}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {isManager && (
                            <Button size="sm" variant="outline" onClick={() => remove.mutate(entry.id)} disabled={remove.isPending}>
                              Delete
                            </Button>
                          )}
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
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading && <div className="text-muted-foreground">Loading...</div>}
              {!isLoading && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">Employee</TableHead>
                        {Array.from({ length: 7 }).map((_, i) => {
                          const day = toISODate(addDays(weekStart, i));
                          return <TableHead key={day} className="text-center min-w-[90px]">{DAY_LABELS[i]}<br /><span className="text-[10px] text-muted-foreground">{day}</span></TableHead>;
                        })}
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground">No employees or entries for this week.</TableCell>
                        </TableRow>
                      )}
                      {schedule.map((row: any) => {
                        let totalMinutes = 0;
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            {Array.from({ length: 7 }).map((_, i) => {
                              const day = toISODate(addDays(weekStart, i));
                              const cell = row.days[day] || { minutes: 0, entries: 0, onBreak: false };
                              totalMinutes += cell.minutes;
                              return (
                                <TableCell key={day} className="p-1">
                                  {cell.entries > 0 ? (
                                    <button
                                      onClick={() => { setEmployeeId(String(row.id)); setStatus(''); setView('list'); }}
                                      className="h-10 w-full rounded-md nm-raised-sm flex flex-col items-center justify-center text-xs hover:shadow-md transition-all"
                                    >
                                      <span className="font-semibold">{(cell.minutes / 60).toFixed(1)}h</span>
                                      {cell.onBreak && <span className="text-[9px] text-yellow-600">break</span>}
                                    </button>
                                  ) : (
                                    <div className="h-10 rounded-md bg-muted/50" />
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-right font-semibold">{(totalMinutes / 60).toFixed(1)}h</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
