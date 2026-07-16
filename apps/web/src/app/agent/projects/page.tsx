'use client';

import { useRouter } from 'next/navigation';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { api, authHeaders } from '@/lib/api';
import { formatDate } from '@/lib/format';

interface AgentProject {
  id: number;
  name?: string;
  status?: string;
  start_date?: string;
  due_date?: string;
}

async function fetchAgentProjects(token: string, params: { page: number; limit: number; search?: string }) {
  const response = await api.get('/api/agent/projects', { params, headers: authHeaders(token) });
  return response.data;
}

export default function AgentProjectsPage() {
  const router = useRouter();

  return (
    <ResourceListPage<AgentProject>
      title="Projects"
      resourceKey="data"
      fetcher={fetchAgentProjects}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(`/agent/projects/${row.id}`)}
      columns={[
        { key: 'name', header: 'Name', accessor: 'name' },
        { key: 'status', header: 'Status', accessor: 'status' },
        { key: 'start_date', header: 'Start', accessor: 'start_date', cell: (row) => formatDate(row.start_date) },
        { key: 'due_date', header: 'Due', accessor: 'due_date', cell: (row) => formatDate(row.due_date) },
      ]}
    />
  );
}
