'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, authHeaders } from '@/lib/api';
import { Plus, Ticket } from 'lucide-react';
import { toast } from 'sonner';

interface AgentClient {
  id: number;
  name?: string;
  email?: string;
}

async function fetchAgentClients(token: string) {
  const response = await api.get('/api/agent/clients', { headers: authHeaders(token) });
  return (response.data?.data ?? []) as AgentClient[];
}

export default function AgentNewTicketPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [contactId, setContactId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);

  const { data: clients, isLoading } = useQuery({
    queryKey: ['agent-clients', token],
    queryFn: () => fetchAgentClients(token!),
    enabled: !!token,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId || !subject || !token) return;
    setSubmitting(true);
    try {
      const response = await api.post(
        '/api/agent/tickets',
        { contact_id: Number(contactId), title: subject, subject, description, priority },
        { headers: authHeaders(token) },
      );
      toast.success('Ticket created');
      router.push(`/agent/tickets/${response.data?.data?.id}`);
    } catch {
      toast.error('Failed to create ticket');
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="New Ticket" icon={Plus} description="Create a ticket on behalf of a client">
      <form onSubmit={handleSubmit} className="max-w-xl space-y-4 nm-raised p-4 rounded-2xl">
        <div className="space-y-2">
          <Label htmlFor="client">Client</Label>
          <select
            id="client"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            disabled={isLoading}
            required
          >
            <option value="">Select a client</option>
            {(clients ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name || client.email || `Client ${client.id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting || !contactId || !subject}>
            <Ticket className="mr-2 h-4 w-4" />
            {submitting ? 'Creating...' : 'Create Ticket'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/agent/tickets')}>
            Cancel
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
