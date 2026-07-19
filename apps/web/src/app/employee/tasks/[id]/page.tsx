'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { fetchEmployeeTask } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { ListTodo, ArrowLeft } from 'lucide-react';

export default function EmployeeTaskDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const id = String(params.id);

  const { data, isLoading } = useQuery({
    queryKey: ['employee-task', id, token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployeeTask(token, id);
    },
    enabled: !!token && !!id,
  });

  const task = data?.data;

  if (isLoading) {
    return (
      <PageShell title="Task" icon={ListTodo}>
        <Skeleton className="h-40 rounded-2xl" />
      </PageShell>
    );
  }

  if (!task) {
    return (
      <PageShell title="Task" icon={ListTodo}>
        <p className="text-sm text-muted-foreground">Task not found.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={task.title}
      icon={ListTodo}
      description={`Task #${task.id}`}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/employee/tasks"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="nm-raised lg:col-span-2">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground whitespace-pre-line">{task.description || 'No description.'}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-between"><span className="text-muted-foreground">Project</span> <span>{task.crm_projects?.name || '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Project #</span> <span>{task.crm_projects?.project_number || '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Start</span> <span>{formatDate(task.start_date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Due</span> <span>{formatDate(task.due_date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Estimated Hours</span> <span>{task.estimated_hours ?? '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Actual Hours</span> <span>{task.actual_hours ?? '-'}</span></div>
            </div>
          </CardContent>
        </Card>
        <Card className="nm-raised">
          <CardHeader><CardTitle>People</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Assigned to</span> <span>{task.assigned_to ? `User ${task.assigned_to}` : '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Customer visible</span> <span>{task.customer_visible ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span> <span>{formatDate(task.created_at)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Updated</span> <span>{formatDate(task.updated_at)}</span></div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
