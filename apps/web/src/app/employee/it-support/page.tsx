'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { createEmployeeItSupportTicket, fetchMyTickets } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Headset, Info, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function EmployeeItSupportPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const ticketsQuery = useQuery({
    queryKey: ['employee-it-tickets', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchMyTickets(token, { limit: 50 });
    },
    enabled: !!token,
  });

  const mutation = useMutation({
    mutationFn: () => createEmployeeItSupportTicket(token!, { subject, description, priority }),
    onSuccess: () => {
      toast.success('IT support ticket submitted');
      queryClient.invalidateQueries({ queryKey: ['employee-it-tickets'] });
      setSubject('');
      setDescription('');
      setPriority('medium');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to submit ticket'),
  });

  const canSubmit = subject.trim() && description.trim() && token;
  const tickets = ticketsQuery.data?.tickets ?? [];

  return (
    <PageShell title="IT Support" icon={Headset} description="Submit and track internal IT support requests.">
      <Card className="nm-raised">
        <CardContent className="p-4 flex items-start gap-3 text-sm text-muted-foreground">
          <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <p>
            Submit a request below and the support team will pick it up. You can track status here; replies and updates will appear on the ticket detail page.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="nm-raised lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">New IT Support Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Laptop not working" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue in detail" rows={6} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => router.push('/employee/dashboard')}>Cancel</Button>
              <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
                {mutation.isPending ? 'Submitting...' : 'Submit Ticket'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="nm-raised">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Your Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {ticketsQuery.isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-12 nm-raised-sm animate-pulse rounded-lg" />)}
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No tickets submitted yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {tickets.slice(0, 10).map((t: any) => (
                  <li key={t.id} className="py-3">
                    <Link href={`/employee/it-support/${t.id}`} className="block hover:underline">
                      <p className="text-sm font-medium line-clamp-1">{t.ticket_number || t.id} — {t.subject}</p>
                    </Link>
                    <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                      <StatusBadge status={t.status} />
                      <span>{formatDate(t.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
