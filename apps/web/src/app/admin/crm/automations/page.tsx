'use client';

import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchAutomations } from '@/lib/crm-api';
import type { CrmAutomation } from '@clickbit/shared';

export default function AutomationsPage() {
  return (
    <ResourceListPage<CrmAutomation>
      title="Automations"
      resourceKey="automations"
      fetcher={fetchAutomations as any}
      getRowId={(row) => row.id}
      columns={[
        { key: 'name', header: 'Name' },
        { key: 'trigger_type', header: 'Trigger' },
        { key: 'action_type', header: 'Action' },
        { key: 'is_active', header: 'Active' },
      ]}
    />
  );
}
