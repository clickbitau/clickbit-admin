'use client';

import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchDeals } from '@/lib/crm-api';
import type { Deal } from '@clickbit/shared';

export default function DealsPage() {
  return (
    <ResourceListPage<Deal>
      title="Deals"
      resourceKey="deals"
      fetcher={fetchDeals as any}
      getRowId={(row) => row.id}
      columns={[
        { key: 'deal_number', header: 'Deal #' },
        { key: 'title', header: 'Title' },
        { key: 'value', header: 'Value' },
        { key: 'status', header: 'Status' },
        { key: 'priority', header: 'Priority' },
        { key: 'expected_close_date', header: 'Expected Close' },
      ]}
    />
  );
}
