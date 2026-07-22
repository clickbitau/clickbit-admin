'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
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
import { cn } from '@/lib/utils';
import { Bell, Plus, CheckCircle2, Clock, AlertCircle, Calendar, Search, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Reminder } from '@clickbit/shared';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'complete', label: 'Complete' },
  { key: 'overdue', label: 'Overdue' },
];

export default function EmployeeRemindersPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = reminders;
    if (status !== 'all') {
      rows = rows.filter((r) => {
        if (status === 'overdue') return r.status === 'pending' && new Date(r.reminder_date) < new Date();
        return r.status === status;
      });
    }
    if (q) {
      rows = rows.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description?.toLowerCase() || '').includes(q)
      );
    }
    return rows;
  }, [reminders, status, search]);

  const stats = useMemo(() => {
    return {
      total: reminders.length,
      pending: reminders.filter((r) => r.status === 'pending' || r.status === 'initiation').length,
      complete: reminders.filter((r) => r.status === 'complete').length,
      overdue: reminders.filter((r) => r.status === 'pending' && new Date(r.reminder_date) < new Date()).length,
    };
  }, [reminders]);

  return (
    <PageShell
      title="My Reminders"
      icon={Bell}
      description="Track and manage your reminders."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={status === s.key ? 'default' : 'outline'}
                onClick={() => { setStatus(s.key); setPage(1); }}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Reminder
          </Button>
        </div>
      }
    >
      <StatCards
        cards={[
          { label: 'Total', value: stats.total, icon: Bell, accent: 'primary' },
          { label: 'Pending', value: stats.pending, icon: Clock, accent: 'warning' },
          { label: 'Complete', value: stats.complete, icon: CheckCircle2, accent: 'success' },
          { label: 'Overdue', value: stats.overdue, icon: AlertCircle, accent: 'destructive' },
        ]}
      />

      <Card className="nm-raised p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reminders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="nm-raised p-8 text-center text-sm text-muted-foreground">
          {search || status !== 'all' ? 'No reminders match your filters.' : 'No reminders yet.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: Reminder) => {
            const isOverdue = r.status === 'pending' && new Date(r.reminder_date) < new Date();
            return (
              <Card
                key={r.id}
                className={cn(
                  'nm-raised hover:shadow-md transition-all border-l-4',
                  r.status === 'complete' ? 'border-l-emerald-500' :
                  isOverdue ? 'border-l-red-500' :
                  r.status === 'pending' ? 'border-l-amber-500' : 'border-l-gray-400'
                )}
              >
                <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 p-4">
                  <div className="flex items-start gap-2">
                    {isOverdue ? <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" /> : <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />}
                    <div>
                      <CardTitle className="text-sm font-medium">{r.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(r.reminder_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status || undefined} />
                    {r.status !== 'complete' && (
                      <Button size="sm" variant="outline" onClick={() => complete.mutate(r.id)} disabled={complete.isPending}>
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {r.description && (
                  <CardContent className="px-4 pb-4 pt-0">
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                  </CardContent>
                )}
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
