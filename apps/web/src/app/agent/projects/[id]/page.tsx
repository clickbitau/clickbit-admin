'use client';

import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { api, authHeaders } from '@/lib/api';
import { FolderKanban } from 'lucide-react';

async function fetchAgentProject(token: string, id: string) {
  const response = await api.get(`/api/agent/projects/${id}`, { headers: authHeaders(token) });
  return response.data?.data;
}

export default function AgentProjectDetailPage() {
  return (
    <ResourceDetailPage
      title="Project"
      icon={FolderKanban}
      backHref="/agent/projects"
      titleKey="name"
      getFn={fetchAgentProject}
      fields={[
        { key: 'name', label: 'Name', type: 'text', readOnly: true },
        { key: 'status', label: 'Status', type: 'text', readOnly: true },
        { key: 'start_date', label: 'Start Date', type: 'date', readOnly: true },
        { key: 'due_date', label: 'Due Date', type: 'date', readOnly: true },
        { key: 'description', label: 'Description', type: 'textarea', readOnly: true },
      ]}
    />
  );
}
