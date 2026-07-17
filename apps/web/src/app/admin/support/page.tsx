'use client';
import { Ticket as TicketIcon, Clock, MessageSquare, AlertTriangle, CheckCircle, Users, Tag, AlertCircle, Plus } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchTickets, fetchTicketStats, fetchSupportStaff } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Ticket, TicketStats, SupportStaff } from '@/types/support';

const statusOptions = ['all', 'open', 'in_progress', 'waiting_customer', 'waiting_staff', 'resolved', 'closed', 'open_all'];
const priorityOptions = ['all', 'low', 'medium', 'high', 'urgent'];

export default function AdminSupportPage() {
  const { token } = useAuth();
  const router = useRouter();
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

  const { data: stats, isLoading: statsLoading } = useQuery<TicketStats>({
    queryKey: ['ticket-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchTicketStats(token); },
    enabled: !!token,
  });

  const { data: staff } = useQuery<SupportStaff[]>({
    queryKey: ['support-staff', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchSupportStaff(token); },
    enabled: !!token,
  });

  const tickets = data?.tickets ?? [];
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 20 };

  const overviewCards = stats ? [
    { label: 'Open', value: stats.overview.open, icon: TicketIcon, accent: 'warning' as const, onClick: () => { setStatus('open_all'); setPage(1); } },
    { label: 'Unassigned', value: stats.overview.unassigned, icon: AlertTriangle, accent: 'destructive' as const, onClick: () => { setStatus('open'); setPage(1); } },
    { label: 'Overdue', value: stats.overview.overdue, icon: AlertCircle, accent: 'destructive' as const, onClick: () => { setStatus('open'); setPage(1); } },
    { label: 'Resolved', value: stats.overview.resolvedThisPeriod, icon: CheckCircle, accent: 'success' as const },
  ] : [];

  const performanceCards = stats ? [
    { label: 'Avg First Response', value: stats.performance.avgFirstResponseHours !== null ? `${Number(stats.performance.avgFirstResponseHours).toFixed(1)}h` : '—', icon: Clock },
    { label: 'Avg Resolution', value: stats.performance.avgResolutionHours !== null ? `${Number(stats.performance.avgResolutionHours).toFixed(1)}h` : '—', icon: Clock },
    { label: 'Satisfaction', value: stats.performance.avgSatisfactionRating !== null ? `${Number(stats.performance.avgSatisfactionRating).toFixed(1)} / 5` : '—', icon: MessageSquare },
    { label: 'Total Ratings', value: stats.performance.totalRatings, icon: Users },
  ] : [];

  return (
    <PageShell
      title="Support Tickets"
      icon={TicketIcon}
      description="Track, assign and respond to customer tickets."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href="/admin/support/automation">Automation</Link></Button>
          <Button asChild><Link href="/admin/support/new"><Plus className="mr-1 h-4 w-4" /> New Ticket</Link></Button>
        </div>
      }
    >
      {error ? (
        <div className="text-destructive">Failed to load tickets.</div>
      ) : (
        <>
          <StatCards cards={overviewCards.map((c) => ({ ...c, value: statsLoading ? '...' : c.value }))} />

          <div className="grid gap-6 lg:grid-cols-3">
            <DashboardCard title="By Status" icon={Tag} isLoading={statsLoading}>
              {stats && <BreakdownList items={Object.entries(stats.byStatus).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v }))} />}
            </DashboardCard>

            <DashboardCard title="By Priority" icon={AlertTriangle} isLoading={statsLoading}>
              {stats && <BreakdownList items={Object.entries(stats.byPriority).map(([k, v]) => ({ label: k, value: v }))} />}
            </DashboardCard>

            <DashboardCard title="By Category" icon={Tag} isLoading={statsLoading}>
              {stats && <BreakdownList items={Object.entries(stats.byCategory).map(([k, v]) => ({ label: k || 'Uncategorized', value: v }))} />}
            </DashboardCard>
          </div>

          <StatCards cards={performanceCards.map((c) => ({ ...c, value: statsLoading ? '...' : c.value }))} />

          {staff && staff.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Assignee Workload</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                  {staff.map((s) => (
                    <div key={s.id} className="rounded border p-3 text-sm">
                      <p className="font-medium truncate">{`${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email}</p>
                      <p className="text-muted-foreground text-xs truncate">{s.role}</p>
                      <p className="mt-1 font-semibold">{s.open_tickets_count} open</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-3">
            <Input placeholder="Search tickets..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border bg-background px-3 py-2 text-sm">
              {statusOptions.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
            </select>
            <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="rounded-md border bg-background px-3 py-2 text-sm">
              {priorityOptions.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>

          <Card>
            <CardHeader><CardTitle>Tickets</CardTitle></CardHeader>
            <CardContent>
              <TicketList tickets={tickets} loading={isLoading} onRowClick={(t) => router.push(`/admin/support/${t.id}`)} />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} total)</p>
            <div className="space-x-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}

function DashboardCard({ title, icon: Icon, isLoading, children }: { title: string; icon: any; isLoading?: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">{Icon && <Icon className="h-4 w-4" />} {title}</CardTitle>
      </CardHeader>
      <CardContent>{isLoading ? <Skeleton className="h-20 w-full" /> : children}</CardContent>
    </Card>
  );
}

function BreakdownList({ items }: { items: { label: string; value: number }[] }) {
  return (
    <div className="space-y-1 text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex justify-between">
          <span className="text-muted-foreground capitalize">{item.label}</span>
          <span className="font-medium">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function TicketList({ tickets, loading, onRowClick }: { tickets: Ticket[]; loading: boolean; onRowClick?: (t: Ticket) => void }) {
  if (loading) return <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>;
  if (!tickets.length) return <div className="text-muted-foreground text-center py-8">No tickets found.</div>;
  return (
    <div className="divide-y">
      {tickets.map((t) => (
        <div
          key={t.id}
          className={`flex items-center justify-between py-3 ${onRowClick ? 'cursor-pointer hover:bg-primary/5' : ''}`}
          onClick={() => onRowClick?.(t)}
        >
          <div className="space-y-1 min-w-0">
            <div className="font-medium truncate">
              {t.ticket_number}: {t.subject}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {t.contact_email || t.guest_name || 'Guest'} &middot; {t.user ? `${t.user.first_name} ${t.user.last_name}` : 'Unknown'} &middot; {formatDate(t.created_at)}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline">{t.status?.replace(/_/g, ' ')}</Badge>
            <Badge variant={t.priority === 'urgent' ? 'destructive' : t.priority === 'high' ? 'default' : 'secondary'}>{t.priority}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
