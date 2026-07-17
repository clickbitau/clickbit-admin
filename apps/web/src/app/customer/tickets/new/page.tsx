'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { createTicket } from '@/lib/api';
import { ArrowLeft, Plus, Ticket } from 'lucide-react';

const categories = ['general', 'technical', 'billing', 'sales', 'feature_request', 'bug_report', 'account', 'other'];
const priorities = ['low', 'medium', 'high', 'urgent'];

export default function CustomerNewTicketPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<Record<string, any>>({
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium',
  });

  const mutation = useMutation({
    mutationFn: () => createTicket(token!, form),
    onSuccess: () => {
      toast.success('Ticket submitted');
      router.push('/customer/tickets');
    },
    onError: () => toast.error('Failed to submit ticket'),
  });

  return (
    <PageShell
      title="New Ticket"
      icon={Ticket}
      description="Submit a support request"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/customer/tickets"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Support Request</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Category</Label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {categories.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><Label>Priority</Label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} /></div>
          <div>
            <Button onClick={() => form.subject && form.description && mutation.mutate()} disabled={mutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Submit Ticket
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
