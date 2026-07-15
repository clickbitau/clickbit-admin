'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
import { Progress } from '@/components/ui/progress';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { FormDialog } from '@/components/design-system/FormDialog';
import { ConfirmDialog } from '@/components/design-system/ConfirmDialog';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchProjects, fetchContacts, createProject, updateProject, deleteProject } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { CrmContact, CrmProject, ProjectStats } from '@/types/crm';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmProject | null>(null);
  const [deleting, setDeleting] = useState<CrmProject | null>(null);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit: 25 };
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.status = status;
    return params;
  }, [page, debouncedSearch, status]);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', queryParams],
    queryFn: () => fetchProjects(token!, queryParams),
    enabled: !!token,
  });

  const { data: contactsData } = useQuery({
    queryKey: ['contacts', 'project-form'],
    queryFn: () => fetchContacts(token!, { lifecycle_stage: 'customer', limit: 200 }),
    enabled: !!token && formOpen,
  });

  useRealtimeRefresh(['crm_projects'], ['projects'], { enabled: !!token });

  const projects = data?.projects ?? [];
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 25 };
  const stats = data?.stats ?? { total: 0, notStarted: 0, inProgress: 0, completed: 0, onHold: 0, cancelled: 0 } as ProjectStats;

  const statCards = [
    { label: 'Total Projects', value: stats.total },
    { label: 'In Progress', value: stats.inProgress },
    { label: 'Completed', value: stats.completed },
    { label: 'On Hold', value: stats.onHold },
  ];

  const createMutation = useMutation({
    mutationFn: (values: Partial<CrmProject>) => createProject(token!, values),
    onSuccess: () => { toast.success('Project created'); setFormOpen(false); queryClient.invalidateQueries({ queryKey: ['projects'] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed to create project'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<CrmProject> }) => updateProject(token!, id, values),
    onSuccess: () => { toast.success('Project updated'); setFormOpen(false); setEditing(null); queryClient.invalidateQueries({ queryKey: ['projects'] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed to update project'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProject(token!, id),
    onSuccess: () => { toast.success('Project deleted'); setDeleting(null); queryClient.invalidateQueries({ queryKey: ['projects'] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete project'),
  });

  function handleSubmit(values: Partial<CrmProject>) {
    if (editing) updateMutation.mutate({ id: editing.id, values });
    else createMutation.mutate(values);
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground">Track project delivery and budgets</p>
          </div>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-1 h-4 w-4" /> New Project</Button>
        </div>

        <StatCards cards={statCards} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search projects..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          headers={[
            { key: 'project', label: 'Project' },
            { key: 'status', label: 'Status' },
            { key: 'progress', label: 'Progress' },
            { key: 'budget', label: 'Budget' },
            { key: 'dates', label: 'Dates' },
            { key: 'actions', label: '' },
          ]}
          data={projects}
          keyExtractor={(p) => p.id}
          loading={isLoading}
          renderRow={(p) => [
            <div key="project">
              <Link href={`/admin/crm/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
              <p className="text-xs text-muted-foreground">{p.project_number}</p>
              {p.company && <p className="text-xs text-muted-foreground">{p.company.name}</p>}
            </div>,
            <StatusBadge key="status" status={p.status} />,
            <div key="progress" className="w-32"><Progress value={p.progress_percentage ?? 0} className="h-2" /></div>,
            <span key="budget">{formatCurrency(Number(p.budget ?? 0))}</span>,
            <div key="dates" className="text-sm text-muted-foreground">{formatDate(p.start_date)} — {formatDate(p.due_date)}</div>,
            <div key="actions" className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setFormOpen(true); }}>Edit</Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleting(p)}>Delete</Button>
            </div>,
          ]}
        />

        <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} onPageChange={setPage} />
      </div>

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} customers={contactsData?.contacts ?? []} onSubmit={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} />

      <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Delete Project" description={`Delete "${deleting?.name}"?`} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} loading={deleteMutation.isPending} />
    </div>
  );
}

function ProjectFormDialog({ open, onOpenChange, initial, customers, onSubmit, loading }: {
  open: boolean; onOpenChange: (open: boolean) => void; initial: CrmProject | null; customers: CrmContact[]; onSubmit: (v: Partial<CrmProject>) => void; loading?: boolean;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSubmit({
      name: String(data.get('name') ?? ''),
      description: String(data.get('description') ?? ''),
      status: String(data.get('status') ?? 'not_started'),
      customer_id: data.get('customer_id') ? Number(data.get('customer_id')) : undefined,
      budget: data.get('budget') ? Number(data.get('budget')) : undefined,
      currency: String(data.get('currency') ?? 'AUD'),
      start_date: String(data.get('start_date') ?? '') || undefined,
      due_date: String(data.get('due_date') ?? '') || undefined,
      priority: String(data.get('priority') ?? 'medium'),
    });
  }

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial ? 'Edit Project' : 'New Project'} onSubmit={handleSubmit} loading={loading}>
      <div className="grid gap-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={initial?.name ?? ''} required /></div>
      <div className="grid gap-2"><Label htmlFor="description">Description</Label><textarea id="description" name="description" defaultValue={initial?.description ?? ''} className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="status">Status</Label><Select name="status" defaultValue={String(initial?.status ?? 'not_started')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="not_started">Not Started</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="on_hold">On Hold</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><Label htmlFor="priority">Priority</Label><Select name="priority" defaultValue={initial?.priority ?? 'medium'}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="budget">Budget</Label><Input id="budget" name="budget" type="number" defaultValue={String(initial?.budget ?? '')} /></div>
        <div className="grid gap-2"><Label htmlFor="currency">Currency</Label><Input id="currency" name="currency" defaultValue={initial?.currency ?? 'AUD'} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="start_date">Start Date</Label><Input id="start_date" name="start_date" type="date" defaultValue={initial?.start_date?.slice(0, 10) ?? ''} /></div>
        <div className="grid gap-2"><Label htmlFor="due_date">Due Date</Label><Input id="due_date" name="due_date" type="date" defaultValue={initial?.due_date?.slice(0, 10) ?? ''} /></div>
      </div>
      <div className="grid gap-2"><Label htmlFor="customer_id">Customer</Label><Select name="customer_id" defaultValue={initial?.customer_id ? String(initial.customer_id) : ''}><SelectTrigger><SelectValue placeholder="Customer" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></div>
    </FormDialog>
  );
}
