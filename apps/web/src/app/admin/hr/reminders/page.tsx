'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { DataTable } from '@/components/design-system/DataTable';
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
import { Bell as BellIcon, Plus, Search } from 'lucide-react';

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
  const router = useRouter();
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
        <DataTable
          headers={[
            { key: 'title', label: 'Title' },
            { key: 'trigger', label: 'Trigger' },
            { key: 'date', label: 'Reminder date' },
            { key: 'assignee', label: 'Assignee' },
            { key: 'status', label: 'Status' },
          ]}
          data={reminders}
          keyExtractor={(r) => r.id}
          loading={isLoading}
          onRowClick={(r) => router.push(`/admin/hr/reminders/${r.id}`)}
          emptyText="No reminders found."
          emptyDescription="Try adjusting your search or filters."
          renderRow={(r: Reminder) => [
            <Link key="title" href={`/admin/hr/reminders/${r.id}`} className="font-medium hover:underline">{r.title}</Link>,
            <span key="trigger" className="capitalize">{r.trigger_type || 'regular'}</span>,
            <span key="date">{formatDate(r.reminder_date)}</span>,
            <div key="assignee" className="flex items-center gap-3">
              {r.assignee ? (
                <>
                  <PersonAvatar name={`${r.assignee.first_name || ''} ${r.assignee.last_name || ''}`.trim() || r.assignee.email} size="sm" />
                  <span>{`${r.assignee.first_name || ''} ${r.assignee.last_name || ''}`.trim() || r.assignee.email}</span>
                </>
              ) : (
                <span>-</span>
              )}
            </div>,
            <StatusBadge key="status" status={r.status || 'pending'} />,
          ]}
        />
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
