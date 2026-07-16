'use client';

import { useParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchCustomerTicket, reopenCustomerTicket } from '@/lib/api';
import { Ticket } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerTicketDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const id = params.id as string;

  const reopenMutation = useMutation({
    mutationFn: () => reopenCustomerTicket(token!, id),
    onSuccess: (data) => toast.success(data?.message || 'Ticket reopened.'),
    onError: () => toast.error('Failed to reopen ticket.'),
  });

  return (
    <ResourceDetailPage
      title="Ticket"
      icon={Ticket}
      backHref="/customer/tickets"
      titleKey="ticket_number"
      getFn={(t, ticketId) => fetchCustomerTicket(t, ticketId).then((r) => r.data || r)}
      fields={[
        { key: 'ticket_number', label: 'Ticket #', type: 'text', readOnly: true },
        { key: 'subject', label: 'Subject', type: 'text', readOnly: true },
        { key: 'status', label: 'Status', type: 'text', readOnly: true },
        { key: 'priority', label: 'Priority', type: 'text', readOnly: true },
        { key: 'category', label: 'Category', type: 'text', readOnly: true },
        { key: 'source', label: 'Source', type: 'text', readOnly: true },
        { key: 'created_at', label: 'Created', type: 'date', readOnly: true },
      ]}
      actions={[
        { label: 'Reopen', variant: 'outline', onClick: () => reopenMutation.mutate(), disabled: reopenMutation.isPending },
      ]}
    />
  );
}
