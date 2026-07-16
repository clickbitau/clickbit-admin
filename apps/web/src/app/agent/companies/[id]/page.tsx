'use client';

import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { api, authHeaders } from '@/lib/api';
import { Building2 } from 'lucide-react';

async function fetchAgentCompany(token: string, id: string) {
  const response = await api.get(`/api/agent/companies/${id}`, { headers: authHeaders(token) });
  return response.data?.data;
}

export default function AgentCompanyDetailPage() {
  return (
    <ResourceDetailPage
      title="Company"
      icon={Building2}
      backHref="/agent/companies"
      titleKey="name"
      getFn={fetchAgentCompany}
      fields={[
        { key: 'name', label: 'Name', type: 'text', readOnly: true },
        { key: 'industry', label: 'Industry', type: 'text', readOnly: true },
        { key: 'website', label: 'Website', type: 'text', readOnly: true },
        { key: 'phone', label: 'Phone', type: 'text', readOnly: true },
        { key: 'email', label: 'Email', type: 'text', readOnly: true },
        { key: 'address', label: 'Address', type: 'textarea', readOnly: true },
        { key: 'status', label: 'Status', type: 'text', readOnly: true },
      ]}
    />
  );
}
