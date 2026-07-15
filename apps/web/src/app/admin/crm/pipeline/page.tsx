'use client';

import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchPipelines } from '@/lib/crm-api';
import type { Pipeline } from '@clickbit/shared';

export default function PipelinePage() {
  return (
    <ResourceListPage<Pipeline>
      title="Pipelines"
      resourceKey="pipelines"
      fetcher={fetchPipelines as any}
      getRowId={(row) => row.id}
      columns={[
        { key: 'name', header: 'Name' },
        { key: 'description', header: 'Description' },
        { key: 'pipeline_type', header: 'Type' },
        { key: 'is_active', header: 'Active' },
        { key: 'is_default', header: 'Default' },
      ]}
    />
  );
}
