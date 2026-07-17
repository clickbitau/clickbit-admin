'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageShell } from '@/components/design-system/PageShell';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchSubproject } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { CrmSubproject } from '@/types/crm';
import { ArrowLeft, FolderKanban, Calendar, Clock, DollarSign, User, Building2, AlertCircle } from 'lucide-react';

export default function SubprojectDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const { data: subproject, isLoading } = useQuery({
    queryKey: ['subproject', id],
    queryFn: () => fetchSubproject(token!, id),
    enabled: !!token && !!id,
  });

  useRealtimeRefresh(['crm_subprojects'], ['subproject', id], { enabled: !!id });

  if (isLoading) {
    return (
      <PageShell title="Subproject" icon={FolderKanban} description="Loading...">
        <div className="p-6 text-sm text-muted-foreground">Loading subproject...</div>
      </PageShell>
    );
  }

  if (!subproject) {
    return (
      <PageShell title="Subproject" icon={FolderKanban} description="Not found">
        <div className="p-6 text-sm text-muted-foreground">Subproject not found.</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={subproject.name}
      icon={FolderKanban}
      description={`Subproject · ${subproject.status?.replace(/_/g, ' ')}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/crm/projects/${subproject.parent_project_id}`}><ArrowLeft className="mr-1 h-4 w-4" /> Back to project</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/admin/crm/projects/${subproject.parent_project_id}`}>View parent</Link>
          </Button>
        </div>
      }
    >
      <SubprojectContent subproject={subproject} />
    </PageShell>
  );
}

function SubprojectContent({ subproject }: { subproject: CrmSubproject }) {
  const router = useRouter();
  const isOverdue = subproject.due_date && new Date(subproject.due_date) < new Date() && subproject.status !== 'completed' && subproject.status !== 'cancelled';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Budget</p><p className="text-xl font-bold">{formatCurrency(Number(subproject.budget ?? 0))}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Actual Cost</p><p className="text-xl font-bold">{formatCurrency(Number(subproject.actual_cost ?? 0))}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Progress</p><p className="text-xl font-bold">{subproject.progress_percentage ?? 0}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Tasks</p><p className="text-xl font-bold">{subproject.completed_task_count ?? 0}/{subproject.task_count ?? 0}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4" /> Progress</span>
              <span className="text-sm font-semibold">{subproject.progress_percentage ?? 0}%</span>
            </div>
            <Progress value={subproject.progress_percentage ?? 0} className="h-2" />
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={subproject.status} />
              <PriorityBadge priority={subproject.priority} />
              {isOverdue && <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"><AlertCircle className="h-3.5 w-3.5" /> Overdue</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Start</span><span>{formatDate(subproject.start_date)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Due</span><span className={isOverdue ? 'text-red-600 font-medium' : ''}>{formatDate(subproject.due_date)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Completed</span><span>{formatDate(subproject.completed_date)}</span></div>
            {subproject.support_period_type && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Support</p>
                <p className="text-xs">{subproject.support_period_type} {subproject.support_price ? `· ${formatCurrency(Number(subproject.support_price))}` : ''}</p>
                <p className="text-xs text-muted-foreground">{formatDate(subproject.support_start_date)} - {formatDate(subproject.support_end_date)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>About</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground whitespace-pre-line">{subproject.description || 'No description.'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-between"><span className="text-muted-foreground">Estimated Hours</span><span>{subproject.estimated_hours ?? '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Actual Hours</span><span>{subproject.actual_hours ?? '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Hourly Rate</span><span>{subproject.hourly_rate ? formatCurrency(Number(subproject.hourly_rate)) : '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span>{subproject.currency || '-'}</span></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>People</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><User className="h-4 w-4 text-gray-600 dark:text-gray-300" /></div>
              <div>
                <p className="font-medium">{subproject.manager ? `${subproject.manager.first_name} ${subproject.manager.last_name}` : '-'}</p>
                <p className="text-xs text-muted-foreground">Manager</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Building2 className="h-4 w-4 text-gray-600 dark:text-gray-300" /></div>
              <div>
                <p className="font-medium">Parent Project</p>
                <Button variant="link" className="h-auto p-0 text-sm" onClick={() => router.push(`/admin/crm/projects/${subproject.parent_project_id}`)}>
                  View project #{subproject.parent_project_id}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
