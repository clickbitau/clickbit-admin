'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { fetchAgentPortalTicket, replyAgentPortalTicket } from '@/lib/api';
import { Ticket, Clock, Send, User } from 'lucide-react';
import { toast } from 'sonner';

function timeAgo(date?: string | Date) {
  if (!date) return '-';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AgentTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['agent-ticket', token, id],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAgentPortalTicket(token, id); },
    enabled: !!token && !!id,
  });

  const mutation = useMutation({
    mutationFn: () => replyAgentPortalTicket(token!, id, message, isInternal),
    onSuccess: () => {
      toast.success('Reply sent');
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['agent-ticket', token, id] });
    },
    onError: () => toast.error('Failed to send reply'),
  });

  const ticket = data?.data as {
    id?: number; ticket_number?: string; subject?: string; status?: string; priority?: string; contact_email?: string; description?: string; created_at?: string; ticket_messages?: Array<{
      id: number; message: string; sender_type?: string; sender_id?: number; is_internal?: boolean; created_at?: string;
    }>;
  } | undefined;

  if (isLoading) return <div className="p-4"><Skeleton className="h-40" /><Skeleton className="h-64 mt-4" /></div>;
  if (!ticket) return <div className="p-4 text-muted-foreground">Ticket not found.</div>;

  const messages = ticket.ticket_messages || [];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Ticket className="w-7 h-7 text-primary" /> {ticket.subject || `Ticket #${ticket.ticket_number || id}`}</h1>
          <p className="text-muted-foreground mt-1">{ticket.contact_email || 'No contact'} · <Badge variant="outline" className="capitalize">{ticket.status}</Badge> · <Badge variant="outline" className="capitalize">{ticket.priority}</Badge></p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Conversation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No replies yet.</p>
              {ticket.description && <p className="text-sm mt-2 max-w-xl mx-auto">{ticket.description}</p>}
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.sender_type === 'agent' ? 'justify-end' : ''}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.sender_type === 'agent' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none'}`}>
                  <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
                    <User className="w-3 h-3" />
                    {msg.sender_type || 'Customer'}
                    {msg.is_internal && <span className="italic">(internal)</span>}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.message}</div>
                  <div className="text-[10px] opacity-70 mt-1 text-right">{timeAgo(msg.created_at)}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Send className="w-5 h-5" /> Reply</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Type your reply..." />
          <div className="flex items-center gap-2">
            <input id="internal" type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="rounded" />
            <label htmlFor="internal" className="text-sm text-muted-foreground">Internal note (not visible to customer)</label>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!message.trim() || mutation.isPending}>Send Reply</Button>
        </CardContent>
      </Card>
    </div>
  );
}
