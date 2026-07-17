'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
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
import { PageShell } from '@/components/design-system/PageShell';
import { Pagination } from '@/components/design-system/Pagination';
import { FormDialog } from '@/components/design-system/FormDialog';
import { ConfirmDialog } from '@/components/design-system/ConfirmDialog';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchProjects, fetchCompanies, fetchTeam, createProject, updateProject, deleteProject } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Company, CrmProject, User } from '@/types/crm';
import {
  Plus,
  Search,
  X,
  FolderKanban,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Pause,
  XCircle,
  AlertCircle,
  User as UserIcon,
  Filter,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  not_started: { label: 'Not Started', icon: AlertCircle, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  on_hold: { label: 'On Hold', icon: Pause, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

function getProgressColor(pct: number) {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-blue-500';
  if (pct >= 25) return 'bg-amber-500';
  return 'bg-gray-400';
}

function getInitials(name?: string) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export default function ProjectsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    company_id: '',
    manager_id: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearch = useDebounce(filters.search, 300);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmProject | null>(null);
  const [deleting, setDeleting] = useState<CrmProject | null>(null);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit: 25 };
    if (debouncedSearch) params.search = debouncedSearch;
    if (filters.status) params.status = filters.status;
    if (filters.company_id) params.company_id = filters.company_id;
    if (filters.manager_id) params.manager_id = filters.manager_id;
    return params;
  }, [page, debouncedSearch, filters]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['projects', queryParams],
    queryFn: () => fetchProjects(token!, queryParams),
    enabled: !!token,
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies', 'project-filters'],
    queryFn: () => fetchCompanies(token!, { mode: 'simple', limit: 100 }),
    enabled: !!token,
  });

  const { data: managers } = useQuery({
    queryKey: ['team', 'project-filters'],
    queryFn: () => fetchTeam(token!),
    enabled: !!token,
  });

  useRealtimeRefresh(['crm_projects'], ['projects'], { enabled: !!token });

  const projects = data?.projects ?? [];
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 25 };
  const stats = data?.stats ?? { total: 0, notStarted: 0, inProgress: 0, completed: 0, onHold: 0, cancelled: 0 };

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

  function handleFilterChange(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ search: '', status: '', company_id: '', manager_id: '' });
    setPage(1);
  }

  function handleStatClick(status: string) {
    setFilters((prev) => ({ ...prev, status: prev.status === status ? '' : status }));
    setPage(1);
  }

  function handleSubmit(values: Partial<CrmProject>) {
    if (editing) updateMutation.mutate({ id: editing.id, values });
    else createMutation.mutate(values);
  }

  const hasActiveFilters = filters.status || filters.company_id || filters.manager_id || filters.search;

  const statCards = [
    { key: 'total', label: 'Total', value: stats.total, status: '', icon: FolderKanban, color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-700' },
    { key: 'notStarted', label: 'Not Started', value: stats.notStarted, status: 'not_started', icon: AlertCircle, color: 'text-gray-700', bg: 'bg-gray-100 dark:bg-gray-700' },
    { key: 'inProgress', label: 'In Progress', value: stats.inProgress, status: 'in_progress', icon: Clock, color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { key: 'onHold', label: 'On Hold', value: stats.onHold, status: 'on_hold', icon: Pause, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { key: 'completed', label: 'Completed', value: stats.completed, status: 'completed', icon: CheckCircle, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { key: 'cancelled', label: 'Cancelled', value: stats.cancelled, status: 'cancelled', icon: XCircle, color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/30' },
  ];

  const companies = companiesData?.companies ?? [];
  const team = managers ?? [];

  return (
    <PageShell
      title="Projects"
      icon={FolderKanban}
      description="Manage and track all projects."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> New Project
          </Button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          const isActive = filters.status === s.status;
          return (
            <button
              key={s.key}
              onClick={() => handleStatClick(s.status)}
              className={`nm-raised p-3 text-left transition-all hover:-translate-y-0.5 ${isActive ? 'ring-2 ring-[#1FBBD2]' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="nm-raised p-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search projects..."
              className="pl-9 bg-transparent"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
            {filters.search && (
              <button
                onClick={() => handleFilterChange('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant="outline" onClick={() => setShowFilters((v) => !v)} className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#1FBBD2]" />}
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
              <SelectTrigger className="nm-raised-sm bg-transparent">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.company_id} onValueChange={(v) => handleFilterChange('company_id', v)}>
              <SelectTrigger className="nm-raised-sm bg-transparent">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All companies</SelectItem>
                {companies.map((c: Company) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.manager_id} onValueChange={(v) => handleFilterChange('manager_id', v)}>
              <SelectTrigger className="nm-raised-sm bg-transparent">
                <SelectValue placeholder="Manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All managers</SelectItem>
                {team.map((u: User) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.first_name} {u.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Active filters:</span>
            {filters.status && (
              <FilterChip
                label={statusConfig[filters.status]?.label || filters.status}
                onClear={() => handleFilterChange('status', '')}
              />
            )}
            {filters.company_id && (
              <FilterChip
                label={companies.find((c) => String(c.id) === filters.company_id)?.name || 'Company'}
                onClear={() => handleFilterChange('company_id', '')}
              />
            )}
            {filters.manager_id && (
              <FilterChip
                label={team.find((u) => String(u.id) === filters.manager_id) ? `${team.find((u) => String(u.id) === filters.manager_id)?.first_name} ${team.find((u) => String(u.id) === filters.manager_id)?.last_name}` : 'Manager'}
                onClear={() => handleFilterChange('manager_id', '')}
              />
            )}
            {filters.search && <FilterChip label={`"${filters.search}"`} onClear={() => handleFilterChange('search', '')} />}
            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 underline">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {projects.length === 0 && !isLoading ? (
        <div className="nm-raised py-16 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <Inbox className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No projects found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            Get started by creating your first project to track work and progress.
          </p>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Create Your First Project
          </Button>
        </div>
      ) : (
        <DataTable
          headers={[
            { key: 'project', label: 'Project', className: 'w-[45%]' },
            { key: 'status', label: 'Status' },
            { key: 'progress', label: 'Progress' },
            { key: 'due', label: 'Due Date' },
            { key: 'budget', label: 'Budget' },
            { key: 'actions', label: '' },
          ]}
          data={projects}
          keyExtractor={(p) => p.id}
          loading={isLoading}
          emptyText="No projects found."
          onRowClick={(p) => router.push(`/admin/crm/projects/${p.id}`)}
          renderRow={(p) => {
            const status = statusConfig[p.status] || statusConfig.not_started;
            const StatusIcon = status.icon;
            const progress = p.progress_percentage || 0;
            const isOverdue = p.due_date && new Date(p.due_date) < new Date() && p.status !== 'completed' && p.status !== 'cancelled';
            const managerName = p.manager ? `${p.manager.first_name || ''} ${p.manager.last_name || ''}`.trim() : '';
            return [
              <div key="project" className="flex items-center gap-3">
                {p.company?.logo_url ? (
                  <Image src={p.company.logo_url} alt={p.company.name} width={36} height={36} unoptimized className="h-9 w-9 rounded-lg object-cover border border-gray-200 dark:border-gray-600 flex-shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {getInitials(p.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-mono">{p.project_number}</span>
                    {p.company && (
                      <span className="flex items-center gap-0.5">
                        <Building2 className="h-3 w-3" /> {p.company.name}
                      </span>
                    )}
                    {managerName && (
                      <span className="flex items-center gap-0.5">
                        <UserIcon className="h-3 w-3" /> {managerName}
                      </span>
                    )}
                  </div>
                </div>
              </div>,
              <span key="status" className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${status.color}`}>
                <StatusIcon className="h-3.5 w-3.5" />
                {status.label}
              </span>,
              <div key="progress" className="flex items-center gap-2.5">
                <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(progress)}`} style={{ width: `${progress}%` }} />
                </div>
                <span className={`text-xs font-medium tabular-nums ${progress >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  {progress}%
                </span>
              </div>,
              <div key="due" className={`flex items-center gap-1.5 text-sm whitespace-nowrap ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                <Calendar className="h-3.5 w-3.5" />
                {p.due_date ? formatDate(p.due_date) : '-'}
              </div>,
              <span key="budget" className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                {formatCurrency(Number(p.budget || 0), p.currency)}
              </span>,
              <div key="actions" className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setFormOpen(true); }}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleting(p)}>Delete</Button>
              </div>,
            ];
          }}
        />
      )}

      <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} onPageChange={setPage} />

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        companies={companies}
        managers={team}
        onSubmit={handleSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete Project"
        description={`Delete "${deleting?.name}"?`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
      />
    </PageShell>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
      {label}
      <button onClick={onClear} className="hover:text-gray-900 dark:hover:text-gray-100">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function ProjectFormDialog({
  open,
  onOpenChange,
  initial,
  companies,
  managers,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: CrmProject | null;
  companies: Company[];
  managers: User[];
  onSubmit: (v: Partial<CrmProject>) => void;
  loading?: boolean;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSubmit({
      name: String(data.get('name') ?? ''),
      description: String(data.get('description') ?? ''),
      status: String(data.get('status') ?? 'not_started'),
      priority: String(data.get('priority') ?? 'medium'),
      customer_id: data.get('customer_id') ? Number(data.get('customer_id')) : undefined,
      company_id: data.get('company_id') ? Number(data.get('company_id')) : undefined,
      manager_id: data.get('manager_id') ? Number(data.get('manager_id')) : undefined,
      budget: data.get('budget') ? Number(data.get('budget')) : undefined,
      currency: String(data.get('currency') ?? 'AUD'),
      start_date: String(data.get('start_date') ?? '') || undefined,
      due_date: String(data.get('due_date') ?? '') || undefined,
      project_type: String(data.get('project_type') ?? '') || undefined,
    });
  }

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial ? 'Edit Project' : 'New Project'} onSubmit={handleSubmit} loading={loading}>
      <div className="grid gap-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={initial?.name ?? ''} required /></div>
      <div className="grid gap-2"><Label htmlFor="description">Description</Label><textarea id="description" name="description" defaultValue={initial?.description ?? ''} className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="status">Status</Label><Select name="status" defaultValue={String(initial?.status ?? 'not_started')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="not_started">Not Started</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="on_hold">On Hold</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><Label htmlFor="priority">Priority</Label><Select name="priority" defaultValue={String(initial?.priority ?? 'medium')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="budget">Budget</Label><Input id="budget" name="budget" type="number" defaultValue={String(initial?.budget ?? '')} /></div>
        <div className="grid gap-2"><Label htmlFor="currency">Currency</Label><Input id="currency" name="currency" defaultValue={initial?.currency ?? 'AUD'} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="start_date">Start Date</Label><Input id="start_date" name="start_date" type="date" defaultValue={initial?.start_date?.slice(0, 10) ?? ''} /></div>
        <div className="grid gap-2"><Label htmlFor="due_date">Due Date</Label><Input id="due_date" name="due_date" type="date" defaultValue={initial?.due_date?.slice(0, 10) ?? ''} /></div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="company_id">Company</Label>
        <Select name="company_id" defaultValue={initial?.company_id ? String(initial.company_id) : ''}>
          <SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {companies.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="manager_id">Manager</Label>
        <Select name="manager_id" defaultValue={initial?.manager_id ? String(initial.manager_id) : ''}>
          <SelectTrigger><SelectValue placeholder="Manager" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {managers.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2"><Label htmlFor="project_type">Project Type</Label><Input id="project_type" name="project_type" defaultValue={initial?.project_type ?? ''} /></div>
    </FormDialog>
  );
}
