'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createProjectTask, fetchAssignees, fetchProjects } from '@/lib/api';
import type { CrmProject, ProjectTask, User } from '@/types/crm';
import { Plus } from 'lucide-react';

const statuses = ['todo', 'in_progress', 'review', 'completed', 'blocked'];
const priorities = ['low', 'medium', 'high', 'urgent'];

interface ProjectTaskFormProps {
  token: string;
  onSuccess?: (task: ProjectTask) => void;
  onCancel?: () => void;
  initial?: Partial<ProjectTask> & { project_id?: string | number };
}

export function ProjectTaskForm({ token, onSuccess, onCancel, initial }: ProjectTaskFormProps) {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState(String(initial?.project_id || ''));
  const [form, setForm] = useState<Partial<ProjectTask>>({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    due_date: '',
    estimated_hours: '',
    ...initial,
  });

  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects-new', token],
    queryFn: () => fetchProjects(token),
    enabled: !!token,
  });

  const { data: assignees, isLoading: loadingAssignees } = useQuery({
    queryKey: ['assignees'],
    queryFn: () => fetchAssignees(token),
    enabled: !!token,
  });

  const projects = projectsData?.projects ?? [];

  const mutation = useMutation({
    mutationFn: () => createProjectTask(token, projectId, {
      ...form,
      assigned_to: form.assigned_to ? Number(form.assigned_to) : undefined,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : undefined,
    }),
    onSuccess: (data: any) => {
      toast.success('Project task created');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onSuccess?.(data?.task ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create project task'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Project</Label>
        {loadingProjects ? <Skeleton className="h-10 w-full" /> : (
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Select project</option>
            {projects.map((p: CrmProject) => <option key={p.id} value={String(p.id)}>{p.name || `Project ${p.id}`}</option>)}
          </select>
        )}
      </div>
      <div className="md:col-span-2"><Label>Title</Label><Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
      <div><Label>Status</Label>
        <select value={form.status || 'todo'} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div><Label>Priority</Label>
        <select value={form.priority || 'medium'} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div><Label>Assignee</Label>
        {loadingAssignees ? <Skeleton className="h-10 w-full" /> : (
          <select value={form.assigned_to || ''} onChange={(e) => setForm({ ...form, assigned_to: e.target.value ? Number(e.target.value) : undefined })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Unassigned</option>
            {assignees?.map((u: User) => <option key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</option>)}
          </select>
        )}
      </div>
      <div><Label>Due date</Label><Input type="date" value={form.due_date || ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
      <div><Label>Estimated hours</Label><Input type="number" value={form.estimated_hours || ''} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.title && projectId && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Task
        </Button>
      </div>
    </div>
  );
}
