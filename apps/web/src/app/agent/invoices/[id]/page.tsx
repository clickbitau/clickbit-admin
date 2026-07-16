'use client';

import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { api, authHeaders } from '@/lib/api';
import { Receipt } from 'lucide-react';

async function fetchAgentInvoice(token: string, id: string) {
  const response = await api.get(`/api/agent/invoices/${id}`, { headers: authHeaders(token) });
  return response.data?.data;
}

export default function AgentInvoiceDetailPage() {
  return (
    <ResourceDetailPage
      title="Invoice"
      icon={Receipt}
      backHref="/agent/invoices"
      titleKey="package_code"
      getFn={fetchAgentInvoice}
      fields={[
        { key: 'title', label: 'Title', type: 'text', readOnly: true },
        { key: 'status', label: 'Status', type: 'text', readOnly: true },
        { key: 'total_amount', label: 'Total', type: 'number', readOnly: true },
        { key: 'amount_paid', label: 'Amount Paid', type: 'number', readOnly: true },
        { key: 'issue_date', label: 'Issue Date', type: 'date', readOnly: true },
        { key: 'due_date', label: 'Due Date', type: 'date', readOnly: true },
        { key: 'description', label: 'Description', type: 'textarea', readOnly: true },
      ]}
    />
  );
}
