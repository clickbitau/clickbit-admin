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
import { confirmShift, deleteShift, fetchShift } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { ArrowLeft, CheckCircle, Clock, Trash, User } from 'lucide-react';

function statusVariant(status?: string | null) {
  if (status === 'published' || status === 'confirmed') return 'default';
  if (status === 'scheduled') return 'secondary';
  if (status === 'cancelled') return 'destructive';
  if (status === 'completed') return 'outline';
  return 'outline';
}

function displayTime(value: string | Date | undefined | null) {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminShiftDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['shift', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchShift(token, id);
    },
    enabled: !!token && !!id,
  });

  const shift = data;
  const displayName = shift ? `${shift.shift_type || 'Shift'} ${formatDate(shift.shift_date)}` : 'Shift';

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['shift', token, id] });
    queryClient.invalidateQueries({ queryKey: ['shifts', token] });
  };

  const confirm = useMutation({
    mutationFn: () => confirmShift(token!, id),
    onSuccess: () => { toast.success('Shift confirmed'); invalidate(); },
    onError: () => toast.error('Confirm failed'),
  });

  const remove = useMutation({
    mutationFn: () => deleteShift(token!, id),
    onSuccess: () => { toast.success('Shift deleted'); router.push('/admin/hr/shifts'); },
    onError: () => toast.error('Delete failed'),
  });

  if (error) {
    return (
      <PageShell title="Shift" icon={Clock} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/hr/shifts"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load shift.</div>
      </PageShell>
    );
  }

  const statCards = shift
    ? [
        { label: 'Status', value: shift.status || 'scheduled', icon: Clock, accent: shift.status === 'published' || shift.status === 'confirmed' ? 'success' as const : 'warning' as const },
        { label: 'Shift date', value: formatDate(shift.shift_date), icon: Clock },
        { label: 'Start', value: displayTime(shift.start_datetime || shift.start_time), icon: Clock },
        { label: 'End', value: displayTime(shift.end_datetime || shift.end_time), icon: Clock },
      ]
    : [];

  return (
    <PageShell
      title={displayName}
      icon={Clock}
      description={shift ? `${shift.position || 'No position'} · ${shift.department || 'No department'}` : ''}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/admin/hr/shifts"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>
          {shift?.status !== 'confirmed' && <Button variant="outline" size="sm" onClick={() => confirm.mutate()} disabled={confirm.isPending}><CheckCircle className="mr-1 h-4 w-4" /> Confirm</Button>}
          <Button variant="destructive" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash className="mr-1 h-4 w-4" /> Delete</Button>
        </div>
      }
    >
      {isLoading || !shift ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <StatCards cards={statCards} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{displayName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{shift.position || 'No position'} · {shift.department || 'No department'}</p>
                    </div>
                    <Badge variant={statusVariant(shift.status)}>{shift.status || 'scheduled'}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <p><span className="text-muted-foreground">Shift type:</span> {shift.shift_type || '—'}</p>
                    <p><span className="text-muted-foreground">Shift date:</span> {formatDate(shift.shift_date)}</p>
                    <p><span className="text-muted-foreground">Start time:</span> {displayTime(shift.start_datetime || shift.start_time)}</p>
                    <p><span className="text-muted-foreground">End time:</span> {displayTime(shift.end_datetime || shift.end_time)}</p>
                    <p><span className="text-muted-foreground">Break minutes:</span> {shift.scheduled_break_minutes ?? '—'}</p>
                    <p><span className="text-muted-foreground">Location:</span> {shift.location || '—'}</p>
                    <p><span className="text-muted-foreground">Open shift:</span> {shift.is_open_shift ? 'Yes' : 'No'}</p>
                    <p><span className="text-muted-foreground">Employee confirmed:</span> {shift.employee_confirmed ? 'Yes' : 'No'}</p>
                  </div>

                  {shift.notes && (
                    <div className="rounded bg-muted p-3">
                      <h4 className="font-medium mb-1">Notes</h4>
                      <p className="whitespace-pre-wrap text-muted-foreground">{shift.notes}</p>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Created {formatDateTime(shift.created_at)} · Updated {formatDateTime(shift.updated_at)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Employee</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="font-medium">{shift.employee?.name || `Employee ${shift.employee_id}`}</p>
                  <p className="text-muted-foreground">{shift.employee?.email || '—'}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {shift.status !== 'confirmed' && <Button className="w-full" onClick={() => confirm.mutate()} disabled={confirm.isPending}><CheckCircle className="mr-1 h-4 w-4" /> Confirm</Button>}
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
