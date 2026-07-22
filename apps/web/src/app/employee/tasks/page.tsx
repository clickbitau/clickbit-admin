'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { fetchEmployeeTasks, updateTaskStatus, logTaskTime, createTask } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ListTodo, Plus, Filter, Clock, X, Calendar, AlertCircle, TrendingUp, Search } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS = ['', 'todo', 'in_progress', 'review', 'completed', 'blocked'];
const PRIORITY_OPTIONS = ['', 'low', 'medium', 'high', 'urgent'];
const STATUS_LABEL: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', completed: 'Completed', blocked: 'Blocked' };
const STATUS_COLOR: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};
const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'completed', label: 'Completed' },
  { key: 'blocked', label: 'Blocked' },
];
const STATUS_BORDER: Record<string, string> = {
  todo: 'border-l-gray-400',
  in_progress: 'border-l-blue-500',
  review: 'border-l-purple-500',
  completed: 'border-l-emerald-500',
  blocked: 'border-l-red-500',
};
const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-cyan-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

interface Filters {
  status: string;
  priority: string;
  project_id: string;
  include_completed: boolean;
}

function isOverdue(due?: string | null, status?: string) {
  if (!due || status === 'completed') return false;
  return new Date(due) < new Date();
}

export default function EmployeeTasksPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({ status: '', priority: '', project_id: '', include_completed: true });
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', due_date: '', project_id: '' });
  const [logging, setLogging] = useState<{ taskId: number; hours: string; note: string } | null>(null);
  const [adding, setAdding] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['employee-tasks', token, filters],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number | boolean | undefined> = { limit: 100 };
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.project_id) params.project_id = filters.project_id;
      params.include_completed = filters.include_completed;
      return fetchEmployeeTasks(token, params);
    },
    enabled: !!token,
  });

  const tasks = useMemo(() => data?.data ?? [], [data?.data]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.crm_projects?.name?.toLowerCase().includes(q) ||
      t.crm_projects?.project_number?.toLowerCase().includes(q)
    );
  }, [tasks, search]);

  const projects = useMemo(() => {
    const map = new Map<string | number, { id: string | number; title: string }>();
    for (const t of tasks) {
      const p = t.crm_projects;
      if (p?.id && !map.has(p.id)) map.set(p.id, { id: p.id, title: p.name || `Project ${p.id}` });
    }
    return Array.from(map.values());
  }, [tasks]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const t of filteredTasks) {
      const key = t.crm_projects?.id ? String(t.crm_projects.id) : 'unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [filteredTasks]);

  const updateStatus = useMutation({
    mutationFn: ({ id, status, hours }: { id: number; status: string; hours?: string }) =>
      updateTaskStatus(token!, id, { status, actual_hours: hours ? Number(hours) : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-tasks'] });
      toast.success('Status updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  const logTime = useMutation({
    mutationFn: ({ id, hours, note }: { id: number; hours: string; note: string }) => {
      if (!token) throw new Error('No token');
      const h = Number(hours);
      const now = new Date();
      const start = new Date(now.getTime() - h * 3600000);
      return logTaskTime(token, id, { start_time: start.toISOString(), end_time: now.toISOString(), description: note });
    },
    onSuccess: () => {
      toast.success('Time logged');
      setLogging(null);
      queryClient.invalidateQueries({ queryKey: ['employee-tasks'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to log time'),
  });

  async function handleAddTask() {
    if (!token || !newTask.title.trim()) return;
    setAdding(true);
    try {
      await createTask(token, {
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        priority: newTask.priority,
        due_date: newTask.due_date || undefined,
        status: 'todo',
        crm_project_id: newTask.project_id ? Number(newTask.project_id) : undefined,
      });
      toast.success('Task created');
      setShowAdd(false);
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '', project_id: '' });
      queryClient.invalidateQueries({ queryKey: ['employee-tasks'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create task');
    } finally {
      setAdding(false);
    }
  }

  function handleStatusChange(task: any, value: string) {
    if (value === 'completed') {
      updateStatus.mutate({ id: task.id, status: value, hours: String(task.estimated_hours || task.actual_hours || '') });
    } else {
      updateStatus.mutate({ id: task.id, status: value });
    }
  }

  return (
    <PageShell
      title="My Tasks"
      icon={ListTodo}
      description="Manage tasks assigned to you."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={filters.status === s.key ? 'default' : 'outline'}
                onClick={() => {
                  const isAll = s.key === '';
                  setFilters({ ...filters, status: s.key, include_completed: isAll || s.key === 'completed' });
                }}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Task
          </Button>
        </div>
      }
    >
      <Card className="nm-raised p-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className="h-8 w-8 p-0"
              title="Filters"
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 w-8 p-0" title="Refresh">
              <Clock className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 mt-4 border-t">
            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              >
                <option value="">All Priorities</option>
                {PRIORITY_OPTIONS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Project</Label>
              <select
                value={filters.project_id}
                onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              >
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
              </select>
            </div>
          </div>
        )}
      </Card>

      {isLoading ? (
        <div className="h-40 nm-raised animate-pulse rounded-2xl" />
      ) : filteredTasks.length === 0 ? (
        <Card className="nm-raised p-8 text-center text-sm text-muted-foreground">No tasks found.</Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([key, groupTasks]) => (
            <Card key={key} className="nm-raised">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {key === 'unassigned' ? 'No Project' : (groupTasks[0]?.crm_projects?.name || `Project ${key}`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {groupTasks.map((t) => {
                    const logTask = logging;
                    const estimated = typeof t.estimated_hours === 'string' ? Number(t.estimated_hours) : t.estimated_hours;
                    const actual = typeof t.actual_hours === 'string' ? Number(t.actual_hours) : t.actual_hours;
                    const hoursProgress = estimated && estimated > 0 ? Math.min(100, Math.round(((actual || 0) / estimated) * 100)) : null;
                    const overdue = isOverdue(t.due_date, t.status);
                    return (
                    <div key={t.id} className={cn('p-4 hover:bg-muted/40 transition-colors border-l-4', STATUS_BORDER[t.status] || 'border-l-gray-400')}>
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link href={`/employee/tasks/${t.id}`} className="font-semibold hover:underline line-clamp-1">{t.title}</Link>
                              {overdue && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" /> Overdue
                                </span>
                              )}
                            </div>
                            <span
                              className={cn('mt-1.5 h-2 w-2 rounded-full flex-shrink-0', PRIORITY_DOT[t.priority?.toLowerCase() || ''] || 'bg-slate-400')}
                              title={`${t.priority || 'No'} priority`}
                            />
                          </div>
                          {t.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.description}</p>}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {t.due_date && <span className={cn('flex items-center gap-1', overdue && 'text-destructive font-medium')}><Calendar className="h-3 w-3" /> {formatDate(t.due_date)}</span>}
                            {estimated != null && estimated > 0 && <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {actual || 0}/{estimated}h</span>}
                            <PriorityBadge priority={t.priority} />
                          </div>
                          {hoursProgress !== null && (
                            <div className="mt-2">
                              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div className={cn('h-full transition-all', hoursProgress > 100 ? 'bg-red-500' : 'bg-primary')} style={{ width: `${Math.min(100, hoursProgress)}%` }} />
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-1">{actual || 0} / {estimated}h logged</div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={t.status}
                            onChange={(e) => handleStatusChange(t, e.target.value)}
                            className={`text-xs px-2 py-1 rounded-full border-0 ${STATUS_COLOR[t.status] || STATUS_COLOR.todo}`}
                          >
                            {STATUS_OPTIONS.filter(Boolean).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                          </select>
                          {logTask && logTask.taskId === t.id ? (
                            <div className="flex items-center gap-2">
                              <Input type="number" step="0.5" value={logTask.hours} onChange={(e) => setLogging({ ...logTask, hours: e.target.value })} placeholder="Hours" className="w-20 h-8 text-xs" />
                              <Input value={logTask.note} onChange={(e) => setLogging({ ...logTask, note: e.target.value })} placeholder="Note" className="w-32 h-8 text-xs" />
                              <Button size="sm" className="h-8" onClick={() => logTime.mutate({ id: t.id, hours: logTask.hours, note: logTask.note })}>Save</Button>
                              <Button size="sm" variant="outline" className="h-8" onClick={() => setLogging(null)}><X className="h-3 w-3" /></Button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" className="h-8" onClick={() => setLogging({ taskId: t.id, hours: '', note: '' })} title="Log Time">
                              <Clock className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );})}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4">
          <Card className="nm-raised w-full max-w-lg">
            <CardHeader>
              <CardTitle className="text-base">Add Task</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1"><Label>Title</Label><Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="What needs to be done?" /></div>
              <div className="space-y-1"><Label>Description</Label><Textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Priority</Label>
                  <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                    {PRIORITY_OPTIONS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><Label>Due Date</Label><Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><Label>Project</Label>
                <select value={newTask.project_id} onChange={(e) => setNewTask({ ...newTask, project_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value="">No Project</option>
                  {projects.map(p => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button onClick={handleAddTask} disabled={adding || !newTask.title.trim()}>{adding ? 'Creating…' : 'Create Task'}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
