'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/design-system/Pagination';
import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { ReminderForm } from '@/components/hr/ReminderForm';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchReminders, fetchHrStats, completeReminder, deleteReminder } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Reminder } from '@/types/hr';
import {
  Bell as BellIcon,
  Plus,
  Search,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  User,
  FileText,
  Edit,
  Trash2,
  Zap,
  TrendingUp,
  Activity,
} from 'lucide-react';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'complete', label: 'Complete' },
  { value: 'initiation', label: 'Initiation' },
];

const triggerOptions = [
  { value: '', label: 'All triggers' },
  { value: 'payment', label: 'Payment' },
  { value: 'project', label: 'Project' },
  { value: 'regular', label: 'Regular' },
];

const sortOptions = [
  { value: 'reminder_date', label: 'Reminder date' },
  { value: 'created_at', label: 'Created' },
  { value: 'title', label: 'Title' },
];

function isOverdue(r: Reminder) {
  return r.status !== 'complete' && r.reminder_date && new Date(r.reminder_date) < new Date();
}

function getTriggerConfig(trigger?: string | null) {
  switch (trigger) {
    case 'payment':
      return { label: 'Payment', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300', icon: TrendingUp };
    case 'project':
      return { label: 'Project', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300', icon: Activity };
    default:
      return { label: 'Regular', color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', icon: Zap };
  }
}

function getCardAccent(r: Reminder) {
  if (r.status === 'complete') return 'border-l-emerald-400';
  if (isOverdue(r)) return 'border-l-red-400';
  if (r.status === 'pending') return 'border-l-amber-400';
  return 'border-l-primary';
}

function personName(person?: { first_name?: string; last_name?: string; email?: string } | null) {
  if (!person) return '';
  const full = `${person.first_name || ''} ${person.last_name || ''}`.trim();
  return full || person.email || '';
}

export default function AdminHrRemindersPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [trigger, setTrigger] = useState('');
  const [sortBy, setSortBy] = useState('reminder_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit: 12, sortBy, sortOrder };
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.status = status;
    if (trigger) params.trigger_type = trigger;
    return params;
  }, [page, debouncedSearch, status, trigger, sortBy, sortOrder]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['reminders', queryParams],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchReminders(token, queryParams); },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['hr-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchHrStats(token); },
    enabled: !!token,
  });

  useRealtimeRefresh(['reminders'], ['reminders'], { enabled: !!token });

  const reminders = useMemo(() => data?.data ?? [], [data?.data]);
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };
  const stats = statsData?.data;

  const statCards = useMemo(() => {
    const total = stats?.reminders?.total ?? pagination.total ?? reminders.length;
    const pending = stats?.reminders?.pending ?? reminders.filter((r) => r.status === 'pending').length;
    const complete = stats?.reminders?.complete ?? reminders.filter((r) => r.status === 'complete').length;
    const overdue = reminders.filter((r) => isOverdue(r)).length;
    return [
      { label: 'Total', value: total, icon: BellIcon },
      { label: 'Pending', value: pending, icon: Clock, accent: 'warning' as const, onClick: () => { setStatus('pending'); setPage(1); } },
      { label: 'Complete', value: complete, icon: CheckCircle, accent: 'success' as const, onClick: () => { setStatus('complete'); setPage(1); } },
      { label: 'Overdue', value: overdue, icon: AlertCircle, accent: 'destructive' as const },
    ];
  }, [stats, pagination.total, reminders]);

  const completeMutation = useMutation({
    mutationFn: (id: number) => completeReminder(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteReminder(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  });

  const displayedReminders = reminders;

  return (
    <PageShell
      title="Reminders"
      icon={BellIcon}
      description="HR reminders and scheduled follow-ups."
      actions={canManage ? <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Reminder</Button> : undefined}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="nm-raised p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search reminders..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={trigger} onValueChange={(v) => { setTrigger(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Trigger" /></SelectTrigger>
            <SelectContent>{triggerOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>{sortOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}>
            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="text-destructive text-sm">Failed to load reminders.</div>
      ) : (
        <div className="space-y-3">
          {isLoading && displayedReminders.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">Loading reminders…</div>
          ) : displayedReminders.length === 0 ? (
            <div className="nm-raised p-12 text-center text-muted-foreground">
              <BellIcon className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No reminders found</p>
              <p className="text-sm mt-1">Try adjusting filters or create a reminder.</p>
            </div>
          ) : (
            displayedReminders.map((r: Reminder) => {
              const cfg = getTriggerConfig(r.trigger_type);
              const overdue = isOverdue(r);
              const Icon = cfg.icon;
              const assigneeOrCreator = r.assignee || r.creator;
              return (
                <div key={r.id} className={`nm-raised p-5 border-l-4 ${getCardAccent(r)} ${r.status === 'complete' ? 'opacity-70' : ''}`}>
                  <div className="flex items-start justify-between gap-4 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <StatusBadge status={r.status || 'pending'} />
                        <Badge variant="secondary" className={`flex items-center gap-1 ${cfg.color}`}>
                          <Icon className="w-3 h-3" /> {cfg.label}
                        </Badge>
                        {overdue && <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Overdue</Badge>}
                        {r.email_sent && <Badge variant="outline" className="flex items-center gap-1 text-emerald-600"><CheckCircle className="w-3 h-3" /> Email Sent</Badge>}
                      </div>

                      <h3 className={`text-base font-semibold mb-1 ${r.status === 'complete' ? 'line-through text-muted-foreground' : ''}`}>
                        <Link href={`/admin/hr/reminders/${r.id}`} className="hover:underline">{r.title}</Link>
                      </h3>

                      {r.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{r.description}</p>}

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(r.reminder_date)}</span>
                        {assigneeOrCreator && (
                          <span className="inline-flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            {personName(assigneeOrCreator)}
                          </span>
                        )}
                        {r.email_sent_at && <span className="inline-flex items-center gap-1.5 text-emerald-500"><CheckCircle className="w-3.5 h-3.5" /> Sent {formatDate(r.email_sent_at)}</span>}
                        {r.notes && <span className="inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /><span className="truncate max-w-[200px]">{r.notes}</span></span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {r.status !== 'complete' && (
                        <Button size="sm" variant="ghost" onClick={() => completeMutation.mutate(Number(r.id))} title="Mark complete">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        </Button>
                      )}
                      {canManage && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/hr/reminders/${r.id}`)} title="Edit">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(Number(r.id))} title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <Pagination currentPage={pagination.page} totalPages={pagination.pages} totalItems={pagination.total} onPageChange={setPage} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Reminder</DialogTitle>
            <DialogDescription>Schedule a reminder for a person or event.</DialogDescription>
          </DialogHeader>
          {token && (
            <ReminderForm
              token={token}
              onSuccess={() => setCreateOpen(false)}
              onCancel={() => setCreateOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
