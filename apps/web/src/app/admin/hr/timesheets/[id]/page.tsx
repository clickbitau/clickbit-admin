'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { toast } from 'sonner';
import {
  approveTimesheet,
  deleteTimesheet,
  editTimesheet,
  fetchTasks,
  fetchTimesheet,
  rejectTimesheet,
  addTimesheetWorkItem,
  removeTimesheetWorkItem,
} from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { ArrowLeft, CheckCircle, Clock, DollarSign, MapPin, Search, Square, Trash2, User, XCircle } from 'lucide-react';

function formatDuration(minutes?: number | null) {
  if (!minutes) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function parseGps(coords?: string | null): Array<{ timestamp: string; latitude: number; longitude: number; accuracy?: number; address?: string }> {
  if (!coords) return [];
  try {
    const parsed = JSON.parse(coords);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export default function AdminTimesheetDetailPage() {
  const { token, user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [taskSearch, setTaskSearch] = useState('');
  const [taskResults, setTaskResults] = useState<any[]>([]);
  const [searchingTasks, setSearchingTasks] = useState(false);

  const { data: entry, isLoading, error } = useQuery({
    queryKey: ['timesheet', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimesheet(token, id);
    },
    enabled: !!token && !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['timesheet', token, id] });
    queryClient.invalidateQueries({ queryKey: ['timesheets', token] });
  };

  const approve = useMutation({
    mutationFn: () => approveTimesheet(token!, id),
    onSuccess: () => { toast.success('Timesheet approved'); invalidate(); },
    onError: () => toast.error('Approve failed'),
  });

  const reject = useMutation({
    mutationFn: () => rejectTimesheet(token!, id, 'Rejected from detail page'),
    onSuccess: () => { toast.success('Timesheet rejected'); invalidate(); },
    onError: () => toast.error('Reject failed'),
  });

  const remove = useMutation({
    mutationFn: () => deleteTimesheet(token!, id),
    onSuccess: () => { toast.success('Timesheet deleted'); router.push('/admin/hr/timesheets'); },
    onError: () => toast.error('Delete failed'),
  });

  const signOut = useMutation({
    mutationFn: () => editTimesheet(token!, id, { clock_out_time: new Date().toISOString(), break_minutes: entry?.break_minutes || 0, reason: 'Signed out from detail page' } as any),
    onSuccess: () => { toast.success('Signed out'); invalidate(); },
    onError: () => toast.error('Sign out failed'),
  });

  const removeWorkItem = useMutation({
    mutationFn: (itemId: number) => removeTimesheetWorkItem(token!, id, itemId),
    onSuccess: () => { toast.success('Work item removed'); invalidate(); },
    onError: () => toast.error('Failed to remove work item'),
  });

  const handleTaskSearch = async (q: string) => {
    setTaskSearch(q);
    if (q.length < 2) { setTaskResults([]); return; }
    setSearchingTasks(true);
    try {
      const res = await fetchTasks(token!, { search: q, limit: 10 });
      setTaskResults(res.data || []);
    } catch { setTaskResults([]); } finally { setSearchingTasks(false); }
  };

  const handleAddTask = async (task: any, hours?: string) => {
    const actual = hours ? Number(hours) : undefined;
    if (hours && Number.isNaN(actual)) return;
    await addTimesheetWorkItem(token!, id, { task_id: task.id, hours_spent: actual });
    toast.success('Task linked');
    setTaskSearch('');
    setTaskResults([]);
    invalidate();
  };

  if (error) {
    return (
      <PageShell title="Timesheet" icon={Clock} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/hr/timesheets"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load timesheet.</div>
      </PageShell>
    );
  }

  const estimatedPay = entry && entry.total_minutes && entry.employee?.hourly_rate
    ? (Number(entry.total_minutes) / 60) * Number(entry.employee.hourly_rate)
    : 0;

  const gps = parseGps(entry?.gps_coordinates);

  const timeline = entry ? [
    { label: 'Clocked in', time: entry.clock_in_time, icon: Clock, note: entry.clock_in_address, color: 'bg-blue-500' },
    ...(entry.break_start_time ? [{ label: 'Break started', time: entry.break_start_time, icon: Clock, note: undefined, color: 'bg-yellow-500' }] : []),
    ...(entry.clock_out_time ? [{ label: 'Clocked out', time: entry.clock_out_time, icon: Clock, note: entry.clock_out_address, color: 'bg-emerald-500' }] : []),
    ...(entry.approved_at ? [{ label: entry.status === 'rejected' ? 'Rejected' : 'Approved', time: entry.approved_at, icon: entry.status === 'rejected' ? XCircle : CheckCircle, note: entry.approved_by_name, color: entry.status === 'rejected' ? 'bg-red-500' : 'bg-emerald-500' }] : []),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()) : [];

  const statCards = entry
    ? [
        { label: 'Status', value: entry.status, icon: CheckCircle },
        { label: 'Duration', value: formatDuration(entry.total_minutes), icon: Clock },
        { label: 'Break', value: formatDuration(entry.break_minutes), icon: Clock },
        { label: 'Overtime', value: formatDuration(entry.overtime_minutes), icon: Clock },
        { label: 'Estimated pay', value: formatCurrency(estimatedPay), icon: DollarSign },
      ]
    : [];

  return (
    <PageShell
      title={entry ? `Timesheet #${entry.id}` : 'Timesheet'}
      icon={Clock}
      description={entry ? `${entry.employee?.name || `Employee ${entry.employee_id}`} · ${formatDate(entry.clock_in_time)}` : ''}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/admin/hr/timesheets"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>
          {entry?.status !== 'approved' && <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}><CheckCircle className="mr-1 h-4 w-4" /> Approve</Button>}
          {entry?.status !== 'rejected' && <Button variant="outline" size="sm" onClick={() => reject.mutate()} disabled={reject.isPending}><XCircle className="mr-1 h-4 w-4" /> Reject</Button>}
          {entry && !entry.clock_out_time && <Button variant="outline" size="sm" onClick={() => signOut.mutate()} disabled={signOut.isPending}><Square className="mr-1 h-4 w-4" /> Sign Out</Button>}
          {isManager && <Button variant="destructive" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>}
        </div>
      }
    >
      {isLoading || !entry ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="nm-raised p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-xl font-bold">{card.label === 'Status' ? <StatusBadge status={card.value} /> : card.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card className="nm-raised">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-2xl">Timesheet #{entry.id}</CardTitle>
                      <p className="text-sm text-muted-foreground">{entry.employee?.name || `Employee ${entry.employee_id}`} · {formatDate(entry.clock_in_time)}</p>
                    </div>
                    <StatusBadge status={entry.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="nm-raised-sm border-l-4 border-l-primary">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Clock In</CardTitle></CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        <p className="text-lg font-semibold">{formatDateTime(entry.clock_in_time)}</p>
                        {entry.clock_in_address && <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {entry.clock_in_address}</p>}
                        {entry.clock_in_notes && <p className="text-muted-foreground">{entry.clock_in_notes}</p>}
                      </CardContent>
                    </Card>

                    <Card className="nm-raised-sm border-l-4 border-l-secondary">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Clock Out</CardTitle></CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        <p className="text-lg font-semibold">{entry.clock_out_time ? formatDateTime(entry.clock_out_time) : '—'}</p>
                        {entry.clock_out_address && <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {entry.clock_out_address}</p>}
                        {entry.clock_out_notes && <p className="text-muted-foreground">{entry.clock_out_notes}</p>}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2 pt-2">
                    <p><span className="text-muted-foreground">Duration:</span> {formatDuration(entry.total_minutes)}</p>
                    <p><span className="text-muted-foreground">Break:</span> {formatDuration(entry.break_minutes)}</p>
                    <p><span className="text-muted-foreground">Overtime:</span> {formatDuration(entry.overtime_minutes)}</p>
                    <p><span className="text-muted-foreground">Hourly rate:</span> {formatCurrency(entry.employee?.hourly_rate ?? undefined)}</p>
                    <p><span className="text-muted-foreground">Estimated pay:</span> {formatCurrency(estimatedPay)}</p>
                    <p><span className="text-muted-foreground">Approved by:</span> {entry.approved_by_name || (entry.approved_by ? `User ${entry.approved_by}` : '—')}</p>
                    <p><span className="text-muted-foreground">Approved at:</span> {entry.approved_at ? formatDateTime(entry.approved_at) : '—'}</p>
                    <p><span className="text-muted-foreground">Manual edit reason:</span> {(entry as any).edit_reason || (entry as any).edit_request?.reason || '—'}</p>
                  </div>

                  {entry.notes && (
                    <div className="nm-inset-sm p-3 rounded-lg">
                      <h4 className="font-medium mb-1">Notes</h4>
                      <p className="whitespace-pre-wrap text-muted-foreground">{entry.notes}</p>
                    </div>
                  )}

                  {entry.admin_notes && (
                    <div className="nm-inset-sm p-3 rounded-lg">
                      <h4 className="font-medium mb-1">Admin notes</h4>
                      <p className="whitespace-pre-wrap text-muted-foreground">{entry.admin_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader><CardTitle>Work Items</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {entry.work_items && entry.work_items.length > 0 ? (
                    <div className="space-y-2">
                      {entry.work_items.map((wi: any) => (
                        <div key={wi.id} className="flex items-center justify-between p-2 nm-inset-sm rounded-lg text-sm">
                          <div>
                            <p className="font-medium">{wi.project_tasks?.title || `Task ${wi.task_id || wi.id}`}</p>
                            <p className="text-xs text-muted-foreground">{wi.project_tasks?.status || 'Active'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{wi.hours_spent != null ? `${wi.hours_spent}h` : ''}</span>
                            {isManager && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeWorkItem.mutate(wi.id)} disabled={removeWorkItem.isPending}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No work items linked.</p>
                  )}

                  {isManager && (
                    <div className="space-y-2">
                      <LabelWithIcon icon={Search} label="Link a task" />
                      <div className="relative">
                        <Input placeholder="Search tasks by title..." value={taskSearch} onChange={(e) => handleTaskSearch(e.target.value)} />
                        {searchingTasks && <span className="absolute right-2 top-2 text-xs text-muted-foreground">Searching...</span>}
                      </div>
                      {taskResults.length > 0 && (
                        <div className="nm-inset-sm rounded-lg max-h-48 overflow-y-auto p-1 space-y-1">
                          {taskResults.map((task) => (
                            <div key={task.id} className="flex items-center justify-between p-2 text-sm hover:bg-primary/5 rounded-md">
                              <span className="truncate">{task.title}</span>
                              <div className="flex items-center gap-1">
                                <Input type="number" placeholder="hrs" className="w-16 h-8" id={`hrs-${task.id}`} />
                                <Button size="sm" onClick={() => handleAddTask(task, (document.getElementById(`hrs-${task.id}`) as HTMLInputElement)?.value)}>Add</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
                <CardContent>
                  <div className="relative pl-4 border-l border-border/50 space-y-6">
                    {timeline.map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div key={idx} className="relative">
                          <span className={`absolute -left-[21px] top-0 w-3 h-3 rounded-full ${item.color} ring-2 ring-background`} />
                          <p className="text-sm font-medium flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /> {item.label}</p>
                          <p className="text-sm">{formatDateTime(item.time)}</p>
                          {item.note && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {item.note}</p>}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {gps.length > 0 && (
                <Card className="nm-raised">
                  <CardHeader><CardTitle>GPS Breadcrumbs ({gps.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-2 max-h-64 overflow-y-auto">
                      {gps.map((point, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 nm-inset-sm rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3 text-primary" />
                            <span>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{point.timestamp ? formatDateTime(point.timestamp) : '—'}</p>
                            {point.accuracy && <p className="text-xs text-muted-foreground">±{Math.round(point.accuracy)}m</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card className="nm-raised">
                <CardHeader><CardTitle>Employee</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-3">
                  <div className="flex items-center gap-3">
                    {((entry.employee as any)?.user)?.avatar ? (
                      <img src={(entry.employee as any).user.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{entry.employee?.name || `Employee ${entry.employee_id}`}</p>
                      <p className="text-muted-foreground">{entry.employee?.email || '—'}</p>
                    </div>
                  </div>
                  <p><span className="text-muted-foreground">Rate:</span> {formatCurrency(entry.employee?.hourly_rate ?? undefined)}</p>
                  <Button variant="outline" size="sm" asChild className="w-full"><Link href={`/admin/hr/employees/${entry.employee_id}`}>View Employee</Link></Button>
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader><CardTitle>Shift</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                  {entry.shift ? (
                    <>
                      <p className="font-medium">{entry.shift.position || 'Shift'} · {entry.shift.department || '—'}</p>
                      <p className="text-muted-foreground">{formatDate(entry.shift.shift_date)} {entry.shift.start_time ? `at ${entry.shift.start_time}` : ''}</p>
                      <p className="text-xs text-muted-foreground capitalize">Status: {entry.shift.status}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No linked shift.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="nm-raised">
                <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {entry.status !== 'approved' && <Button className="w-full" onClick={() => approve.mutate()} disabled={approve.isPending}><CheckCircle className="mr-1 h-4 w-4" /> Approve</Button>}
                  {entry.status !== 'rejected' && <Button variant="outline" className="w-full" onClick={() => reject.mutate()} disabled={reject.isPending}><XCircle className="mr-1 h-4 w-4" /> Reject</Button>}
                  {!entry.clock_out_time && <Button variant="outline" className="w-full" onClick={() => signOut.mutate()} disabled={signOut.isPending}><Square className="mr-1 h-4 w-4" /> Sign Out</Button>}
                  {isManager && <Button variant="destructive" className="w-full" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}

function LabelWithIcon({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </div>
  );
}
