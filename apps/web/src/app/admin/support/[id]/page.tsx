'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchTicket, updateTicket, replyToTicket, deleteTicket, fetchSupportStaff } from '@/lib/api';
import type { Ticket, TicketMessage, SupportStaff } from '@/types/support';

const statuses = ['open', 'in_progress', 'waiting_customer', 'waiting_staff', 'resolved', 'closed'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const categories = ['general', 'technical', 'billing', 'sales', 'feature_request', 'bug_report', 'account', 'other'];

export default function AdminTicketDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const { data: ticket, isLoading, error } = useQuery<Ticket>({
    queryKey: ['ticket', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTicket(token, id);
    },
    enabled: !!token && !!id,
  });

  const { data: staff } = useQuery<SupportStaff[]>({
    queryKey: ['support-staff', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchSupportStaff(token);
    },
    enabled: !!token,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Ticket>) => updateTicket(token!, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', token, id] }),
  });

  const replyMutation = useMutation({
    mutationFn: (data: { message: string; is_internal: boolean }) => replyToTicket(token!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', token, id] });
      setReply('');
      setIsInternal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTicket(token!, id),
    onSuccess: () => router.push('/admin/support'),
  });

  if (error) return <div className="p-6 text-destructive">Failed to load ticket.</div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {isLoading || !ticket ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{ticket.ticket_number}: {ticket.subject}</CardTitle>
                  <p className="text-sm text-muted-foreground">{ticket.contact_email || 'Guest'} &middot; {ticket.category} &middot; created {new Date(ticket.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{ticket.status}</Badge>
                  <Badge variant={ticket.priority === 'urgent' ? 'destructive' : ticket.priority === 'high' ? 'default' : 'secondary'}>{ticket.priority}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select value={ticket.status} onChange={(e) => updateMutation.mutate({ status: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                    {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <select value={ticket.priority} onChange={(e) => updateMutation.mutate({ priority: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                    {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select value={ticket.category} onChange={(e) => updateMutation.mutate({ category: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Assigned to</label>
                <select
                  value={ticket.assigned_to ?? ''}
                  onChange={(e) => updateMutation.mutate({ assigned_to: e.target.value ? Number(e.target.value) : null })}
                  className="mt-1 w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {staff?.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.email})</option>)}
                </select>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold">Description</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{ticket.description}</p>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Messages</h3>
                {(ticket.messages ?? []).map((msg) => <Message key={msg.id} message={msg} />)}
              </div>

              <div className="space-y-2">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply..." rows={4} />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="h-4 w-4" />
                    Internal note
                  </label>
                  <Button disabled={!reply.trim() || replyMutation.isPending} onClick={() => replyMutation.mutate({ message: reply, is_internal: isInternal })}>Send</Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>Delete ticket</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Message({ message }: { message: TicketMessage }) {
  const sender = message.sender ? `${message.sender.first_name} ${message.sender.last_name}` : (message.sender_name || 'Unknown');
  return (
    <div className={`rounded-lg border p-4 ${message.is_internal ? 'bg-muted' : 'bg-card'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{sender} {message.is_staff_reply ? '(staff)' : ''}</span>
        <span className="text-xs text-muted-foreground">{new Date(message.created_at).toLocaleString()}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{message.message}</p>
      {message.is_internal && <Badge variant="outline" className="mt-2">Internal</Badge>}
    </div>
  );
}
