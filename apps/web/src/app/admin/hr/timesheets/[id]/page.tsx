'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { approveTimesheet, deleteTimesheet, fetchTimesheet, rejectTimesheet } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { ArrowLeft, CheckCircle, Clock, DollarSign, MapPin, Timer, Trash, XCircle } from 'lucide-react';

function statusVariant(status?: string | null) {
  if (status === 'approved') return 'default';
  if (status === 'completed') return 'secondary';
  if (status === 'active') return 'default';
  if (status === 'rejected' || status === 'edited') return 'destructive';
  return 'outline';
}

function formatDuration(minutes?: number | null) {
  if (!minutes) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function AdminTimesheetDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['timesheet', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimesheet(token, id);
    },
    enabled: !!token && !!id,
  });

  const entry = data;
  const estimatedPay = entry && entry.total_minutes && entry.employee?.hourly_rate
    ? (Number(entry.total_minutes) / 60) * Number(entry.employee.hourly_rate)
    : 0;

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

  if (error) {
    return (
      <PageShell title="Timesheet" icon={Clock} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/hr/timesheets"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load timesheet.</div>
      </PageShell>
    );
  }

  const statCards = entry
    ? [
        { label: 'Status', value: entry.status, icon: CheckCircle, accent: entry.status === 'approved' ? 'success' as const : entry.status === 'rejected' ? 'destructive' as const : 'warning' as const },
        { label: 'Duration', value: formatDuration(entry.total_minutes), icon: Timer },
        { label: 'Break', value: formatDuration(entry.break_minutes), icon: Timer },
        { label: 'Estimated pay', value: formatCurrency(estimatedPay), icon: DollarSign },
      ]
    : [];

  return (
    <PageShell
      title={entry ? `Entry #${entry.id}` : 'Timesheet'}
      icon={Clock}
      description={entry ? `${entry.employee?.name || `Employee ${entry.employee_id}`} · ${formatDate(entry.clock_in_time)}` : ''}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/admin/hr/timesheets"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>
          {entry?.status !== 'approved' && <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}><CheckCircle className="mr-1 h-4 w-4" /> Approve</Button>}
          {entry?.status !== 'rejected' && <Button variant="outline" size="sm" onClick={() => reject.mutate()} disabled={reject.isPending}><XCircle className="mr-1 h-4 w-4" /> Reject</Button>}
          <Button variant="destructive" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash className="mr-1 h-4 w-4" /> Delete</Button>
        </div>
      }
    >
      {isLoading || !entry ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <StatCards cards={statCards} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-2xl">Timesheet #{entry.id}</CardTitle>
                      <p className="text-sm text-muted-foreground">{entry.employee?.name || `Employee ${entry.employee_id}`} · {formatDate(entry.clock_in_time)}</p>
                    </div>
                    <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-l-4 border-l-primary">
                      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Clock In</CardTitle></CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        <p className="text-lg font-semibold">{formatDateTime(entry.clock_in_time)}</p>
                        {entry.clock_in_address && <p className="text-muted-foreground"><MapPin className="inline h-3 w-3 mr-1" /> {entry.clock_in_address}</p>}
                        {entry.clock_in_notes && <p className="text-muted-foreground">{entry.clock_in_notes}</p>}
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-secondary">
                      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Clock Out</CardTitle></CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        <p className="text-lg font-semibold">{entry.clock_out_time ? formatDateTime(entry.clock_out_time) : '—'}</p>
                        {entry.clock_out_address && <p className="text-muted-foreground"><MapPin className="inline h-3 w-3 mr-1" /> {entry.clock_out_address}</p>}
                        {entry.clock_out_notes && <p className="text-muted-foreground">{entry.clock_out_notes}</p>}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2 pt-2">
                    <p><span className="text-muted-foreground">Duration:</span> {formatDuration(entry.total_minutes)}</p>
                    <p><span className="text-muted-foreground">Break:</span> {formatDuration(entry.break_minutes)}</p>
                    <p><span className="text-muted-foreground">Overtime:</span> {formatDuration(entry.overtime_minutes)}</p>
                    <p><span className="text-muted-foreground">GPS:</span> {entry.gps_coordinates || '—'}</p>
                    <p><span className="text-muted-foreground">Approved by:</span> {entry.approved_by_name || (entry.approved_by ? `User ${entry.approved_by}` : '—')}</p>
                    <p><span className="text-muted-foreground">Approved at:</span> {entry.approved_at ? formatDateTime(entry.approved_at) : '—'}</p>
                    <p><span className="text-muted-foreground">Hourly rate:</span> {formatCurrency(entry.employee?.hourly_rate ?? undefined)}</p>
                    <p><span className="text-muted-foreground">Estimated pay:</span> {formatCurrency(estimatedPay)}</p>
                  </div>

                  {entry.notes && (
                    <div className="rounded bg-muted p-3">
                      <h4 className="font-medium mb-1">Notes</h4>
                      <p className="whitespace-pre-wrap text-muted-foreground">{entry.notes}</p>
                    </div>
                  )}

                  {entry.admin_notes && (
                    <div className="rounded bg-muted p-3">
                      <h4 className="font-medium mb-1">Admin notes</h4>
                      <p className="whitespace-pre-wrap text-muted-foreground">{entry.admin_notes}</p>
                    </div>
                  )}

                  {entry.work_items && entry.work_items.length > 0 && (
                    <div className="rounded bg-muted p-3">
                      <h4 className="font-medium mb-2">Work items</h4>
                      <ul className="space-y-1 text-sm">
                        {entry.work_items.map((wi: any) => (
                          <li key={wi.id} className="flex justify-between">
                            <span>{wi.project_tasks?.title || `Task ${wi.task_id || wi.id}`}</span>
                            <span className="text-muted-foreground">{wi.hours_spent != null ? `${wi.hours_spent}h` : ''}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Employee</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="font-medium">{entry.employee?.name || `Employee ${entry.employee_id}`}</p>
                  <p className="text-muted-foreground">{entry.employee?.email || '—'}</p>
                  <p className="text-muted-foreground">Rate: {formatCurrency(entry.employee?.hourly_rate ?? undefined)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Shift</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                  {entry.shift ? (
                    <>
                      <p className="font-medium">{entry.shift.position || 'Shift'} · {entry.shift.department || '—'}</p>
                      <p className="text-muted-foreground">{formatDate(entry.shift.shift_date)} {entry.shift.start_time ? `at ${entry.shift.start_time}` : ''}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No linked shift.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {entry.status !== 'approved' && <Button className="w-full" onClick={() => approve.mutate()} disabled={approve.isPending}><CheckCircle className="mr-1 h-4 w-4" /> Approve</Button>}
                  {entry.status !== 'rejected' && <Button variant="outline" className="w-full" onClick={() => reject.mutate()} disabled={reject.isPending}><XCircle className="mr-1 h-4 w-4" /> Reject</Button>}
                  <Button variant="destructive" className="w-full" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash className="mr-1 h-4 w-4" /> Delete</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
