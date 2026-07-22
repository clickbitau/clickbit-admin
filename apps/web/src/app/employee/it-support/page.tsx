'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { createEmployeeItSupportTicket, fetchMyTickets } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Headset, Info, MessageSquare, Search, Send, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Ticket } from '@clickbit/shared';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

export default function EmployeeItSupportPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const ticketsQuery = useQuery({
    queryKey: ['employee-it-tickets', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchMyTickets(token, { limit: 100 });
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
  const allTickets = useMemo(() => ticketsQuery.data?.tickets ?? [], [ticketsQuery.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = allTickets;
    if (status !== 'all') rows = rows.filter((t) => t.status?.toLowerCase() === status);
    if (q) {
      rows = rows.filter((t) =>
        t.subject.toLowerCase().includes(q) ||
        t.ticket_number.toLowerCase().includes(q) ||
        (t.description?.toLowerCase() || '').includes(q)
      );
    }
    return rows;
  }, [allTickets, status, search]);

  const stats = useMemo(() => {
    return {
      open: allTickets.filter((t) => t.status?.toLowerCase() === 'open').length,
      inProgress: allTickets.filter((t) => t.status?.toLowerCase() === 'in_progress').length,
      resolved: allTickets.filter((t) => ['resolved', 'closed'].includes(t.status?.toLowerCase() || '')).length,
      total: allTickets.length,
    };
  }, [allTickets]);

  return (
    <PageShell
      title="IT Support"
      icon={Headset}
      description="Submit and track internal IT support requests."
      actions={
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={status === s.key ? 'default' : 'outline'}
              onClick={() => setStatus(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      }
    >
      <StatCards
        cards={[
          { label: 'Open', value: stats.open, icon: AlertCircle, accent: 'warning' },
          { label: 'In Progress', value: stats.inProgress, icon: Clock, accent: 'primary' },
          { label: 'Resolved', value: stats.resolved, icon: CheckCircle, accent: 'success' },
          { label: 'Total', value: stats.total, icon: MessageSquare, accent: 'secondary' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="nm-raised lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Send className="h-4 w-4" /> New Request</CardTitle>
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
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue in detail" rows={5} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => router.push('/employee/dashboard')}>Cancel</Button>
              <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
                {mutation.isPending ? 'Submitting...' : 'Submit Ticket'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="nm-raised lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Your Tickets</CardTitle>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ticketsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {search || status !== 'all' ? 'No tickets match your filters.' : 'No tickets submitted yet.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((t: Ticket) => (
                  <Link key={t.id} href={`/employee/it-support/${t.id}`}>
                    <Card className="nm-raised-sm hover:shadow-md transition-all cursor-pointer border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{t.ticket_number} — {t.subject}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{t.description || 'No description'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={t.status} />
                            <PriorityBadge priority={t.priority} />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(t.created_at)}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
