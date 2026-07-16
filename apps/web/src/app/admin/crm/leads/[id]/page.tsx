'use client';

import { Target } from 'lucide-react';
import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchLead, updateLead, deleteLead } from '@/lib/api';

export default function AdminLeadDetailPage() {
  return (
    <ResourceDetailPage
      title="Lead"
      icon={Target}
      backHref="/admin/crm/leads"
      titleKey="name"
      getFn={(token, id) => fetchLead(token, id)}
      updateFn={(token, id, data) => updateLead(token, Number(id), data)}
      deleteFn={(token, id) => deleteLead(token, Number(id))}
      fields={[
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: ['open', 'won', 'lost'] },
        { key: 'estimated_value', label: 'Estimated value', type: 'number' },
        { key: 'lead_score', label: 'Lead score', type: 'number' },
        { key: 'lead_source', label: 'Lead source', type: 'text' },
        { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] },
        { key: 'position', label: 'Position', type: 'number' },
      ]}
    />
  );
}
