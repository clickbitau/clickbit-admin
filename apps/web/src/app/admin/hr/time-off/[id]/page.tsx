'use client';

import { Calendar } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchTimeOffRequest, approveTimeOff, rejectTimeOff } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminTimeOffDetailPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const approve = useMutation({
    mutationFn: ({ id }: { id: string }) => approveTimeOff(token!, id),
    onSuccess: () => {
      toast.success('Time-off request approved');
      queryClient.invalidateQueries({ queryKey: ['time off request', token] });
    },
    onError: () => toast.error('Failed to approve request'),
  });

  const reject = useMutation({
    mutationFn: ({ id }: { id: string }) => rejectTimeOff(token!, id),
    onSuccess: () => {
      toast.success('Time-off request rejected');
      queryClient.invalidateQueries({ queryKey: ['time off request', token] });
    },
    onError: () => toast.error('Failed to reject request'),
  });

  return (
    <ResourceDetailPage
      title="Time off request"
      icon={Calendar}
      backHref="/admin/hr/time-off"
      titleKey="request_number"
      getFn={async (t, id) => {
        const response = await fetchTimeOffRequest(t, id);
        return response.data;
      }}
      fields={[
        { key: 'request_number', label: 'Request number', type: 'text', readOnly: true },
        { key: 'leave_type', label: 'Leave type', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: ['pending', 'approved', 'rejected', 'cancelled', 'revoked'] },
        { key: 'start_date', label: 'Start date', type: 'date' },
        { key: 'end_date', label: 'End date', type: 'date' },
        { key: 'total_days', label: 'Total days', type: 'number', readOnly: true },
        { key: 'reason', label: 'Reason', type: 'textarea' },
      ]}
      actions={[
        { label: 'Approve', variant: 'default', onClick: () => { const match = window.location.pathname.match(/\/(\d+)(?:\/|$)/); if (match) approve.mutate({ id: match[1] }); } },
        { label: 'Reject', variant: 'secondary', onClick: () => { const match = window.location.pathname.match(/\/(\d+)(?:\/|$)/); if (match) reject.mutate({ id: match[1] }); } },
      ]}
    />
  );
}
