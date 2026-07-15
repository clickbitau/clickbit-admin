'use client';

import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchActivities } from '@/lib/crm-api';
import type { CrmActivity } from '@clickbit/shared';

export default function ActivitiesPage() {
  return (
    <ResourceListPage<CrmActivity>
      title="Activities"
      resourceKey="activities"
      fetcher={fetchActivities as any}
      getRowId={(row) => row.id}
      columns={[
        { key: 'activity_type', header: 'Type' },
        { key: 'subject', header: 'Subject' },
        { key: 'status', header: 'Status' },
        { key: 'priority', header: 'Priority' },
        { key: 'due_date', header: 'Due' },
      ]}
    />
  );
}
