'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { ReminderForm } from '@/components/hr/ReminderForm';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchReminders, fetchHrStats } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Reminder } from '@/types/hr';
import { Bell as BellIcon, Calendar, Plus, Search } from 'lucide-react';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'complete', label: 'Complete' },
  { value: 'initiation', label: 'Initiation' },
];

const triggerOptions = [
  { value: '', label: 'All triggers' },
  { value: 'regular', label: 'Regular' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'one_time', label: 'One-time' },
];

const sortOptions = [
  { value: 'reminder_date', label: 'Reminder date' },
  { value: 'created_at', label: 'Created' },
  { value: 'title', label: 'Title' },
];

export default function AdminHrRemindersPage() {
  const { token } = useAuth();
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

  const reminders = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pages: 1, limit: 12 };
  const stats = statsData?.data;

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total', value: stats.reminders.total, icon: BellIcon },
      { label: 'Pending', value: stats.reminders.pending, icon: BellIcon, accent: 'warning' as const, onClick: () => { setStatus('pending'); setPage(1); } },
      { label: 'Complete', value: stats.reminders.complete, icon: BellIcon, accent: 'success' as const, onClick: () => { setStatus('complete'); setPage(1); } },
    ];
  }, [stats]);

  return (
    <PageShell
      title="Reminders"
      icon={BellIcon}
      description="HR reminders and scheduled follow-ups."
      actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Reminder</Button>}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      {error ? (
        <div className="text-destructive text-sm">Failed to load reminders.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reminders.map((r: Reminder) => (
            <Link key={r.id} href={`/admin/hr/reminders/${r.id}`} className="block group">
              <Card className="nm-raised h-full hover:brightness-[0.97] dark:hover:brightness-110 transition-all">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium line-clamp-2 group-hover:underline">{r.title}</h3>
                    <StatusBadge status={r.status || 'pending'} />
                  </div>
                  {r.description && <p className="text-sm text-muted-foreground line-clamp-3">{r.description}</p>}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(r.reminder_date)}</span>
                    <span className="capitalize">{(r.trigger_type || 'regular').replace(/_/g, ' ')}</span>
                  </div>
                  {r.assignee && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <PersonAvatar name={`${r.assignee.first_name || ''} ${r.assignee.last_name || ''}`.trim() || r.assignee.email} size="sm" />
                      <span>{`${r.assignee.first_name || ''} ${r.assignee.last_name || ''}`.trim() || r.assignee.email}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
          {reminders.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-16 text-muted-foreground">No reminders found. Try adjusting filters.</div>
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
