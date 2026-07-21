'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createTicket } from '@/lib/api';
import type { Ticket } from '@/types/support';
import { Plus } from 'lucide-react';

const priorities = ['low', 'medium', 'high', 'urgent'];
const statuses = ['open', 'in_progress', 'waiting_customer', 'waiting_staff', 'resolved', 'closed'];
const categories = ['general', 'technical', 'billing', 'sales', 'bug', 'feature_request'];

interface SupportTicketFormProps {
  token: string;
  onSuccess?: (ticket: Ticket) => void;
  onCancel?: () => void;
  initial?: Partial<Ticket>;
}

export function SupportTicketForm({ token, onSuccess, onCancel, initial }: SupportTicketFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<Ticket>>({
    subject: '',
    description: '',
    priority: 'medium',
    status: 'open',
    category: 'general',
    contact_email: '',
    guest_name: '',
    guest_email: '',
    ...initial,
  });

  const mutation = useMutation({
    mutationFn: () => createTicket(token, form),
    onSuccess: (data: any) => {
      toast.success('Ticket created');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      onSuccess?.(data?.ticket ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create ticket'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Subject</Label><Input value={form.subject || ''} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
      <div><Label>Priority</Label>
        <select value={form.priority || 'medium'} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div><Label>Status</Label>
        <select value={form.status || 'open'} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div><Label>Category</Label>
        <select value={form.category || 'general'} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {categories.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div><Label>Contact email</Label><Input type="email" value={form.contact_email || ''} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
      <div><Label>Guest name</Label><Input value={form.guest_name || ''} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} /></div>
      <div><Label>Guest email</Label><Input type="email" value={form.guest_email || ''} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={8} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Ticket
        </Button>
      </div>
    </div>
  );
}
