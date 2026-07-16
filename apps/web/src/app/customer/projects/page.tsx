'use client';

import { useRouter } from 'next/navigation';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchCustomerProjects } from '@/lib/api';
import type { CrmProject } from '@/types/crm';
import { formatDate } from '@/lib/format';
import { FolderKanban } from 'lucide-react';

export default function CustomerProjectsPage() {
  const router = useRouter();

  return (
    <ResourceListPage<CrmProject>
      title="Projects"
      icon={FolderKanban}
      resourceKey="data"
      fetcher={fetchCustomerProjects}
      getRowId={(row) => row.id}
      columns={[
        { key: 'project_number', header: 'Project #', accessor: 'project_number' },
        { key: 'name', header: 'Name', accessor: 'name' },
        { key: 'status', header: 'Status', accessor: 'status' },
        {
          key: 'progress_percentage',
          header: 'Progress',
          cell: (row) => (row.progress_percentage !== undefined ? `${row.progress_percentage}%` : '-'),
        },
        {
          key: 'due_date',
          header: 'Due',
          cell: (row) => formatDate(row.due_date),
        },
      ]}
      onRowClick={(row) => router.push(`/customer/projects/${row.id}`)}
      searchPlaceholder="Search projects..."
    />
  );
}
