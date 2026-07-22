'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { fetchCustomerTicket, replyCustomerTicket, reopenCustomerTicket } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Ticket, ArrowLeft, Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerTicketDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const id = String(params.id);
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customer-ticket', id, token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const res = await fetchCustomerTicket(token, id);
      return res.data || res;
    },
    enabled: !!token && !!id,
  });

  const ticket = data as any;

  const replyMutation = useMutation({
    mutationFn: (message: string) => replyCustomerTicket(token!, id, message),
    onSuccess: () => {
      toast.success('Reply sent');
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['customer-ticket', id] });
    },
    onError: () => toast.error('Failed to send reply'),
  });

  const reopenMutation = useMutation({
    mutationFn: () => reopenCustomerTicket(token!, id),
    onSuccess: (res) => toast.success(res?.message || 'Ticket reopened'),
    onError: () => toast.error('Failed to reopen ticket'),
  });

  if (isLoading) {
    return (
      <PageShell title="Ticket" icon={Ticket}>
        <Skeleton className="h-48 rounded-2xl" />
      </PageShell>
    );
  }

  if (!ticket) {
    return (
      <PageShell title="Ticket" icon={Ticket}>
        <p className="text-sm text-muted-foreground">Ticket not found.</p>
      </PageShell>
    );
  }

  const messages = (ticket.messages ?? []).slice().sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <PageShell
      title={`Ticket #${ticket.ticket_number}`}
      icon={Ticket}
      description={ticket.subject}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/tickets"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          {['closed', 'resolved'].includes(ticket.status) && (
            <Button size="sm" onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}>
              Reopen
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground whitespace-pre-line">{ticket.description || 'No description.'}</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {ticket.category && <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{ticket.category}</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span> <span className="capitalize">{ticket.status}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Priority</span> <span className="capitalize">{ticket.priority}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span> <span>{formatDate(ticket.created_at)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Updated</span> <span>{formatDate(ticket.updated_at)}</span></div>
            {ticket.assignee && <div className="flex justify-between"><span className="text-muted-foreground">Assigned To</span> <span>{ticket.assignee.name}</span></div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length > 0 ? (
            <ul className="space-y-4">
              {messages.map((msg: any) => {
                const sender = msg.sender || msg.profiles;
                const name = sender?.name || msg.sender_name || 'Support';
                const isStaff = msg.is_staff_reply || msg.sender_role === 'staff';
                return (
                  <li key={msg.id} className={`flex gap-3 ${isStaff ? '' : 'flex-row-reverse'}`}>
                    <div className="flex-shrink-0">
                      <PersonAvatar name={name} avatar_url={sender?.avatar} size="sm" />
                    </div>
                    <div className={`flex-1 rounded-xl p-3 text-sm ${isStaff ? 'bg-muted' : 'bg-primary/10'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{name}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(msg.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-line">{msg.message}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No replies yet.</p>
          )}

          {!['closed', 'resolved'].includes(ticket.status) && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                rows={3}
              />
              <div className="flex justify-end">
                <Button onClick={() => replyMutation.mutate(replyText.trim())} disabled={!replyText.trim() || replyMutation.isPending} size="sm">
                  <Send className="mr-1 h-4 w-4" /> Send Reply
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
