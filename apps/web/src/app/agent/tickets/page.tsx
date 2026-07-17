'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchAgentPortalTickets } from '@/lib/api';
import { Ticket, Plus, ChevronLeft, ChevronRight, Clock, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

function timeAgo(date?: string | Date) {
  if (!date) return '-';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open: { label: 'Open', icon: <Ticket className="w-3 h-3" />, variant: 'default' },
  in_progress: { label: 'In Progress', icon: <RefreshCw className="w-3 h-3" />, variant: 'secondary' },
  waiting_staff: { label: 'Waiting Staff', icon: <Clock className="w-3 h-3" />, variant: 'secondary' },
  waiting_customer: { label: 'Awaiting Reply', icon: <AlertCircle className="w-3 h-3" />, variant: 'outline' },
  resolved: { label: 'Resolved', icon: <CheckCircle2 className="w-3 h-3" />, variant: 'default' },
  closed: { label: 'Closed', icon: <CheckCircle2 className="w-3 h-3" />, variant: 'outline' },
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-green-400', medium: 'bg-amber-400', high: 'bg-orange-500', urgent: 'bg-red-500',
};

export default function AgentTicketsPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['agent-tickets', token, page, status],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAgentPortalTickets(token, { page, limit: 25, status }); },
    enabled: !!token,
  });

  const tickets = (data?.data || []) as Array<{
    id: number; ticket_number?: string; subject?: string; status?: string; priority?: string; category?: string; contact_email?: string; created_at?: string; last_activity_at?: string;
  }>;
  const pagination = (data?.pagination || { currentPage: 1, totalPages: 1 }) as { currentPage: number; totalPages: number };

  if (isLoading) {
    return <div className="p-4 space-y-6"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="w-7 h-7 text-primary" />
            Support Tickets
          </h1>
          <p className="text-muted-foreground mt-1">Tickets from your clients</p>
        </div>
        <Button asChild size="sm">
          <Link href="/agent/tickets/new"><Plus className="w-4 h-4 mr-1" /> New Ticket</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'open', 'in_progress', 'waiting_customer', 'resolved', 'closed'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-sm transition-all ${status === s ? 'nm-inset-sm text-primary' : 'hover:nm-raised-sm text-muted-foreground'}`}
          >
            {s ? (STATUS_CONFIG[s]?.label || s) : 'All'}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {tickets.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Ticket className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-medium mb-1">No tickets found</h3>
              <p className="text-sm">Tickets linked to your clients will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tickets.map((t) => {
                const config = STATUS_CONFIG[t.status || ''] || { label: t.status || 'Open', icon: <Ticket className="w-3 h-3" />, variant: 'secondary' };
                return (
                  <Link key={t.id} href={`/agent/tickets/${t.id}`} className="flex items-start justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{t.subject || t.ticket_number || `Ticket #${t.id}`}</span>
                        <Badge variant={config.variant} className="flex items-center gap-1 capitalize text-xs">
                          {config.icon} {config.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3">
                        <span>{t.contact_email || 'No contact'}</span>
                        <span>{t.category || 'General'}</span>
                        <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[t.priority || ''] || 'bg-gray-400'}`} /> {t.priority || 'medium'}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground whitespace-nowrap ml-4">
                      <div>{timeAgo(t.last_activity_at || t.created_at)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="flex items-center gap-1 px-3 py-2 rounded-xl disabled:opacity-50 hover:nm-raised-sm"><ChevronLeft className="w-4 h-4" /> Previous</button>
          <span className="text-sm text-muted-foreground">Page {pagination.currentPage} of {pagination.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} className="flex items-center gap-1 px-3 py-2 rounded-xl disabled:opacity-50 hover:nm-raised-sm">Next <ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
