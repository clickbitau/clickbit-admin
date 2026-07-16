'use client';

import { useRouter } from 'next/navigation';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { api, authHeaders } from '@/lib/api';

interface AgentCompany {
  id: number;
  name?: string;
  status?: string;
  industry?: string;
}

async function fetchAgentCompanies(token: string, _params: { page: number; limit: number; search?: string }) {
  const response = await api.get('/api/agent/companies', { headers: authHeaders(token) });
  const rows = response.data?.data ?? [];
  return {
    data: rows,
    pagination: { currentPage: 1, totalPages: 1, totalItems: rows.length, itemsPerPage: rows.length },
  };
}

export default function AgentCompaniesPage() {
  const router = useRouter();

  return (
    <ResourceListPage<AgentCompany>
      title="Companies"
      resourceKey="data"
      fetcher={fetchAgentCompanies}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(`/agent/companies/${row.id}`)}
      columns={[
        { key: 'name', header: 'Name', accessor: 'name' },
        { key: 'industry', header: 'Industry', accessor: 'industry' },
        { key: 'status', header: 'Status', accessor: 'status' },
      ]}
    />
  );
}
