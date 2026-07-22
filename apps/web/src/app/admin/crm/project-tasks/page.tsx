'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
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
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { PageShell } from '@/components/design-system/PageShell';
import { ProjectTaskForm } from '@/components/crm/ProjectTaskForm';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import {
  fetchTasks,
  fetchAssignees,
  fetchProjects,
  fetchProjectSubprojects,
  updateTask,
  updateTaskStatus,
  deleteTask,
  duplicateTask,
} from '@/lib/api';
import { formatDate, daysUntil } from '@/lib/format';
import type { ProjectTask, User, CrmProject, CrmSubproject } from '@/types/crm';
import Link from 'next/link';
import {
  Plus,
  Search,
  List,
  LayoutGrid,
  FolderKanban,
  Clock,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Copy,
  Trash2,
  Calendar,
  Tags,
  RefreshCw,
  Filter,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function UserAvatar({ user, className }: { user?: { first_name?: string | null; last_name?: string | null; email?: string | null; avatar?: string | null } | null; className?: string }) {
  const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '';
  const initials = name ? `${name.split(' ')[0][0]}${name.split(' ').slice(-1)[0][0]}`.toUpperCase() : '?';
  return (
    <Avatar className={cn('h-7 w-7', className)}>
      {user?.avatar ? <AvatarImage src={user.avatar} alt={name} /> : null}
      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
    </Avatar>
  );
}

const STATUSES = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'completed', label: 'Completed' },
  { key: 'blocked', label: 'Blocked' },
];

const STATUS_TABS = [
  { key: '', label: 'All' },
  ...STATUSES,
];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function getStatusColor(status: string) {
  switch (status) {
    case 'todo':
      return 'border-l-gray-400';
    case 'in_progress':
      return 'border-l-blue-500';
    case 'review':
      return 'border-l-purple-500';
    case 'completed':
      return 'border-l-emerald-500';
    case 'blocked':
      return 'border-l-red-500';
    default:
      return 'border-l-muted-foreground';
  }
}

function microtaskProgress(microtasks: { is_completed?: boolean }[]) {
  if (!microtasks.length) return null;
  const done = microtasks.filter((m) => m.is_completed).length;
  return Math.round((done / microtasks.length) * 100);
}

export default function ProjectTasksPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const isEmployee = user?.role === 'employee';

  const isGlobalTasks = pathname === '/admin/tasks';
  const pageTitle = isGlobalTasks ? 'Tasks' : 'Project Tasks';
  const pageDescription = isGlobalTasks ? 'Manage and track every task across the business' : 'Manage and track tasks across all projects';
  const basePath = '/admin/crm/project-tasks';

  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
  const [projectId, setProjectId] = useState('');
  const [subprojectId, setSubprojectId] = useState('');
  const [viewScope, setViewScope] = useState<'all' | 'my' | 'unassigned'>(isEmployee ? 'my' : 'all');
  const [hideCompleted, setHideCompleted] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean> = { page, limit: view === 'kanban' ? 100 : 25 };
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.status = status;
    if (priority) params.priority = priority;
    if (viewScope !== 'my' && selectedAssignees.length > 0) params.assigned_to = selectedAssignees.join(',');
    if (projectId) params.crm_project_id = projectId;
    if (subprojectId) params.subproject_id = subprojectId;
    if (viewScope !== 'all') params.view_scope = viewScope;
    if (hideCompleted) params.hide_completed = true;
    return params;
  }, [page, debouncedSearch, status, priority, selectedAssignees, projectId, subprojectId, viewScope, hideCompleted, view]);

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

  const { data: projects } = useQuery({
    queryKey: ['crm-projects', { limit: 100 }],
    queryFn: () => fetchProjects(token!, { limit: 100 }),
    enabled: !!token,
  });

  const { data: subprojects } = useQuery({
    queryKey: ['subprojects', projectId],
    queryFn: () => fetchProjectSubprojects(token!, Number(projectId)),
    enabled: !!token && !!projectId,
  });

  useRealtimeRefresh(['project_tasks'], ['tasks'], { enabled: !!token });

  useEffect(() => {
    setSubprojectId('');
    setPage(1);
  }, [projectId]);

  useEffect(() => {
    setPage(1);
  }, [view, status, priority, viewScope, selectedAssignees, hideCompleted, debouncedSearch]);

  const tasks = useMemo(() => data?.data ?? [], [data?.data]);
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 25 };

  const assigneeIdsFromTasks = useMemo(() => {
    const ids = new Set<number>();
    tasks.forEach((t) => {
      if (t.assigned_to) ids.add(Number(t.assigned_to));
      if (t.assignee?.id) ids.add(Number(t.assignee.id));
    });
    return ids;
  }, [tasks]);

  const visibleAssignees = useMemo(() => {
    const selectedSet = new Set(selectedAssignees);
    return (assignees ?? []).filter((u) => assigneeIdsFromTasks.has(Number(u.id)) || selectedSet.has(Number(u.id)));
  }, [assignees, assigneeIdsFromTasks, selectedAssignees]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProjectTask> }) => updateTask(token!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update task'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, actual_hours }: { id: number; status: string; actual_hours?: number }) =>
      updateTaskStatus(token!, id, { status, actual_hours }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete task'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => duplicateTask(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task duplicated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to duplicate'),
  });

  function handleRowClick(task: ProjectTask) {
    router.push(`${basePath}/${task.id}`);
  }

  function toggleAssignee(id: number) {
    setSelectedAssignees((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  }

  function clearFilters() {
    setSearch('');
    setStatus('');
    setPriority('');
    setProjectId('');
    setSubprojectId('');
    setSelectedAssignees([]);
    setViewScope(isEmployee ? 'my' : 'all');
    setHideCompleted(true);
  }

  function isOverdue(task: ProjectTask) {
    if (task.status === 'completed' || !task.due_date) return false;
    const due = new Date(task.due_date);
    const now = new Date();
    due.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return due < now;
  }

  function isSlow(task: ProjectTask) {
    const actual = typeof task.actual_hours === 'string' ? Number(task.actual_hours) : task.actual_hours;
    const estimated = typeof task.estimated_hours === 'string' ? Number(task.estimated_hours) : task.estimated_hours;
    return actual != null && estimated != null && estimated > 0 && actual > estimated;
  }

  function renderTaskMeta(task: ProjectTask) {
    const progress = microtaskProgress(task.microtasks ?? []);
    const tags = Array.isArray(task.tags) ? task.tags.filter(Boolean) : [];
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
        {task.crmProject && (
          <Link
            href={`/admin/crm/projects/${task.crmProject.id}`}
            className="truncate max-w-[140px] hover:text-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {task.crmProject.name || task.crmProject.project_number}
          </Link>
        )}
        {task.subproject && (
          <Link
            href={`/admin/crm/subprojects/${task.subproject.id}`}
            className="truncate max-w-[120px] hover:text-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            · {task.subproject.name}
          </Link>
        )}
        {task.due_date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {daysUntil(task.due_date)}
          </span>
        )}
        {isOverdue(task) && (
          <span className="px-1.5 py-0.5 rounded-md bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 text-[10px] font-semibold">
            Overdue
          </span>
        )}
        {!isOverdue(task) && isSlow(task) && (
          <span className="px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 text-[10px] font-semibold">
            Slow
          </span>
        )}
        {task.estimated_hours !== undefined && task.estimated_hours !== null && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {task.actual_hours ?? 0}/{task.estimated_hours}h
          </span>
        )}
        {progress !== null && (
          <span className="flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />
            {progress}%
          </span>
        )}
        {(task as any).is_recurring && (
          <span className="flex items-center gap-1 text-blue-600" title="Recurring task">
            <RefreshCw className="h-3 w-3" />
          </span>
        )}
        {tags.length > 0 && (
          <span className="flex items-center gap-1">
            <Tags className="h-3 w-3" />
            {tags.slice(0, 3).join(', ')}
            {tags.length > 3 && ` +${tags.length - 3}`}
          </span>
        )}
        {(task.comment_count ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {task.comment_count}
          </span>
        )}
        {(task.attachments?.length ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <Paperclip className="h-3 w-3" />
            {task.attachments?.length}
          </span>
        )}
      </div>
    );
  }

  function TaskCard({ task }: { task: ProjectTask }) {
    const progress = microtaskProgress(task.microtasks ?? []);
    return (
      <div
        className={cn(
          'nm-raised-sm p-3 cursor-pointer hover:shadow-md transition-all border-l-4',
          getStatusColor(task.status),
        )}
        onClick={() => handleRowClick(task)}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>
          <PriorityBadge priority={task.priority} className="text-[10px] px-1.5 py-0.5 h-auto" />
        </div>
        {renderTaskMeta(task)}
        <div className="mt-2 flex items-center justify-between">
          <StatusBadge status={task.status} className="text-[10px] px-1.5 py-0.5 h-auto" />
          {task.assignee ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[120px]">
              <UserAvatar user={task.assignee} />
              <span className="truncate">{task.assignee.first_name} {task.assignee.last_name}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Unassigned</span>
          )}
        </div>
        {progress !== null && (
          <div className="mt-2">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  const KANBAN_COLUMNS = [
    { key: 'todo', label: 'To Do', color: 'border-l-gray-400', header: 'text-gray-700' },
    { key: 'overdue', label: 'Overdue', color: 'border-l-red-500', header: 'text-red-700', isPseudo: true },
    { key: 'slow', label: 'Slow', color: 'border-l-orange-500', header: 'text-orange-700', isPseudo: true },
    { key: 'in_progress', label: 'In Progress', color: 'border-l-blue-500', header: 'text-blue-700' },
    { key: 'review', label: 'Review', color: 'border-l-purple-500', header: 'text-purple-700' },
    { key: 'completed', label: 'Completed', color: 'border-l-emerald-500', header: 'text-emerald-700' },
    { key: 'late_completed', label: 'Late Completion', color: 'border-l-red-500', header: 'text-red-700', isPseudo: true },
    { key: 'blocked', label: 'Blocked', color: 'border-l-red-500', header: 'text-red-800' },
  ];

  function KanbanView() {
    return (
      <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="flex gap-4 min-w-max pb-4">
          {KANBAN_COLUMNS.map((col) => {
            let columnTasks: ProjectTask[] = [];
            if (col.key === 'overdue') {
              columnTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'blocked' && isOverdue(t));
            } else if (col.key === 'slow') {
              columnTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'blocked' && isSlow(t) && !isOverdue(t));
            } else if (col.key === 'late_completed') {
              columnTasks = tasks.filter((t) => t.status === 'completed' && isSlow(t));
            } else {
              columnTasks = tasks.filter((t) => t.status === col.key && !isSlow(t) && !isOverdue(t));
            }
            return (
              <div key={col.key} className="nm-raised-sm flex flex-col w-[280px] max-h-[65vh]">
                <div className="p-3 border-b border-border/50 flex items-center justify-between">
                  <h3 className={`font-semibold text-sm ${col.header}`}>{col.label}</h3>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{columnTasks.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  {columnTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <PageShell
      title={pageTitle}
      icon={FolderKanban}
      description={pageDescription}
      actions={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New Task
        </Button>
      }
    >
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

      <Card className="nm-raised p-3">
        <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {!isEmployee && (
              <div className="flex items-center nm-raised-sm rounded-lg p-1">
                {(['all', 'my', 'unassigned'] as const).map((scope) => (
                  <Button
                    key={scope}
                    variant={viewScope === scope ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => { setViewScope(scope); setSelectedAssignees([]); setPage(1); }}
                    className="rounded-md capitalize"
                  >
                    {scope === 'all' ? 'All Tasks' : scope === 'my' ? 'My Tasks' : 'Unassigned'}
                  </Button>
                ))}
              </div>
            )}

            {viewScope !== 'my' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center -space-x-2 overflow-x-auto max-w-[220px] sm:max-w-xs py-1">
                  {visibleAssignees.map((u: User) => {
                    const selected = selectedAssignees.includes(Number(u.id));
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleAssignee(Number(u.id))}
                        title={`${u.first_name || ''} ${u.last_name || ''}`.trim()}
                        className={cn(
                          'relative rounded-full border-2 transition-all hover:z-10 focus:z-10',
                          selected ? 'border-primary ring-2 ring-primary/30 z-10' : 'border-transparent opacity-80 hover:opacity-100'
                        )}
                      >
                        <UserAvatar user={u} className="h-8 w-8" />
                        {selected && (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
                            <X className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedAssignees.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedAssignees([])}>
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            <div className="relative flex-1 xl:max-w-xs min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex items-center nm-raised-sm rounded-md p-0.5">
              <Button
                variant={view === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('list')}
                className="h-8 rounded-sm"
              >
                <List className="h-4 w-4 mr-1" /> List
              </Button>
              <Button
                variant={view === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('kanban')}
                className="h-8 rounded-sm"
              >
                <LayoutGrid className="h-4 w-4 mr-1" /> Kanban
              </Button>
            </div>
            <Button
              variant={hideCompleted ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setHideCompleted((prev) => !prev); setPage(1); }}
            >
              {hideCompleted ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {hideCompleted ? 'Completed hidden' : 'Hide completed'}
            </Button>
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="mr-1 h-4 w-4" /> Filters
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-4 mt-4 border-t">
            <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All priorities</SelectItem>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All projects</SelectItem>
                <SelectItem value="none">No project</SelectItem>
                {(projects?.projects ?? []).map((p: CrmProject) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subprojectId} onValueChange={(v) => { setSubprojectId(v); setPage(1); }} disabled={!projectId || projectId === 'none'}>
              <SelectTrigger><SelectValue placeholder="Subproject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All subprojects</SelectItem>
                {(subprojects?.subprojects ?? []).map((sp: CrmSubproject) => (
                  <SelectItem key={sp.id} value={String(sp.id)}>{sp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
              <X className="mr-2 h-4 w-4" /> Reset filters
            </Button>
          </div>
        )}
      </Card>

      {view === 'kanban' ? (
        <KanbanView />
      ) : (
        <>
          <DataTable
            headers={[
              { key: 'task', label: 'Task' },
              { key: 'status', label: 'Status' },
              { key: 'priority', label: 'Priority' },
              { key: 'assignee', label: 'Assignee' },
              { key: 'due', label: 'Due' },
              { key: 'actions', label: '', className: 'w-24' },
            ]}
            data={tasks}
            keyExtractor={(t) => t.id}
            loading={isLoading}
            onRowClick={handleRowClick}
            renderRow={(t) => [
              <div key="task" className="min-w-0">
                <Link
                  href={`/admin/crm/project-tasks/${t.id}`}
                  className="font-medium hover:underline block truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t.title}
                </Link>
                {renderTaskMeta(t)}
              </div>,
              <select
                key="status"
                value={t.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => statusMutation.mutate({ id: t.id, status: e.target.value })}
                className="h-8 rounded-md border bg-background px-2 text-xs nm-interactive"
              >
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>,
              <select
                key="priority"
                value={t.priority || ''}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateMutation.mutate({ id: t.id, data: { priority: e.target.value } })}
                className="h-8 rounded-md border bg-background px-2 text-xs nm-interactive"
              >
                <option value="">-</option>
                {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>,
              <div key="assignee" className="flex items-center gap-2">
                <UserAvatar user={t.assignee} />
                <select
                  value={t.assigned_to ?? ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateMutation.mutate({ id: t.id, data: { assigned_to: Number(e.target.value) || null } })}
                  className="h-8 rounded-md border bg-background px-2 text-xs nm-interactive max-w-[120px]"
                >
                  <option value="">Unassigned</option>
                  {(assignees ?? []).map((u: User) => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
              </div>,
              <span key="due" className="text-sm whitespace-nowrap">{formatDate(t.due_date)}</span>,
              <div key="actions" className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => { e.stopPropagation(); duplicateMutation.mutate(t.id); }}
                  title="Duplicate"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {isManager && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this task?')) deleteMutation.mutate(t.id); }}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>,
            ]}
          />
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            onPageChange={setPage}
          />

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New Project Task</DialogTitle>
                <DialogDescription>Create a task inside a project.</DialogDescription>
              </DialogHeader>
              {token && (
                <ProjectTaskForm
                  token={token}
                  onSuccess={() => { setCreateOpen(false); queryClient.invalidateQueries({ queryKey: ['tasks'] }); }}
                  onCancel={() => setCreateOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </PageShell>
  );
}
