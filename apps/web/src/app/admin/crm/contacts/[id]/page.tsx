'use client';

import { User } from 'lucide-react';
import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchContact, updateContact, deleteContact } from '@/lib/api';

export default function AdminContactDetailPage() {
  return (
    <ResourceDetailPage
      title="Contact"
      icon={User}
      backHref="/admin/crm/contacts"
      titleKey="name"
      getFn={(token, id) => fetchContact(token, id)}
      updateFn={(token, id, data) => updateContact(token, Number(id), data)}
      deleteFn={(token, id) => deleteContact(token, Number(id))}
      fields={[
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'text' },
        { key: 'company', label: 'Company', type: 'text' },
        { key: 'lifecycle_stage', label: 'Lifecycle stage', type: 'select', options: ['lead', 'opportunity', 'customer', 'churned'] },
        { key: 'lead_status', label: 'Lead status', type: 'select', options: ['new', 'contacted', 'qualified', 'unqualified', 'nurturing'] },
        { key: 'lead_score', label: 'Lead score', type: 'number' },
        { key: 'contact_type', label: 'Contact type', type: 'select', options: ['prospect', 'customer', 'partner', 'supplier', 'employee'] },
        { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'archived'] },
        { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high'] },
        { key: 'source', label: 'Source', type: 'text' },
        { key: 'commission_type', label: 'Commission type', type: 'select', options: ['none', 'percentage', 'fixed_amount'] },
        { key: 'commission_rate', label: 'Commission rate', type: 'number' },
      ]}
    />
  );
}
