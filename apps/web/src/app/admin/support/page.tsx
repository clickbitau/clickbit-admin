'use client';
import { Ticket as TicketIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchTickets, fetchTicketStats } from '@/lib/api';
import type { Ticket, TicketStats } from '@/types/support';

const statusOptions = ['all', 'open', 'in_progress', 'waiting_customer', 'waiting_staff', 'resolved', 'closed', 'open_all'];
const priorityOptions = ['all', 'low', 'medium', 'high', 'urgent'];

export default function AdminSupportPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('open_all');
  const [priority, setPriority] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets', token, page, status, priority, search],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { page, limit: 20 };
      if (status !== 'all') params.status = status;
      if (priority !== 'all') params.priority = priority;
      if (search) params.search = search;
      return fetchTickets(token, params);
    },
    enabled: !!token,
  });

  const { data: stats } = useQuery<TicketStats>({
    queryKey: ['ticket-stats', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTicketStats(token);
    },
    enabled: !!token,
  });

  const tickets = data?.tickets ?? [];
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 20 };

  return (
    <PageShell
      title="Support Tickets"
      icon={TicketIcon}
      description="Track, assign and respond to customer tickets."
    >

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Open" value={stats?.overview?.open ?? 0} loading={!stats} />
        <StatCard title="Unassigned" value={stats?.overview?.unassigned ?? 0} loading={!stats} />
        <StatCard title="Overdue" value={stats?.overview?.overdue ?? 0} loading={!stats} />
        <StatCard title="Total" value={stats?.overview?.total ?? 0} loading={!stats} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search tickets..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border bg-background px-3 py-2 text-sm">
          {statusOptions.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="rounded-md border bg-background px-3 py-2 text-sm">
          {priorityOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <Button variant="outline" asChild>
          <Link href="/admin/support/automation">Automation</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-destructive">Failed to load tickets.</div> : <TicketList tickets={tickets} loading={isLoading} />}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} total)</p>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </PageShell>
  );
}

function StatCard({ title, value, loading }: { title: string; value: number; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>{loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{value}</div>}</CardContent>
    </Card>
  );
}

function TicketList({ tickets, loading }: { tickets: Ticket[]; loading: boolean }) {
  if (loading) return <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>;
  if (!tickets.length) return <div className="text-muted-foreground">No tickets found.</div>;
  return (
    <div className="divide-y">
      {tickets.map((t) => (
        <div key={t.id} className="flex items-center justify-between py-3">
          <div className="space-y-1">
            <Link href={`/admin/support/${t.id}`} className="font-medium hover:underline">
              {t.ticket_number}: {t.subject}
            </Link>
            <div className="text-sm text-muted-foreground">{t.contact_email || 'Guest'} &middot; {t.user ? `${t.user.first_name} ${t.user.last_name}` : t.guest_name || 'Unknown'}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t.status}</Badge>
            <Badge variant={t.priority === 'urgent' ? 'destructive' : t.priority === 'high' ? 'default' : 'secondary'}>{t.priority}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}