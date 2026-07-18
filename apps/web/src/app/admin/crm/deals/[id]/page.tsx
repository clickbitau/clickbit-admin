'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/design-system/DataTable';
import { PageShell } from '@/components/design-system/PageShell';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchDealDetail, markDealWon, markDealLost, reopenDeal, deleteDeal } from '@/lib/api';
import { formatCurrency, formatDate, daysUntil } from '@/lib/format';
import type { Activity, CrmProject, DealStageHistoryItem, Note } from '@/types/crm';
import { ArrowLeft, Handshake, User, Building2, Calendar, TrendingUp, DollarSign, Target, Trophy, XCircle, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DealDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const [activeTab, setActiveTab] = useState('overview');

  const { data, isLoading } = useQuery({
    queryKey: ['deal-detail', id],
    queryFn: () => fetchDealDetail(token!, id),
    enabled: !!token && !!id,
  });

  useRealtimeRefresh(['deals', 'crm_activities', 'crm_notes'], ['deal-detail', id], { enabled: !!id });

  const queryClient = useQueryClient();

  const winMutation = useMutation({
    mutationFn: () => markDealWon(token!, id, {}),
    onSuccess: () => { toast.success('Deal marked as won'); queryClient.invalidateQueries({ queryKey: ['deal-detail', id] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const loseMutation = useMutation({
    mutationFn: () => markDealLost(token!, id, {}),
    onSuccess: () => { toast.success('Deal marked as lost'); queryClient.invalidateQueries({ queryKey: ['deal-detail', id] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const reopenMutation = useMutation({
    mutationFn: () => reopenDeal(token!, id),
    onSuccess: () => { toast.success('Deal reopened'); queryClient.invalidateQueries({ queryKey: ['deal-detail', id] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDeal(token!, id),
    onSuccess: () => { toast.success('Deal deleted'); router.push('/admin/crm/deals'); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  if (isLoading || !data) {
    return (
      <PageShell title="Deal" icon={Handshake} description="Loading...">
        <div className="p-6 text-sm text-muted-foreground">Loading deal...</div>
      </PageShell>
    );
  }

  const deal = data.deal;
  const weighted = deal.value && deal.probability ? (Number(deal.value) * deal.probability) / 100 : 0;

  return (
    <PageShell
      title={deal.title}
      icon={Handshake}
      description={deal.deal_number || `Deal · ${deal.status}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/crm/deals"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          {deal.status === 'open' && (
            <>
              <Button size="sm" variant="default" onClick={() => winMutation.mutate()} disabled={winMutation.isPending}><Trophy className="mr-1 h-4 w-4" /> Won</Button>
              <Button size="sm" variant="outline" onClick={() => loseMutation.mutate()} disabled={loseMutation.isPending}><XCircle className="mr-1 h-4 w-4" /> Lost</Button>
            </>
          )}
          {(deal.status === 'won' || deal.status === 'lost') && (
            <Button size="sm" variant="outline" onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}><RotateCcw className="mr-1 h-4 w-4" /> Reopen</Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Value" value={formatCurrency(Number(deal.value ?? 0))} />
        <StatCard icon={TrendingUp} label="Probability" value={`${deal.probability ?? 0}%`} />
        <StatCard icon={Target} label="Weighted Value" value={formatCurrency(weighted)} />
        <StatCard icon={Calendar} label="Expected Close" value={deal.expected_close_date ? daysUntil(deal.expected_close_date) : '-'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Stage progress</span>
              <span className="text-sm font-semibold">{deal.stage?.name || '-'}</span>
            </div>
            <Progress value={deal.probability ?? 0} className="h-2" />
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={deal.status} />
              <PriorityBadge priority={deal.priority} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Pipeline</span> <span>{deal.pipeline?.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Stage</span> <span>{deal.stage?.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Source</span> <span>{deal.lead_source || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expected Close</span> <span>{formatDate(deal.expected_close_date)}</span></div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activities">Activities ({data.activities?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({data.notes?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">Stage History ({data.stageHistory?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="projects">Projects ({data.projects?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({data.invoices?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({data.expenses?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>About</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground whitespace-pre-line">{deal.description || 'No description.'}</p>
                {deal.status === 'won' && deal.won_reason && <p className="text-emerald-600">Won reason: {deal.won_reason}</p>}
                {deal.status === 'lost' && (deal.lost_reason || deal.competitor) && (
                  <p className="text-red-600">Lost reason: {deal.lost_reason || '-'} {deal.competitor ? `· Competitor: ${deal.competitor}` : ''}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between"><span className="text-muted-foreground">Actual Close</span> <span>{formatDate(deal.actual_close_date)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Currency</span> <span>{deal.currency || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Position</span> <span>{deal.position ?? '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Created</span> <span>{formatDate(deal.created_at)}</span></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>People</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <PersonRow icon={User} label="Owner" value={deal.owner ? `${deal.owner.first_name} ${deal.owner.last_name}` : '-'} />
                <PersonRow icon={Building2} label="Company" value={deal.company?.name || '-'} sub={deal.company?.email} />
                <PersonRow icon={User} label="Contact" value={deal.contact?.name || '-'} sub={deal.contact?.email} />
                {deal.contactAssociations && deal.contactAssociations.length > 0 && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Associated Contacts</p>
                    <ul className="space-y-1 text-xs">
                      {deal.contactAssociations.map(({ contact }) => (
                        <li key={contact.id}><Link href={`/admin/crm/contacts/${contact.id}`} className="hover:underline">{contact.name}</Link> {contact.email && <span className="text-muted-foreground">· {contact.email}</span>}</li>
                      ))}
                    </ul>
                  </div>
                )}
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

        <TabsContent value="history" className="space-y-3">
          <DataTable
            headers={[{ key: 'date', label: 'Date' }, { key: 'from', label: 'From' }, { key: 'to', label: 'To' }, { key: 'note', label: 'Note' }]}
            data={data.stageHistory ?? []}
            keyExtractor={(h) => h.id}
            emptyText="No stage history."
            renderRow={(h: DealStageHistoryItem) => [
              <span key="date">{formatDate(h.created_at)}</span>,
              <span key="from" className="text-sm text-muted-foreground">{h.fromStage?.name || '-'}</span>,
              <span key="to" className="text-sm font-medium">{h.toStage?.name || '-'}</span>,
              <span key="note" className="text-sm">{h.note || '-'}</span>,
            ]}
          />
        </TabsContent>

        <TabsContent value="projects" className="space-y-3">
          <DataTable
            headers={[{ key: 'name', label: 'Project' }, { key: 'status', label: 'Status' }, { key: 'progress', label: 'Progress' }, { key: 'budget', label: 'Budget' }, { key: 'due', label: 'Due' }]}
            data={data.projects ?? []}
            keyExtractor={(p: CrmProject) => p.id}
            emptyText="No projects."
            onRowClick={(p: CrmProject) => router.push(`/admin/crm/projects/${p.id}`)}
            renderRow={(p: CrmProject) => [
              <div key="name"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.project_number}</p></div>,
              <StatusBadge key="status" status={p.status} />,
              <div key="progress" className="w-24"><Progress value={p.progress_percentage ?? 0} className="h-1.5" /><p className="text-xs text-right mt-0.5">{p.progress_percentage ?? 0}%</p></div>,
              <span key="budget" className="text-sm">{formatCurrency(Number(p.budget ?? 0))}</span>,
              <span key="due">{formatDate(p.due_date)}</span>,
            ]}
          />
        </TabsContent>

        <TabsContent value="invoices" className="space-y-3">
          <DataTable
            headers={[{ key: 'ref', label: 'Ref' }, { key: 'title', label: 'Title' }, { key: 'amount', label: 'Amount' }, { key: 'status', label: 'Status' }, { key: 'payment', label: 'Payment' }, { key: 'date', label: 'Issue Date' }]}
            data={data.invoices ?? []}
            keyExtractor={(i: any) => i.id}
            emptyText="No invoices."
            renderRow={(i: any) => [
              <span key="ref" className="text-sm">{i.package_code || `#${i.id}`}</span>,
              <span key="title">{i.title || '-'}</span>,
              <span key="amount">{formatCurrency(Number(i.total_amount ?? 0))}</span>,
              <StatusBadge key="status" status={i.status} />,
              <span key="payment" className="text-xs text-muted-foreground">{i.payment_status || '-'}</span>,
              <span key="date">{formatDate(i.issue_date)}</span>,
            ]}
          />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-3">
          <DataTable
            headers={[{ key: 'desc', label: 'Description' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount' }, { key: 'status', label: 'Status' }, { key: 'date', label: 'Date' }]}
            data={data.expenses ?? []}
            keyExtractor={(e: any) => e.id}
            emptyText="No expenses."
            renderRow={(e: any) => [
              <span key="desc" className="font-medium">{e.description || '-'}</span>,
              <span key="category" className="text-sm text-muted-foreground">{e.category || '-'}</span>,
              <span key="amount">{formatCurrency(Number(e.amount ?? 0))}</span>,
              <StatusBadge key="status" status={e.status} />,
              <span key="date">{formatDate(e.date)}</span>,
            ]}
          />
        </TabsContent>
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
