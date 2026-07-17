'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { fetchEmployeeTasks } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { ListTodo } from 'lucide-react';

const STATUS_OPTIONS = ['all', 'todo', 'in_progress', 'review', 'completed', 'on_hold'];

export default function EmployeeTasksPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['employee-tasks', token, page, status],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployeeTasks(token, { page, limit, status: status === 'all' ? undefined : status });
    },
    enabled: !!token,
  });

  return (
    <PageShell
      title="My Tasks"
      icon={ListTodo}
      description="Tasks assigned to you across projects."
    >
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
              status === s ? 'nm-raised-sm bg-primary/10 text-primary' : 'text-muted-foreground hover:nm-raised-sm'
            }`}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <DataTable
        headers={[
          { key: 'title', label: 'Task' },
          { key: 'project', label: 'Project' },
          { key: 'status', label: 'Status' },
          { key: 'priority', label: 'Priority' },
          { key: 'due', label: 'Due' },
        ]}
        data={data?.data ?? []}
        keyExtractor={(t) => t.id}
        loading={isLoading}
        emptyText="No tasks found."
        onRowClick={(t) => router.push(`/employee/tasks/${t.id}`)}
        renderRow={(t: any) => [
          <div key="title">
            <p className="font-medium">{t.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
          </div>,
          <span key="project" className="text-sm">{t.crm_projects?.name || '-'}</span>,
          <StatusBadge key="status" status={t.status} />,
          <PriorityBadge key="priority" priority={t.priority} />,
          <span key="due">{formatDate(t.due_date)}</span>,
        ]}
      />
      {data?.pagination && (
        <Pagination
          currentPage={data.pagination.currentPage}
          totalPages={data.pagination.totalPages}
          totalItems={data.pagination.totalItems}
          onPageChange={setPage}
        />
      )}
    </PageShell>
  );
}
