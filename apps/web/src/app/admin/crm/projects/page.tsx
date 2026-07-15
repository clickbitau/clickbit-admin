'use client';

import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchProjects } from '@/lib/crm-api';
import type { CrmProject } from '@clickbit/shared';

export default function ProjectsPage() {
  return (
    <ResourceListPage<CrmProject>
      title="Projects"
      resourceKey="projects"
      fetcher={fetchProjects as any}
      getRowId={(row) => row.id}
      columns={[
        { key: 'project_number', header: 'Project #' },
        { key: 'name', header: 'Name' },
        { key: 'status', header: 'Status' },
        { key: 'progress_percentage', header: 'Progress %' },
        { key: 'budget', header: 'Budget' },
        { key: 'due_date', header: 'Due' },
      ]}
    />
  );
}
