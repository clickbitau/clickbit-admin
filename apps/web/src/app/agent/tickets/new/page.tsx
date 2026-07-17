'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { createAgentPortalTicket, fetchAgentPortalClients } from '@/lib/api';
import { Ticket, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NewAgentTicketPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [contactId, setContactId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const { data, isLoading } = useQuery({
    queryKey: ['agent-clients', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAgentPortalClients(token); },
    enabled: !!token,
  });

  const mutation = useMutation({
    mutationFn: () => createAgentPortalTicket(token!, { contact_id: Number(contactId), subject, description, priority }),
    onSuccess: (res) => { toast.success('Ticket created'); router.push(`/agent/tickets/${res.data.id}`); },
    onError: () => toast.error('Failed to create ticket'),
  });

  const clients = (data?.data?.clients || []) as Array<{ id: number; name: string; email?: string; company?: string }>;

  if (isLoading) {
    return <div className="p-4"><Skeleton className="h-40" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2"><Ticket className="w-7 h-7 text-primary" /> New Ticket</h1>
      <p className="text-muted-foreground mb-6">Create a support ticket on behalf of a client</p>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-background border border-input text-sm"
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''} — {c.email}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ticket subject" />
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-background border border-input text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Describe the issue" />
          </div>

          <Button onClick={() => mutation.mutate()} disabled={!contactId || !subject || mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Create Ticket
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
