'use client';
import { PageShell } from '@/components/design-system/PageShell';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
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
import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { FormDialog } from '@/components/design-system/FormDialog';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchTasks, fetchAssignees, updateTaskStatus } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ProjectTask, User } from '@/types/crm';
import Link from 'next/link';
import { Plus, Search, FolderKanban as FolderKanbanIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectTasksPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit: 25 };
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.status = status;
    if (assigneeId) params.assigned_to = assigneeId;
    return params;
  }, [page, debouncedSearch, status, assigneeId]);

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', queryParams],
    queryFn: () => fetchTasks(token!, queryParams),
    enabled: !!token,
  });

  const { data: assignees } = useQuery({
    queryKey: ['assignees'],
    queryFn: () => fetchAssignees(token!),
    enabled: !!token,
  });

  useRealtimeRefresh(['project_tasks', 'crm_projects'], ['tasks'], { enabled: !!token });

  const tasks = data?.data ?? [];
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 25 };
  const stats = data?.stats ?? { total: 0, todo: 0, in_progress: 0, review: 0, completed: 0, blocked: 0 };

  const statCards = [
    { label: 'Total', value: stats.total },
    { label: 'To Do', value: stats.todo },
    { label: 'In Progress', value: stats.in_progress },
    { label: 'Completed', value: stats.completed },
  ];

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateTaskStatus(token!, id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  return (
    <PageShell
      title="Project Tasks"
      icon={FolderKanbanIcon}
      description="Cross-project task management"
      actions={<Button onClick={() => setFormOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Task</Button>}
    >
      <StatCards cards={statCards} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assigneeId} onValueChange={(v) => { setAssigneeId(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            {(assignees ?? []).map((u: User) => <SelectItem key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        headers={[
          { key: 'task', label: 'Task' },
          { key: 'project', label: 'Project' },
          { key: 'status', label: 'Status' },
          { key: 'priority', label: 'Priority' },
          { key: 'assignee', label: 'Assignee' },
          { key: 'due', label: 'Due' },
          { key: 'actions', label: '' },
        ]}
        data={tasks}
        keyExtractor={(t) => t.id}
        loading={isLoading}
        renderRow={(t) => [
          <div key="task"><Link href={`/admin/crm/project-tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link><p className="text-xs text-muted-foreground">{t.description}</p></div>,
          <span key="project" className="text-sm text-muted-foreground">{t.crmProject?.name || t.project?.title || '-'}</span>,
          <StatusBadge key="status" status={t.status} />,
          <PriorityBadge key="priority" priority={t.priority} />,
          <span key="assignee" className="text-sm">{t.assignee ? `${t.assignee.first_name} ${t.assignee.last_name}` : '-'}</span>,
          <span key="due">{formatDate(t.due_date)}</span>,
          <div key="actions" className="flex items-center gap-1">
            {['todo', 'in_progress', 'review', 'completed', 'blocked'].map((s) => (
              <Button key={s} variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: t.id, status: s })} disabled={t.status === s}>
                {s[0].toUpperCase()}
              </Button>
            ))}
          </div>,
        ]}
      />

      <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} onPageChange={setPage} />

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} assignees={assignees ?? []} onSubmit={(values) => { toast.info('Create task endpoint not wired to this view'); setFormOpen(false); }} />
    </PageShell>
  );
}

function TaskFormDialog({ open, onOpenChange, assignees, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; assignees: User[]; onSubmit: (v: Partial<ProjectTask>) => void }) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSubmit({
      title: String(data.get('title') ?? ''),
      description: String(data.get('description') ?? ''),
      status: String(data.get('status') ?? 'todo'),
      priority: String(data.get('priority') ?? 'medium'),
      assigned_to: data.get('assigned_to') ? Number(data.get('assigned_to')) : undefined,
      due_date: String(data.get('due_date') ?? '') || undefined,
      estimated_hours: data.get('estimated_hours') ? Number(data.get('estimated_hours')) : undefined,
    });
  }

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="New Task" onSubmit={handleSubmit}>
      <div className="grid gap-2"><Label htmlFor="title">Title</Label><Input id="title" name="title" required /></div>
      <div className="grid gap-2"><Label htmlFor="description">Description</Label><textarea id="description" name="description" className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="status">Status</Label><Select name="status" defaultValue="todo"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todo">To Do</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="review">Review</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><Label htmlFor="priority">Priority</Label><Select name="priority" defaultValue="medium"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="assigned_to">Assignee</Label><Select name="assigned_to" defaultValue=""><SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger><SelectContent><SelectItem value="">Unassigned</SelectItem>{assignees.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2"><Label htmlFor="due_date">Due Date</Label><Input id="due_date" name="due_date" type="date" /></div>
      </div>
      <div className="grid gap-2"><Label htmlFor="estimated_hours">Estimated Hours</Label><Input id="estimated_hours" name="estimated_hours" type="number" /></div>
    </FormDialog>
  );
}