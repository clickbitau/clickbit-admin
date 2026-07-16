'use client';

import { useRouter } from 'next/navigation';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchCustomerTasks } from '@/lib/api';
import type { ProjectTask } from '@/types/crm';
import { formatDate } from '@/lib/format';
import { ListTodo } from 'lucide-react';

export default function CustomerTasksPage() {
  const router = useRouter();

  return (
    <ResourceListPage<ProjectTask>
      title="Tasks"
      icon={ListTodo}
      resourceKey="data"
      fetcher={fetchCustomerTasks}
      getRowId={(row) => row.id}
      columns={[
        { key: 'title', header: 'Title', accessor: 'title' },
        { key: 'status', header: 'Status', accessor: 'status' },
        { key: 'priority', header: 'Priority', accessor: 'priority' },
        {
          key: 'due_date',
          header: 'Due',
          cell: (row) => formatDate(row.due_date),
        },
        {
          key: 'completed_at',
          header: 'Completed',
          cell: (row) => formatDate(row.completed_at),
        },
      ]}
      onRowClick={(row) => router.push(`/customer/tasks/${row.id}`)}
      searchPlaceholder="Search tasks..."
    />
  );
}
