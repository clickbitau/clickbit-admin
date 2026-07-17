'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { useRealtimeRefresh } from '@/lib/realtime';
import {
  fetchProject,
  fetchProjectTasks,
  fetchProjectSubprojects,
  fetchProjectDocuments,
  fetchProjectMeetings,
  updateProjectStatus,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { CrmProject, CrmSubproject, ProjectDocument, ProjectMeeting, ProjectTask } from '@/types/crm';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  FolderKanban,
  User,
  FileText,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const PROJECT_STATUS_OPTIONS = ['not_started', 'in_progress', 'on_hold', 'completed', 'cancelled'];

function formatFileSize(bytes?: number) {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const id = String(params.id);
  const [activeTab, setActiveTab] = useState('overview');
  const [tasksPage, setTasksPage] = useState(1);
  const [subprojectsPage, setSubprojectsPage] = useState(1);
  const [documentsPage, setDocumentsPage] = useState(1);
  const [meetingsPage, setMeetingsPage] = useState(1);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(token!, id),
    enabled: !!token && !!id,
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['project-tasks', id, tasksPage],
    queryFn: () => fetchProjectTasks(token!, id, { page: tasksPage, limit: 25 }),
    enabled: !!token && !!id,
  });

  const { data: subprojectsData, isLoading: subprojectsLoading } = useQuery({
    queryKey: ['project-subprojects', id, subprojectsPage],
    queryFn: () => fetchProjectSubprojects(token!, id, { page: subprojectsPage, limit: 25 }),
    enabled: !!token && !!id,
  });

  const { data: documentsData, isLoading: documentsLoading } = useQuery({
    queryKey: ['project-documents', id, documentsPage],
    queryFn: () => fetchProjectDocuments(token!, id, { page: documentsPage, limit: 25 }),
    enabled: !!token && !!id,
  });

  const { data: meetingsData, isLoading: meetingsLoading } = useQuery({
    queryKey: ['project-meetings', id, meetingsPage],
    queryFn: () => fetchProjectMeetings(token!, id, { page: meetingsPage, limit: 25 }),
    enabled: !!token && !!id,
  });

  useRealtimeRefresh(['crm_projects', 'project_tasks', 'crm_subprojects'], ['project', id], { enabled: !!id });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateProjectStatus(token!, id, { status }),
    onSuccess: () => {
      toast.success('Project status updated');
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  if (projectLoading) {
    return (
      <PageShell title="Project" icon={FolderKanban} description="Loading...">
        <div className="p-6 text-sm text-muted-foreground">Loading project...</div>
      </PageShell>
    );
  }

  if (!project) {
    return (
      <PageShell title="Project" icon={FolderKanban} description="Not found">
        <div className="p-6 text-sm text-muted-foreground">Project not found.</div>
      </PageShell>
    );
  }

  const financials = project.financials ?? {
    totalValue: 0,
    totalPaid: 0,
    totalExpenses: 0,
    totalCosts: 0,
    netProfit: 0,
    labourCost: 0,
    totalPaymentsReceived: 0,
  };

  const isOverdue = project.due_date && new Date(project.due_date) < new Date() && project.status !== 'completed' && project.status !== 'cancelled';

  return (
    <PageShell
      title={project.name}
      icon={FolderKanban}
      description={project.project_number || 'Project detail'}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/crm/projects"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          <Select value={project.status} onValueChange={(v) => statusMutation.mutate(v)} disabled={statusMutation.isPending}>
            <SelectTrigger className="w-40 h-9 nm-raised-sm bg-transparent">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {/* Header stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Budget" value={formatCurrency(Number(project.budget ?? 0))} />
        <StatCard icon={Briefcase} label="Revenue" value={formatCurrency(financials.totalValue)} />
        <StatCard icon={CheckCircle2} label="Paid" value={formatCurrency(financials.totalPaid)} />
        <StatCard icon={DollarSign} label="Net Profit" value={formatCurrency(financials.netProfit)} />
      </div>

      {/* Progress and support */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4" /> Progress</span>
              <span className="text-sm font-semibold">{project.progress_percentage ?? 0}%</span>
            </div>
            <Progress value={project.progress_percentage ?? 0} className="h-2" />
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
              {isOverdue && <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"><AlertCircle className="h-3.5 w-3.5" /> Overdue</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Start</span>
              <span>{formatDate(project.start_date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Due</span>
              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{formatDate(project.due_date)}</span>
            </div>
            {project.support_period_type && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Support</p>
                <p className="text-xs">{project.support_period_type} {project.support_price ? `· ${formatCurrency(Number(project.support_price))}` : ''}</p>
                <p className="text-xs text-muted-foreground">{formatDate(project.support_start_date)} - {formatDate(project.support_end_date)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasksData?.stats?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="subprojects">Subprojects ({subprojectsData?.pagination?.totalItems ?? 0})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documentsData?.pagination?.totalItems ?? 0})</TabsTrigger>
          <TabsTrigger value="meetings">Meetings ({meetingsData?.pagination?.totalItems ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>About</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground whitespace-pre-line">{project.description || 'No description.'}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between"><span className="text-muted-foreground">Project Type</span> <span>{project.project_type || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Estimated Hours</span> <span>{project.estimated_hours ?? '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Actual Hours</span> <span>{project.actual_hours ?? '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Hourly Rate</span> <span>{project.hourly_rate ? formatCurrency(Number(project.hourly_rate)) : '-'}</span></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>People</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <PersonRow icon={User} label="Manager" value={project.manager ? `${project.manager.first_name} ${project.manager.last_name}` : '-'} sub={project.manager?.email} />
                <PersonRow icon={Building2} label="Company" value={project.company?.name || '-'} sub={project.company?.email} />
                <PersonRow icon={User} label="Customer" value={project.customer?.name || '-'} sub={project.customer?.email} />
                <PersonRow icon={Briefcase} label="Deal" value={project.deal?.title || '-'} sub={project.deal?.deal_number} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-3">
          <DataTable
            headers={[
              { key: 'task', label: 'Task' },
              { key: 'status', label: 'Status' },
              { key: 'priority', label: 'Priority' },
              { key: 'assignee', label: 'Assignee' },
              { key: 'due', label: 'Due' },
            ]}
            data={tasksData?.tasks ?? []}
            keyExtractor={(t) => t.id}
            loading={tasksLoading}
            emptyText="No tasks."
            onRowClick={(t) => router.push(`/admin/crm/project-tasks/${t.id}`)}
            renderRow={(t: ProjectTask) => [
              <div key="task"><p className="font-medium">{t.title}</p><p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p></div>,
              <StatusBadge key="status" status={t.status} />,
              <PriorityBadge key="priority" priority={t.priority} />,
              <span key="assignee" className="text-sm">{t.assignee ? `${t.assignee.first_name} ${t.assignee.last_name}` : '-'}</span>,
              <span key="due">{formatDate(t.due_date)}</span>,
            ]}
          />
          {tasksData?.pagination && (
            <Pagination currentPage={tasksData.pagination.currentPage} totalPages={tasksData.pagination.totalPages} totalItems={tasksData.pagination.totalItems} onPageChange={setTasksPage} />
          )}
        </TabsContent>

        <TabsContent value="subprojects" className="space-y-3">
          <DataTable
            headers={[
              { key: 'name', label: 'Subproject' },
              { key: 'status', label: 'Status' },
              { key: 'progress', label: 'Progress' },
              { key: 'priority', label: 'Priority' },
              { key: 'budget', label: 'Budget' },
              { key: 'due', label: 'Due' },
            ]}
            data={(subprojectsData?.subprojects ?? []) as CrmSubproject[]}
            keyExtractor={(s) => s.id}
            loading={subprojectsLoading}
            emptyText="No subprojects."
            onRowClick={(s) => router.push(`/admin/crm/subprojects/${s.id}`)}
            renderRow={(s: CrmSubproject) => [
              <div key="name"><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p></div>,
              <StatusBadge key="status" status={s.status} />,
              <div key="progress" className="w-24"><Progress value={s.progress_percentage ?? 0} className="h-1.5" /><p className="text-xs text-right mt-0.5">{s.progress_percentage ?? 0}%</p></div>,
              <PriorityBadge key="priority" priority={s.priority} />,
              <span key="budget" className="text-sm">{formatCurrency(Number(s.budget ?? 0))}</span>,
              <span key="due">{formatDate(s.due_date)}</span>,
            ]}
          />
          {subprojectsData?.pagination && (
            <Pagination currentPage={subprojectsData.pagination.currentPage} totalPages={subprojectsData.pagination.totalPages} totalItems={subprojectsData.pagination.totalItems} onPageChange={setSubprojectsPage} />
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-3">
          <DataTable
            headers={[
              { key: 'name', label: 'File' },
              { key: 'type', label: 'Type' },
              { key: 'size', label: 'Size' },
              { key: 'uploaded', label: 'Uploaded' },
              { key: 'action', label: '' },
            ]}
            data={(documentsData?.documents ?? []) as ProjectDocument[]}
            keyExtractor={(d) => d.id}
            loading={documentsLoading}
            emptyText="No documents."
            renderRow={(d: ProjectDocument) => [
              <div key="name" className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> <span className="font-medium">{d.file_name}</span></div>,
              <span key="type" className="text-xs text-muted-foreground">{d.file_type || '-'}</span>,
              <span key="size" className="text-sm">{formatFileSize(d.file_size)}</span>,
              <span key="uploaded" className="text-sm">{formatDate(d.created_at)}</span>,
              <div key="action">
                {d.file_url && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={d.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                )}
              </div>,
            ]}
          />
          {documentsData?.pagination && (
            <Pagination currentPage={documentsData.pagination.currentPage} totalPages={documentsData.pagination.totalPages} totalItems={documentsData.pagination.totalItems} onPageChange={setDocumentsPage} />
          )}
        </TabsContent>

        <TabsContent value="meetings" className="space-y-3">
          <DataTable
            headers={[
              { key: 'title', label: 'Meeting' },
              { key: 'date', label: 'Date' },
              { key: 'duration', label: 'Duration' },
              { key: 'status', label: 'Status' },
              { key: 'participants', label: 'Participants' },
            ]}
            data={(meetingsData?.meetings ?? []) as ProjectMeeting[]}
            keyExtractor={(m) => m.id}
            loading={meetingsLoading}
            emptyText="No meetings."
            renderRow={(m: ProjectMeeting) => [
              <div key="title"><p className="font-medium">{m.title}</p><p className="text-xs text-muted-foreground line-clamp-1">{m.notes}</p></div>,
              <span key="date">{formatDate(m.meeting_date)}</span>,
              <span key="duration">{m.duration_minutes ? `${m.duration_minutes} min` : '-'}</span>,
              <StatusBadge key="status" status={m.status} />,
              <span key="participants" className="text-sm">{m.participants || '-'}</span>,
            ]}
          />
          {meetingsData?.pagination && (
            <Pagination currentPage={meetingsData.pagination.currentPage} totalPages={meetingsData.pagination.totalPages} totalItems={meetingsData.pagination.totalItems} onPageChange={setMeetingsPage} />
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof DollarSign; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" /></div>
        </div>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function PersonRow({ icon: Icon, label, value, sub }: { icon: typeof User; label: string; value: string; sub?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0"><Icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" /></div>
      <div className="min-w-0">
        <p className="font-medium truncate">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{sub || label}</p>
      </div>
    </div>
  );
}
