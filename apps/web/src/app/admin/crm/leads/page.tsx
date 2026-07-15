'use client';

import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchLeads } from '@/lib/crm-api';
import type { Lead } from '@clickbit/shared';

export default function LeadsPage() {
  return (
    <ResourceListPage<Lead>
      title="Leads"
      resourceKey="leads"
      fetcher={fetchLeads as any}
      getRowId={(row) => row.id}
      columns={[
        { key: 'title', header: 'Title' },
        { key: 'status', header: 'Status' },
        { key: 'temperature', header: 'Temperature' },
        { key: 'source', header: 'Source' },
        { key: 'value', header: 'Value' },
        { key: 'created_at', header: 'Created' },
      ]}
    />
  );
}
