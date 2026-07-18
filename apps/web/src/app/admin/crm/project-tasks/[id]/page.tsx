'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageShell } from '@/components/design-system/PageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import {
  fetchTask,
  updateTask,
  deleteTask,
  fetchAssignees,
  fetchProjects,
  fetchProjectSubprojects,
  fetchTaskMicrotasks,
  createTaskMicrotask,
  updateTaskMicrotask,
  toggleTaskMicrotask,
  deleteTaskMicrotask,
  fetchTaskComments,
  createTaskComment,
  deleteTaskComment,
  fetchTaskWorkLog,
  logTaskTime,
  addTaskAttachment,
} from '@/lib/api';
import { formatDate, formatDateTime, getInitials } from '@/lib/format';
import type { ProjectTask, User, CrmProject, CrmSubproject, TaskMicrotask, TaskComment, TaskWorkLog } from '@/types/crm';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  CheckSquare,
  MessageSquare,
  Clock,
  Paperclip,
  ListTree,
  Calendar,
  User as UserIcon,
  Building2,
  FolderKanban,
  Send,
  X,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUSES = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'completed', label: 'Completed' },
  { key: 'blocked', label: 'Blocked' },
];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export default function ProjectTaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;
  const router = useRouter();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [activeTab, setActiveTab] = useState('overview');
  const [form, setForm] = useState<Partial<ProjectTask>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['task', token, taskId],
    queryFn: () => fetchTask(token!, taskId),
    enabled: !!token && !!taskId,
  });

  const task = data as ProjectTask | undefined;

  useEffect(() => {
    if (task) setForm(task);
  }, [task]);

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
    queryKey: ['subprojects', form.crm_project_id],
    queryFn: () => fetchProjectSubprojects(token!, Number(form.crm_project_id)),
    enabled: !!token && !!form.crm_project_id,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<ProjectTask>) => updateTask(token!, Number(taskId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', token, taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update task'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(token!, Number(taskId)),
    onSuccess: () => {
      toast.success('Task deleted');
      router.push('/admin/crm/project-tasks');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete task'),
  });

  const updateField = (key: keyof ProjectTask, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!form.title?.trim()) return toast.error('Title is required');
    const payload: Partial<ProjectTask> = { ...form };
    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <PageShell title="Task" icon={CheckSquare}>
        <Skeleton className="h-40 w-full" />
      </PageShell>
    );
  }

  if (error || !task) {
    return (
      <PageShell title="Task" icon={CheckSquare}>
        <p className="text-destructive">Failed to load task.</p>
        <Button variant="ghost" asChild className="mt-2">
          <Link href="/admin/crm/project-tasks"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={task.title}
      icon={CheckSquare}
      description="Task details, microtasks, comments, work log and attachments"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/crm/project-tasks"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
          {isManager && (
            <Button
              variant="destructive"
              onClick={() => { if (window.confirm('Delete this task?')) deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {task.assignee && (
          <Badge variant="outline" className="flex items-center gap-1">
            <UserIcon className="h-3 w-3" /> {task.assignee.first_name} {task.assignee.last_name}
          </Badge>
        )}
        {task.due_date && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Due {formatDate(task.due_date)}
          </Badge>
        )}
        {task.crmProject && (
          <Link href={`/admin/crm/projects/${task.crmProject.id}`}>
            <Badge variant="outline" className="flex items-center gap-1 cursor-pointer">
              <FolderKanban className="h-3 w-3" /> {task.crmProject.name}
            </Badge>
          </Link>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="microtasks">Microtasks ({task.microtasks?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="comments">Comments ({task.task_comments?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="worklog">Work Log</TabsTrigger>
          <TabsTrigger value="attachments">Attachments ({task.attachments?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="subtasks">Subtasks ({task.subTasks?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 nm-raised-sm">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Details</CardTitle>
                  <CardDescription>Edit the core task fields</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title || ''} onChange={(e) => updateField('title', e.target.value)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea rows={4} value={form.description || ''} onChange={(e) => updateField('description', e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status || ''} onValueChange={(v) => updateField('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority || ''} onValueChange={(v) => updateField('priority', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assignee</Label>
                    <Select
                      value={form.assigned_to ? String(form.assigned_to) : ''}
                      onValueChange={(v) => updateField('assigned_to', v ? Number(v) : null)}
                    >
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {(assignees ?? []).map((u: User) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Customer Visible</Label>
                    <div className="flex items-center h-10 gap-2">
                      <input
                        type="checkbox"
                        checked={!!form.customer_visible}
                        onChange={(e) => updateField('customer_visible', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-muted-foreground">Visible to customer</span>
                    </div>
                  </div>
                  <div>
                    <Label>Project</Label>
                    <Select
                      value={form.crm_project_id ? String(form.crm_project_id) : ''}
                      onValueChange={(v) => {
                        const val = v ? Number(v) : null;
                        updateField('crm_project_id', val);
                        updateField('subproject_id', null);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No project</SelectItem>
                        {(projects?.projects ?? []).map((p: CrmProject) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Subproject</Label>
                    <Select
                      value={form.subproject_id ? String(form.subproject_id) : ''}
                      onValueChange={(v) => updateField('subproject_id', v ? Number(v) : null)}
                      disabled={!form.crm_project_id}
                    >
                      <SelectTrigger><SelectValue placeholder="No subproject" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No subproject</SelectItem>
                        {(subprojects?.subprojects ?? []).map((sp: CrmSubproject) => (
                          <SelectItem key={sp.id} value={String(sp.id)}>{sp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input type="date" value={form.due_date || ''} onChange={(e) => updateField('due_date', e.target.value)} />
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" value={form.start_date || ''} onChange={(e) => updateField('start_date', e.target.value)} />
                  </div>
                  <div>
                    <Label>Estimated Hours</Label>
                    <Input type="number" value={form.estimated_hours ?? ''} onChange={(e) => updateField('estimated_hours', e.target.value === '' ? null : Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Actual Hours</Label>
                    <Input type="number" value={form.actual_hours ?? ''} onChange={(e) => updateField('actual_hours', e.target.value === '' ? null : Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Position</Label>
                    <Input type="number" value={form.position ?? ''} onChange={(e) => updateField('position', e.target.value === '' ? null : Number(e.target.value))} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="nm-raised-sm">
                <CardHeader>
                  <CardTitle className="text-base">Related</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {task.parentTask ? (
                    <div className="flex items-center gap-2">
                      <ListTree className="h-4 w-4 text-muted-foreground" />
                      <span>Parent:</span>
                      <Link href={`/admin/crm/project-tasks/${task.parentTask.id}`} className="hover:underline text-primary truncate">
                        {task.parentTask.title}
                      </Link>
                    </div>
                  ) : (
                    <div className="text-muted-foreground flex items-center gap-2">
                      <ListTree className="h-4 w-4" /> No parent task
                    </div>
                  )}
                  {task.customer && (
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <span>Customer:</span>
                      <span>{task.customer.name}</span>
                    </div>
                  )}
                  {task.project && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>Deal:</span>
                      <Link href={`/admin/crm/deals/${task.project.id}`} className="hover:underline text-primary truncate">{task.project.title}</Link>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Created:</span>
                    <span>{formatDateTime(task.created_at)}</span>
                  </div>
                  {task.completed_at && (
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-emerald-500" />
                      <span>Completed:</span>
                      <span>{formatDateTime(task.completed_at)}</span>
                    </div>
                  )}
                  {task.tags && task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">
                      {task.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="microtasks">
          <MicrotasksTab taskId={Number(taskId)} token={token!} />
        </TabsContent>

        <TabsContent value="comments">
          <CommentsTab taskId={Number(taskId)} token={token!} isManager={isManager} currentUserId={user?.id} />
        </TabsContent>

        <TabsContent value="worklog">
          <WorkLogTab taskId={Number(taskId)} token={token!} />
        </TabsContent>

        <TabsContent value="attachments">
          <AttachmentsTab task={task} token={token!} />
        </TabsContent>

        <TabsContent value="subtasks">
          <SubtasksTab task={task} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function MicrotasksTab({ taskId, token }: { taskId: number; token: string }) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [editing, setEditing] = useState<{ id: number; title: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['task-microtasks', token, taskId],
    queryFn: () => fetchTaskMicrotasks(token, taskId),
    enabled: !!token && !!taskId,
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => createTaskMicrotask(token, taskId, title),
    onSuccess: () => {
      setNewTitle('');
      queryClient.invalidateQueries({ queryKey: ['task-microtasks', token, taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', token, taskId] });
      toast.success('Microtask added');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => updateTaskMicrotask(token, taskId, id, { title }),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['task-microtasks', token, taskId] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => toggleTaskMicrotask(token, taskId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-microtasks', token, taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', token, taskId] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTaskMicrotask(token, taskId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-microtasks', token, taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', token, taskId] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const microtasks = data?.microtasks ?? [];

  return (
    <Card className="nm-raised-sm">
      <CardHeader>
        <CardTitle className="text-base">Microtasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Add a microtask..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <Button onClick={() => createMutation.mutate(newTitle)} disabled={!newTitle.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
        {isLoading ? <Skeleton className="h-24" /> : microtasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No microtasks yet.</p>
        ) : (
          <div className="space-y-2">
            {microtasks.map((mt) => (
              <div key={mt.id} className="flex items-center gap-2 p-2 nm-raised-sm rounded-lg">
                <input
                  type="checkbox"
                  checked={!!mt.is_completed}
                  onChange={() => toggleMutation.mutate(mt.id)}
                  className="h-4 w-4"
                />
                {editing?.id === mt.id ? (
                  <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="flex-1" />
                ) : (
                  <span className={cn('flex-1 text-sm', mt.is_completed && 'line-through text-muted-foreground')}>{mt.title}</span>
                )}
                {editing?.id === mt.id ? (
                  <>
                    <Button size="sm" onClick={() => updateMutation.mutate(editing)}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: mt.id, title: mt.title })}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(mt.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommentsTab({ taskId, token, isManager, currentUserId }: { taskId: number; token: string; isManager: boolean; currentUserId?: number | null }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['task-comments', token, taskId],
    queryFn: () => fetchTaskComments(token, taskId),
    enabled: !!token && !!taskId,
  });

  const createMutation = useMutation({
    mutationFn: () => createTaskComment(token, taskId, content, isInternal),
    onSuccess: () => {
      setContent('');
      setIsInternal(false);
      queryClient.invalidateQueries({ queryKey: ['task-comments', token, taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', token, taskId] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => deleteTaskComment(token, taskId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', token, taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', token, taskId] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const comments = data?.comments ?? [];

  return (
    <Card className="nm-raised-sm">
      <CardHeader>
        <CardTitle className="text-base">Comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea placeholder="Write a comment..." value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="h-4 w-4" />
              Internal only
            </label>
            <Button onClick={() => createMutation.mutate()} disabled={!content.trim()}>
              <Send className="mr-1 h-4 w-4" /> Post
            </Button>
          </div>
        </div>
        {isLoading ? <Skeleton className="h-24" /> : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="p-3 nm-raised-sm rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold">
                      {getInitials(`${c.profiles?.first_name ?? ''} ${c.profiles?.last_name ?? ''}`)}
                    </div>
                    <span className="text-sm font-medium">{c.profiles?.first_name} {c.profiles?.last_name}</span>
                    {c.is_internal && <Badge variant="secondary" className="text-xs">Internal</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                {(isManager || c.author_id === currentUserId) && (
                  <Button variant="ghost" size="sm" className="text-destructive mt-2" onClick={() => deleteMutation.mutate(c.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkLogTab({ taskId, token }: { taskId: number; token: string }) {
  const queryClient = useQueryClient();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [description, setDescription] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['task-worklog', token, taskId],
    queryFn: () => fetchTaskWorkLog(token, taskId),
    enabled: !!token && !!taskId,
  });

  const logMutation = useMutation({
    mutationFn: () =>
      logTaskTime(token, taskId, {
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        description,
      }),
    onSuccess: () => {
      setStart('');
      setEnd('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['task-worklog', token, taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', token, taskId] });
      toast.success('Time logged');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const logs = data?.data ?? [];

  return (
    <Card className="nm-raised-sm">
      <CardHeader>
        <CardTitle className="text-base">Work Log</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Start</Label>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label>End</Label>
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <Textarea placeholder="What did you work on?" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Button onClick={() => logMutation.mutate()} disabled={!start || !end}>Log Time</Button>
        {isLoading ? <Skeleton className="h-24" /> : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time logged yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log: TaskWorkLog) => (
              <div key={log.id} className="flex items-center justify-between p-2 nm-raised-sm rounded-lg text-sm">
                <div>
                  <p className="font-medium">{log.description || 'Time entry'}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(log.time_entry?.clock_in_time)} — {formatDateTime(log.time_entry?.clock_out_time)}
                  </p>
                </div>
                <Badge variant="outline">{log.hours ?? 0}h</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttachmentsTab({ task, token }: { task: ProjectTask; token: string }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: () => addTaskAttachment(token, task.id, file!),
    onSuccess: () => {
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['task', token, task.id] });
      toast.success('Attachment uploaded');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  return (
    <Card className="nm-raised-sm">
      <CardHeader>
        <CardTitle className="text-base">Attachments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button onClick={() => uploadMutation.mutate()} disabled={!file}>Upload</Button>
        </div>
        {(!task.attachments || task.attachments.length === 0) ? (
          <p className="text-sm text-muted-foreground">No attachments yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {task.attachments.map((att, idx) => (
              <a
                key={idx}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 nm-raised-sm rounded-lg hover:bg-primary/5"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm truncate">{att.name}</span>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubtasksTab({ task }: { task: ProjectTask }) {
  return (
    <Card className="nm-raised-sm">
      <CardHeader>
        <CardTitle className="text-base">Subtasks</CardTitle>
      </CardHeader>
      <CardContent>
        {(!task.subTasks || task.subTasks.length === 0) ? (
          <p className="text-sm text-muted-foreground">No subtasks.</p>
        ) : (
          <div className="space-y-2">
            {task.subTasks.map((st) => (
              <Link
                key={st.id}
                href={`/admin/crm/project-tasks/${st.id}`}
                className="flex items-center justify-between p-3 nm-raised-sm rounded-lg hover:bg-primary/5"
              >
                <span className="text-sm font-medium">{st.title}</span>
                <StatusBadge status={st.status} />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
