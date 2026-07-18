'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/design-system/DataTable';
import { PageShell } from '@/components/design-system/PageShell';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchLeadDetail, winLead, loseLead, deleteLead } from '@/lib/api';
import { formatCurrency, formatDate, daysUntil } from '@/lib/format';
import type { Activity, CrmLeadDetail, Deal, Note } from '@/types/crm';
import { ArrowLeft, Target, User, Building2, Calendar, TrendingUp, DollarSign, Star, Trophy, XCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LeadDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const [activeTab, setActiveTab] = useState('overview');

  const { data, isLoading } = useQuery({
    queryKey: ['lead-detail', id],
    queryFn: () => fetchLeadDetail(token!, id),
    enabled: !!token && !!id,
  });

  useRealtimeRefresh(['crm_leads'], ['lead-detail', id], { enabled: !!id });

  const queryClient = useQueryClient();

  const winMutation = useMutation({
    mutationFn: () => winLead(token!, id, { create_deal: true }),
    onSuccess: () => { toast.success('Lead marked as won'); queryClient.invalidateQueries({ queryKey: ['lead-detail', id] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const loseMutation = useMutation({
    mutationFn: () => loseLead(token!, id),
    onSuccess: () => { toast.success('Lead marked as lost'); queryClient.invalidateQueries({ queryKey: ['lead-detail', id] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLead(token!, id),
    onSuccess: () => { toast.success('Lead deleted'); router.push('/admin/crm/leads'); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  if (isLoading || !data) {
    return (
      <PageShell title="Lead" icon={Target} description="Loading...">
        <div className="p-6 text-sm text-muted-foreground">Loading lead...</div>
      </PageShell>
    );
  }

  const lead = data.lead;

  return (
    <PageShell
      title={lead.name}
      icon={Target}
      description={lead.lead_number || `Lead · ${lead.status}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/crm/leads"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          {lead.status === 'open' && (
            <>
              <Button size="sm" variant="default" onClick={() => winMutation.mutate()} disabled={winMutation.isPending}><Trophy className="mr-1 h-4 w-4" /> Won</Button>
              <Button size="sm" variant="outline" onClick={() => loseMutation.mutate()} disabled={loseMutation.isPending}><XCircle className="mr-1 h-4 w-4" /> Lost</Button>
            </>
          )}
          <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Estimated Value" value={formatCurrency(Number(lead.estimated_value ?? 0))} />
        <StatCard icon={Star} label="Lead Score" value={`${lead.lead_score ?? 0}`} />
        <StatCard icon={TrendingUp} label="Probability" value={`${lead.probability ?? 0}%`} />
        <StatCard icon={Calendar} label="Expected Close" value={lead.expected_close_date ? daysUntil(lead.expected_close_date) : '-'} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activities">Activities ({data.activities?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({data.notes?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({data.deals?.length ?? 0})</TabsTrigger>
          {lead.company_id && <TabsTrigger value="contacts">Contacts ({data.companyContacts?.length ?? 0})</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>About</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground whitespace-pre-line">{lead.description || 'No description.'}</p>
                {lead.requirements && <p className="text-muted-foreground whitespace-pre-line">{lead.requirements}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between"><span className="text-muted-foreground">Pipeline</span> <span>{lead.pipeline?.name || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Stage</span> <span>{lead.stage?.name || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Source</span> <span>{lead.lead_source || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Priority</span> <PriorityBadge priority={lead.priority} /></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span> <StatusBadge status={lead.status} /></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Expected Close</span> <span>{formatDate(lead.expected_close_date)}</span></div>
                </div>
                {lead.status === 'won' && lead.won_reason && <p className="pt-2 text-emerald-600">Won reason: {lead.won_reason}</p>}
                {lead.status === 'lost' && lead.lost_reason && <p className="pt-2 text-red-600">Lost reason: {lead.lost_reason} {lead.competitor ? `· Competitor: ${lead.competitor}` : ''}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>People</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <PersonRow icon={User} label="Owner" value={lead.owner ? `${lead.owner.first_name} ${lead.owner.last_name}` : '-'} />
                <PersonRow icon={Building2} label="Company" value={lead.company?.name || lead.company_name || '-'} sub={lead.company?.email} />
                <PersonRow icon={User} label="Contact" value={lead.contact?.name || '-'} sub={lead.contact?.email} />
                <PersonRow icon={User} label="Converted Contact" value={lead.converted_contact?.name || '-'} sub={lead.converted_contact?.email} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activities" className="space-y-3">
          <DataTable
            headers={[{ key: 'activity', label: 'Activity' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'priority', label: 'Priority' }, { key: 'due', label: 'Due' }, { key: 'assignee', label: 'Assignee' }]}
            data={data.activities ?? []}
            keyExtractor={(a) => a.id}
            emptyText="No activities."
            renderRow={(a: Activity) => [
              <div key="activity"><p className="font-medium">{a.subject}</p><p className="text-xs text-muted-foreground line-clamp-1">{a.description}</p></div>,
              <span key="type" className="text-sm capitalize">{a.activity_type}</span>,
              <StatusBadge key="status" status={a.status} />,
              <PriorityBadge key="priority" priority={a.priority} />,
              <span key="due">{formatDate(a.due_date)}</span>,
              <span key="assignee" className="text-sm">{a.assignee ? `${a.assignee.first_name} ${a.assignee.last_name}` : '-'}</span>,
            ]}
          />
        </TabsContent>

        <TabsContent value="notes" className="space-y-3">
          <DataTable
            headers={[{ key: 'note', label: 'Note' }, { key: 'type', label: 'Type' }, { key: 'creator', label: 'Creator' }, { key: 'created', label: 'Created' }]}
            data={data.notes ?? []}
            keyExtractor={(n) => n.id}
            emptyText="No notes."
            renderRow={(n: Note) => [
              <div key="note"><p className="text-sm line-clamp-2">{n.content}</p></div>,
              <span key="type" className="text-xs text-muted-foreground">{n.note_type || '-'}</span>,
              <span key="creator" className="text-sm">{n.creator ? `${n.creator.first_name} ${n.creator.last_name}` : '-'}</span>,
              <span key="created">{formatDate(n.created_at)}</span>,
            ]}
          />
        </TabsContent>

        <TabsContent value="deals" className="space-y-3">
          <DataTable
            headers={[{ key: 'deal', label: 'Deal' }, { key: 'value', label: 'Value' }, { key: 'status', label: 'Status' }, { key: 'priority', label: 'Priority' }]}
            data={data.deals ?? []}
            keyExtractor={(d) => d.id}
            emptyText="No deals."
            onRowClick={(d: Deal) => router.push(`/admin/crm/deals/${d.id}`)}
            renderRow={(d: Deal) => [
              <div key="deal"><p className="font-medium">{d.title}</p><p className="text-xs text-muted-foreground">{d.deal_number}</p></div>,
              <span key="value" className="text-sm">{formatCurrency(Number(d.value ?? 0))}</span>,
              <StatusBadge key="status" status={d.status} />,
              <PriorityBadge key="priority" priority={d.priority} />,
            ]}
          />
        </TabsContent>

        {lead.company_id && (
          <TabsContent value="contacts" className="space-y-3">
            <DataTable
              headers={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }]}
              data={data.companyContacts ?? []}
              keyExtractor={(c) => c.id}
              emptyText="No contacts."
              onRowClick={(c) => router.push(`/admin/crm/contacts/${c.id}`)}
              renderRow={(c) => [
                <span key="name" className="font-medium">{c.name}</span>,
                <span key="email" className="text-sm">{c.email || '-'}</span>,
                <span key="phone" className="text-sm">{c.phone || '-'}</span>,
              ]}
            />
          </TabsContent>
        )}
      </Tabs>
    </PageShell>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof DollarSign; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" /></div>
        </div>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function PersonRow({ icon: Icon, label, value, sub }: { icon: typeof User; label: string; value: string; sub?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0"><Icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" /></div>
      <div className="min-w-0">
        <p className="font-medium truncate">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{sub || label}</p>
      </div>
    </div>
  );
}
