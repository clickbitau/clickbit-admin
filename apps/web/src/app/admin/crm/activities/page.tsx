'use client';
import { PageShell } from '@/components/design-system/PageShell';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { FormDialog } from '@/components/design-system/FormDialog';
import { ConfirmDialog } from '@/components/design-system/ConfirmDialog';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchActivities, completeActivity, deleteActivity, createActivity } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import type { Activity } from '@/types/crm';
import { Plus, Search, CheckCircle2, Activity as ActivityIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function ActivitiesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [activityType, setActivityType] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [completing, setCompleting] = useState<Activity | null>(null);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit: 25 };
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.status = status;
    if (activityType) params.activity_type = activityType;
    return params;
  }, [page, debouncedSearch, status, activityType]);

  const { data, isLoading } = useQuery({
    queryKey: ['activities', queryParams],
    queryFn: () => fetchActivities(token!, queryParams),
    enabled: !!token,
  });

  useRealtimeRefresh(['crm_activities'], ['activities'], { enabled: !!token });

  const activities = data?.activities ?? [];
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 25 };

  const completeMutation = useMutation({
    mutationFn: (id: number) => completeActivity(token!, id),
    onSuccess: () => { toast.success('Activity completed'); setCompleting(null); queryClient.invalidateQueries({ queryKey: ['activities'] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteActivity(token!, id),
    onSuccess: () => { toast.success('Activity deleted'); queryClient.invalidateQueries({ queryKey: ['activities'] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const createMutation = useMutation({
    mutationFn: (values: Partial<Activity>) => createActivity(token!, values),
    onSuccess: () => { toast.success('Activity created'); setFormOpen(false); queryClient.invalidateQueries({ queryKey: ['activities'] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  return (
    <PageShell
      title="Activities"
      icon={ActivityIcon}
      description="Tasks, calls, and scheduled follow-ups"
      actions={<Button onClick={() => setFormOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Activity</Button>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search activities..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activityType} onValueChange={(v) => { setActivityType(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="follow_up">Follow Up</SelectItem>
            <SelectItem value="demo">Demo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        headers={[
          { key: 'subject', label: 'Activity' },
          { key: 'type', label: 'Type' },
          { key: 'status', label: 'Status' },
          { key: 'priority', label: 'Priority' },
          { key: 'due', label: 'Due' },
          { key: 'assignee', label: 'Assignee' },
          { key: 'actions', label: '' },
        ]}
        data={activities}
        keyExtractor={(a) => a.id}
        loading={isLoading}
        renderRow={(a) => [
          <div key="subject"><p className="font-medium">{a.subject}</p><p className="text-xs text-muted-foreground">{a.description}</p></div>,
          <Badge key="type" variant="outline">{a.activity_type}</Badge>,
          <StatusBadge key="status" status={a.status} />,
          <PriorityBadge key="priority" priority={a.priority} />,
          <span key="due">{formatDate(a.due_date)}</span>,
          <span key="assignee" className="text-sm">{a.assignee ? `${a.assignee.first_name} ${a.assignee.last_name}` : '-'}</span>,
          <div key="actions" className="flex items-center gap-2">
            {a.status !== 'completed' && <Button variant="ghost" size="sm" onClick={() => setCompleting(a)}><CheckCircle2 className="h-4 w-4" /></Button>}
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(a.id)}>Delete</Button>
          </div>,
        ]}
      />

      <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} onPageChange={setPage} />

      <ActivityFormDialog open={formOpen} onOpenChange={setFormOpen} onSubmit={(values) => createMutation.mutate(values)} loading={createMutation.isPending} />

      <ConfirmDialog
        open={!!completing}
        onOpenChange={(open) => !open && setCompleting(null)}
        title="Complete Activity"
        description={`Mark "${completing?.subject}" as completed?`}
        onConfirm={() => completing && completeMutation.mutate(completing.id)}
        loading={completeMutation.isPending}
        confirmLabel="Complete"
      />
    </PageShell>
  );
}

function ActivityFormDialog({ open, onOpenChange, onSubmit, loading }: { open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (v: Partial<Activity>) => void; loading?: boolean }) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSubmit({
      subject: String(data.get('subject') ?? ''),
      description: String(data.get('description') ?? ''),
      activity_type: String(data.get('activity_type') ?? 'task'),
      status: String(data.get('status') ?? 'planned'),
      priority: String(data.get('priority') ?? 'medium'),
      due_date: String(data.get('due_date') ?? '') || undefined,
    });
  }

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="New Activity" onSubmit={handleSubmit} loading={loading}>
      <div className="grid gap-2"><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" required /></div>
      <div className="grid gap-2"><Label htmlFor="description">Description</Label><textarea id="description" name="description" className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="activity_type">Type</Label><Select name="activity_type" defaultValue="task"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="call">Call</SelectItem><SelectItem value="meeting">Meeting</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="task">Task</SelectItem><SelectItem value="follow_up">Follow Up</SelectItem><SelectItem value="demo">Demo</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><Label htmlFor="priority">Priority</Label><Select name="priority" defaultValue="medium"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="status">Status</Label><Select name="status" defaultValue="planned"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planned">Planned</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="overdue">Overdue</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><Label htmlFor="due_date">Due Date</Label><Input id="due_date" name="due_date" type="datetime-local" /></div>
      </div>
    </FormDialog>
  );
}