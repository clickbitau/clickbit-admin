'use client';

import { Handshake } from 'lucide-react';
import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchDeal, updateDeal, deleteDeal } from '@/lib/api';

export default function AdminDealDetailPage() {
  return (
    <ResourceDetailPage
      title="Deal"
      icon={Handshake}
      backHref="/admin/crm/deals"
      titleKey="title"
      getFn={(token, id) => fetchDeal(token, id)}
      updateFn={(token, id, data) => updateDeal(token, Number(id), data)}
      deleteFn={(token, id) => deleteDeal(token, Number(id))}
      fields={[
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'value', label: 'Value', type: 'number' },
        { key: 'currency', label: 'Currency', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: ['open', 'won', 'lost'] },
        { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] },
        { key: 'probability', label: 'Probability', type: 'number' },
        { key: 'expected_close_date', label: 'Expected close date', type: 'date' },
        { key: 'actual_close_date', label: 'Actual close date', type: 'date' },
        { key: 'lead_source', label: 'Lead source', type: 'text' },
        { key: 'position', label: 'Position', type: 'number' },
      ]}
    />
  );
}
