'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { fetchCustomerTicket, replyCustomerTicket } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Headset, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function EmployeeItSupportDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['employee-it-ticket', token, id],
    queryFn: async () => {
      if (!token || !id) throw new Error('Missing');
      return fetchCustomerTicket(token, id);
    },
    enabled: !!token && !!id,
  });

  const replyMutation = useMutation({
    mutationFn: () => replyCustomerTicket(token!, id, reply),
    onSuccess: () => {
      toast.success('Reply sent');
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['employee-it-ticket', token, id] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to send reply'),
  });

  const ticket = data?.ticket ?? data ?? {};
  const messages = ticket.ticket_messages || [];

  return (
    <PageShell
      title={ticket.subject || 'IT Support Ticket'}
      icon={Headset}
      description={`${ticket.ticket_number || `#${id}`} · Opened ${ticket.created_at ? formatDate(ticket.created_at) : ''}`}
      actions={
        <Button variant="outline" size="sm" onClick={() => router.push('/employee/it-support')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
      }
    >
      {isLoading ? (
        <Card className="nm-raised h-32 animate-pulse" />
      ) : (
        <>
          <Card className="nm-raised">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <StatusBadge status={ticket.status} /> {ticket.subject}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Priority</span> <StatusBadge status={ticket.priority} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Category</span> <span>{ticket.category || 'IT Support'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Last activity</span> <span>{formatDate(ticket.last_activity_at)}</span></div>
              <div className="pt-2 border-t border-border/50"><p className="text-muted-foreground">Description</p><p className="mt-1">{ticket.description || 'No description.'}</p></div>
            </CardContent>
          </Card>

          <Card className="nm-raised">
            <CardHeader>
              <CardTitle className="text-base">Replies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No replies yet.</p>
              ) : (
                messages.map((m: any) => (
                  <div key={m.id} className={`p-3 rounded-xl nm-raised-sm text-sm ${m.is_staff_reply ? 'border-l-4 border-primary' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{m.sender_name || 'Support'}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{m.message}</p>
                  </div>
                ))
              )}
              {ticket.status !== 'closed' && (
                <div className="flex gap-2 pt-2">
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Add a reply..." rows={3} />
                  <Button onClick={() => replyMutation.mutate()} disabled={!reply.trim() || replyMutation.isPending} className="self-end">
                    Send
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
