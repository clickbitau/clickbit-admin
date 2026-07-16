'use client';

import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchCustomerProject } from '@/lib/api';
import { FolderKanban } from 'lucide-react';

export default function CustomerProjectDetailPage() {
  return (
    <ResourceDetailPage
      title="Project"
      icon={FolderKanban}
      backHref="/customer/projects"
      titleKey="project_number"
      getFn={(token, id) => fetchCustomerProject(token, id).then((r) => r.data)}
      fields={[
        { key: 'project_number', label: 'Project #', type: 'text', readOnly: true },
        { key: 'name', label: 'Name', type: 'text', readOnly: true },
        { key: 'status', label: 'Status', type: 'text', readOnly: true },
        { key: 'priority', label: 'Priority', type: 'text', readOnly: true },
        { key: 'budget', label: 'Budget', type: 'number', readOnly: true },
        { key: 'progress_percentage', label: 'Progress %', type: 'number', readOnly: true },
        { key: 'start_date', label: 'Start', type: 'date', readOnly: true },
        { key: 'due_date', label: 'Due', type: 'date', readOnly: true },
        { key: 'description', label: 'Description', type: 'textarea', readOnly: true },
      ]}
    />
  );
}
