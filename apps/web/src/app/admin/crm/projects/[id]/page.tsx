'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/design-system/DataTable';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchProject } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { ArrowLeft, Building2, Calendar, DollarSign, Clock } from 'lucide-react';

export default function ProjectDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const id = String(params.id);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(token!, id),
    enabled: !!token && !!id,
  });

  useRealtimeRefresh(['crm_projects', 'project_tasks'], ['project', id], { enabled: !!id });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading project...</div>;
  if (!project) return <div className="p-6 text-sm text-muted-foreground">Project not found.</div>;

  const tasks = project.tasks ?? [];
  const financials = project.financials ?? { totalValue: 0, totalPaid: 0, totalCosts: 0, netProfit: 0 };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/crm/projects"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-muted-foreground">{project.project_number}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <StatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
              {project.company && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {project.company.name}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Budget</p>
            <p className="text-2xl font-semibold">{formatCurrency(Number(project.budget ?? 0))}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4" /> Progress</p><Progress value={project.progress_percentage ?? 0} className="mt-2 h-2" /><p className="mt-1 text-right text-xs">{project.progress_percentage ?? 0}%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="h-4 w-4" /> Revenue</p><p className="mt-1 text-xl font-semibold">{formatCurrency(financials.totalValue)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="h-4 w-4" /> Paid</p><p className="mt-1 text-xl font-semibold">{formatCurrency(financials.totalPaid)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="h-4 w-4" /> Net Profit</p><p className="mt-1 text-xl font-semibold">{formatCurrency(financials.netProfit)}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <DataTable
              headers={[{ key: 'task', label: 'Task' }, { key: 'status', label: 'Status' }, { key: 'assignee', label: 'Assignee' }, { key: 'due', label: 'Due' }]}
              data={tasks}
              keyExtractor={(t) => t.id}
              renderRow={(t) => [
                <div key="task"><p className="font-medium">{t.title}</p><p className="text-xs text-muted-foreground">{t.description}</p></div>,
                <StatusBadge key="status" status={t.status} />,
                <span key="assignee" className="text-sm">{t.assignee ? `${t.assignee.first_name} ${t.assignee.last_name}` : '-'}</span>,
                <span key="due">{formatDate(t.due_date)}</span>,
              ]}
            />
          </TabsContent>

          <TabsContent value="details">
            <Card>
              <CardContent className="space-y-3 py-6 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Description</span> <span>{project.description || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span> <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(project.start_date)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span> <span>{formatDate(project.due_date)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Manager</span> <span>{project.manager ? `${project.manager.first_name} ${project.manager.last_name}` : '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span> <span>{project.customer ? project.customer.name : '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Estimated Hours</span> <span>{project.estimated_hours ?? '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Actual Hours</span> <span>{project.actual_hours ?? '-'}</span></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <DataTable
              headers={[{ key: 'ref', label: 'Reference' }, { key: 'status', label: 'Status' }, { key: 'amount', label: 'Amount' }, { key: 'date', label: 'Date' }]}
              data={(project.invoices as { id: number; package_code?: string; status?: string; total_amount?: number; issue_date?: string }[]) ?? []}
              keyExtractor={(i) => i.id}
              renderRow={(i) => [
                <span key="ref">{i.package_code || `#${i.id}`}</span>,
                <StatusBadge key="status" status={i.status} />,
                <span key="amount">{formatCurrency(Number(i.total_amount ?? 0))}</span>,
                <span key="date">{formatDate(i.issue_date)}</span>,
              ]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
