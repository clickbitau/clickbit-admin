'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api, authHeaders } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Ticket } from 'lucide-react';
import { toast } from 'sonner';

interface TicketMessage {
  id: number;
  sender_type?: string;
  message?: string;
  created_at?: string;
}

async function fetchAgentTicket(token: string, id: string) {
  const response = await api.get(`/api/agent/tickets/${id}`, { headers: authHeaders(token) });
  return response.data?.data;
}

export default function AgentTicketDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReply = async () => {
    if (!reply.trim() || !token) return;
    setSubmitting(true);
    try {
      await api.post(`/api/agent/tickets/${id}/reply`, { message: reply }, { headers: authHeaders(token) });
      toast.success('Reply sent');
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['ticket', token, String(id)] });
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResourceDetailPage
      title="Ticket"
      icon={Ticket}
      backHref="/agent/tickets"
      titleKey="ticket_number"
      getFn={fetchAgentTicket}
      fields={[
        { key: 'subject', label: 'Subject', type: 'text', readOnly: true },
        { key: 'status', label: 'Status', type: 'text', readOnly: true },
        { key: 'priority', label: 'Priority', type: 'text', readOnly: true },
        { key: 'contact_email', label: 'Contact Email', type: 'text', readOnly: true },
        { key: 'created_at', label: 'Created', type: 'date', readOnly: true },
        { key: 'description', label: 'Description', type: 'textarea', readOnly: true },
      ]}
      extraReadOnly={(data: any) => {
        const messages: TicketMessage[] = data?.ticket_messages ?? [];
        return (
          <div className="space-y-4 md:col-span-2 mt-4">
            <h3 className="font-semibold">Messages</h3>
            {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            <div className="space-y-3">
              {messages.map((msg: TicketMessage) => (
                <div key={msg.id} className="p-3 rounded-xl nm-inset-sm text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium capitalize">{msg.sender_type || 'Agent'}</span>
                    <span className="text-muted-foreground text-xs">{formatDate(msg.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply..."
                rows={3}
              />
              <Button onClick={handleReply} disabled={submitting || !reply.trim()}>
                {submitting ? 'Sending...' : 'Send Reply'}
              </Button>
            </div>
          </div>
        );
      }}
    />
  );
}
