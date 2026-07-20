'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { fetchReminders, createReminder, completeReminder } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Bell, Plus, CheckCircle2, Clock, AlertCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import type { Reminder } from '@clickbit/shared';

export default function EmployeeRemindersPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', reminder_date: '' });
  const limit = 10;

  const userId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['employee-reminders', token, page, userId],
    queryFn: async () => {
      if (!token || !userId) throw new Error('No token');
      return fetchReminders(token, { page, limit, created_by: userId, assigned_to: userId });
    },
    enabled: !!token && !!userId,
  });

  const reminders = useMemo(() => data?.data ?? [], [data]);
  const pagination = data?.pagination;

  const summary = useMemo(() => {
    return {
      total: reminders.length,
      pending: reminders.filter((r) => r.status === 'pending' || r.status === 'initiation').length,
      complete: reminders.filter((r) => r.status === 'complete').length,
      overdue: reminders.filter((r) => r.status === 'pending' && new Date(r.reminder_date) < new Date()).length,
    };
  }, [reminders]);

  const create = useMutation({
    mutationFn: () => {
      if (!token || !userId) throw new Error('No token');
      return createReminder(token, {
        title: form.title,
        description: form.description,
        reminder_date: form.reminder_date,
        created_by: userId,
        assigned_to: userId,
      });
    },
    onSuccess: () => {
      toast.success('Reminder created');
      setShowAdd(false);
      setForm({ title: '', description: '', reminder_date: '' });
      queryClient.invalidateQueries({ queryKey: ['employee-reminders'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create reminder'),
  });

  const complete = useMutation({
    mutationFn: (id: number) => {
      if (!token) throw new Error('No token');
      return completeReminder(token, id);
    },
    onSuccess: () => {
      toast.success('Reminder completed');
      queryClient.invalidateQueries({ queryKey: ['employee-reminders'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to complete reminder'),
  });

  return (
    <PageShell title="My Reminders" icon={Bell} description="Track and manage your reminders.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="nm-raised"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Total</p><p className="text-2xl font-bold">{summary.total}</p></CardContent></Card>
        <Card className="nm-raised"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Pending</p><p className="text-2xl font-bold">{summary.pending}</p></CardContent></Card>
        <Card className="nm-raised"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Complete</p><p className="text-2xl font-bold">{summary.complete}</p></CardContent></Card>
        <Card className="nm-raised"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Overdue</p><p className="text-2xl font-bold">{summary.overdue}</p></CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(true)}><Plus className="mr-1 h-4 w-4" /> New Reminder</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : reminders.length === 0 ? (
        <Card className="nm-raised p-8 text-center text-sm text-muted-foreground">No reminders yet.</Card>
      ) : (
        <div className="space-y-3">
          {reminders.map((r: Reminder) => {
            const isOverdue = r.status === 'pending' && new Date(r.reminder_date) < new Date();
            return (
              <Card key={r.id} className="nm-raised">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4">
                  <div className="flex items-center gap-2">
                    {isOverdue ? <AlertCircle className="h-4 w-4 text-red-500" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                    <CardTitle className="text-sm font-medium">{r.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status || undefined} />
                    {r.status !== 'complete' && (
                      <Button size="sm" variant="outline" onClick={() => complete.mutate(r.id)} disabled={complete.isPending}>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Done
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(r.reminder_date)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pagination && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={setPage}
        />
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4">
          <Card className="nm-raised w-full max-w-md">
            <CardHeader><CardTitle className="text-base">New Reminder</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div><Label>Reminder Date</Label><Input type="datetime-local" value={form.reminder_date} onChange={(e) => setForm({ ...form, reminder_date: e.target.value })} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending || !form.title || !form.reminder_date}>Create</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
