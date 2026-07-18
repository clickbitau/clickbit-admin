'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/design-system/DataTable';
import { PageShell } from '@/components/design-system/PageShell';
import { Pagination } from '@/components/design-system/Pagination';
import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { FormDialog } from '@/components/design-system/FormDialog';
import { ConfirmDialog } from '@/components/design-system/ConfirmDialog';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import {
  fetchLeads,
  fetchPipelines,
  fetchPipeline,
  fetchTeam,
  createLead,
  updateLead,
  deleteLead,
  winLead,
  loseLead,
  recalculateLeadScores,
  updateLeadScore,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { CrmLead, Pipeline, PipelineStage, User } from '@/types/crm';
import { Plus, Search, RefreshCw, UserPlus, TrendingUp, Target, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

export default function LeadsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [priority, setPriority] = useState('');
  const [ownerId, setOwnerId] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmLead | null>(null);
  const [deleting, setDeleting] = useState<CrmLead | null>(null);
  const [scoring, setScoring] = useState<CrmLead | null>(null);

  const { data: pipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => fetchPipelines(token!),
    enabled: !!token,
  });

  const { data: currentPipeline } = useQuery({
    queryKey: ['pipeline', pipelineId],
    queryFn: () => fetchPipeline(token!, pipelineId),
    enabled: !!token && !!pipelineId,
  });

  const { data: team } = useQuery({
    queryKey: ['team'],
    queryFn: () => fetchTeam(token!),
    enabled: !!token,
  });

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit: 25, sort: 'created_at', order: 'DESC' };
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.status = status;
    if (pipelineId) params.pipeline_id = pipelineId;
    if (stageId) params.stage_id = stageId;
    if (priority) params.priority = priority;
    if (ownerId) params.owner_id = ownerId;
    return params;
  }, [page, debouncedSearch, status, pipelineId, stageId, priority, ownerId]);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', queryParams],
    queryFn: () => fetchLeads(token!, queryParams),
    enabled: !!token,
  });

  useRealtimeRefresh(['crm_leads', 'crm_pipelines', 'crm_pipeline_stages'], ['leads'], { enabled: !!token });

  const leads = useMemo(() => data?.leads ?? [], [data?.leads]);
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 25 };

  const stats = useMemo(() => {
    const totalValue = leads.reduce((sum, l) => sum + (Number(l.estimated_value ?? 0)), 0);
    return [
      { label: 'Total Leads', value: pagination.totalItems, icon: UserPlus, accent: 'primary' as const },
      { label: 'Total Value', value: formatCurrency(totalValue), icon: TrendingUp, accent: 'success' as const },
      { label: 'Open', value: leads.filter((l) => l.status === 'open').length, icon: Target, accent: 'warning' as const },
      { label: 'Avg Score', value: leads.length ? Math.round(leads.reduce((s, l) => s + (l.lead_score ?? 0), 0) / leads.length) : 0, icon: BarChart3, accent: 'secondary' as const },
    ];
  }, [leads, pagination.totalItems]);

  const createMutation = useMutation({
    mutationFn: (values: Partial<CrmLead>) => createLead(token!, values),
    onSuccess: () => { toast.success('Lead created'); setFormOpen(false); queryClient.invalidateQueries({ queryKey: ['leads'] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed to create lead'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<CrmLead> }) => updateLead(token!, id, values),
    onSuccess: () => { toast.success('Lead updated'); setFormOpen(false); setEditing(null); queryClient.invalidateQueries({ queryKey: ['leads'] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed to update lead'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLead(token!, id),
    onSuccess: () => { toast.success('Lead deleted'); setDeleting(null); queryClient.invalidateQueries({ queryKey: ['leads'] }); },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete lead'),
  });

  function handleSubmit(values: Partial<CrmLead>) {
    if (editing) updateMutation.mutate({ id: editing.id, values });
    else createMutation.mutate(values);
  }

  function handleWin(lead: CrmLead) {
    winLead(token!, lead.id, { create_deal: true }).then(() => {
      toast.success('Lead marked as won');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }).catch((err: Error) => toast.error(err.message || 'Failed'));
  }

  function handleLose(lead: CrmLead) {
    loseLead(token!, lead.id).then(() => {
      toast.success('Lead marked as lost');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }).catch((err: Error) => toast.error(err.message || 'Failed'));
  }

  const stageOptions = currentPipeline?.stages ?? [];

  return (
    <PageShell title="Leads" icon={UserPlus} description="Track and score sales leads" actions={
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => recalculateLeadScores(token!).then(() => { toast.success('Scores recalculated'); queryClient.invalidateQueries({ queryKey: ['leads'] }); }).catch((err: Error) => toast.error(err.message || 'Failed'))}>
              <RefreshCw className="mr-1 h-4 w-4" /> Recalculate
            </Button>
            <Button asChild><Link href="/admin/crm/leads/new"><Plus className="mr-1 h-4 w-4" /> New Lead</Link></Button>
        </div>}>
      <StatCards cards={stats} />

      <div className="nm-raised p-4 grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search leads..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Select value={pipelineId} onValueChange={(v) => { setPipelineId(v); setStageId(''); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Pipeline" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All pipelines</SelectItem>
              {(pipelines ?? []).map((p: Pipeline) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={stageId} onValueChange={(v) => { setStageId(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All stages</SelectItem>
              {stageOptions.map((s: PipelineStage) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ownerId} onValueChange={(v) => { setOwnerId(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All owners</SelectItem>
              {(team ?? []).map((u: User) => <SelectItem key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

      <DataTable
        headers={[
            { key: 'lead', label: 'Lead' },
            { key: 'score', label: 'Score' },
            { key: 'status', label: 'Status' },
            { key: 'priority', label: 'Priority' },
            { key: 'value', label: 'Value' },
            { key: 'source', label: 'Source' },
            { key: 'created', label: 'Created' },
            { key: 'actions', label: '' },
          ]}
          data={leads}
          keyExtractor={(l) => l.id}
          loading={isLoading}
          renderRow={(lead) => [
            <div key="lead">
              <Link href={`/admin/crm/leads/${lead.id}`} className="font-medium hover:underline">{lead.name}</Link>
              <p className="text-xs text-muted-foreground">{lead.email}{lead.phone ? ` · ${lead.phone}` : ''}</p>
              {lead.company && <p className="text-xs text-muted-foreground">{lead.company.name}</p>}
            </div>,
            <div key="score">
              <div className="flex items-center gap-2">
                <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, lead.lead_score ?? 0)}%` }} />
                </div>
                <span className="text-xs font-medium">{lead.lead_score ?? 0}</span>
              </div>
            </div>,
            <StatusBadge key="status" status={lead.status} />,
            <PriorityBadge key="priority" priority={lead.priority} />,
            <span key="value">{formatCurrency(Number(lead.estimated_value ?? 0))}</span>,
            <span key="source" className="text-sm text-muted-foreground">{lead.lead_source || '-'}</span>,
            <span key="created">{formatDate(lead.created_at)}</span>,
            <div key="actions" className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(lead); setFormOpen(true); }}>Edit</Button>
              {lead.status === 'open' && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => handleWin(lead)}>Win</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleLose(lead)}>Lose</Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => setScoring(lead)}>Score</Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleting(lead)}>Delete</Button>
            </div>,
          ]}
      />

      <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} onPageChange={setPage} />

      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} pipelines={pipelines ?? []} stages={stageOptions} team={team ?? []} onSubmit={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} />

      <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Delete Lead" description={`Delete "${deleting?.name}"?`} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} loading={deleteMutation.isPending} />

      <ScoreDialog lead={scoring} onClose={() => setScoring(null)} onSave={async (score) => { if (scoring) { await updateLeadScore(token!, scoring.id, score); toast.success('Score updated'); queryClient.invalidateQueries({ queryKey: ['leads'] }); setScoring(null); } }} />
    </PageShell>
  );
}

function LeadFormDialog({ open, onOpenChange, initial, pipelines, stages, team, onSubmit, loading }: {
  open: boolean; onOpenChange: (open: boolean) => void; initial: CrmLead | null; pipelines: Pipeline[]; stages: PipelineStage[]; team: User[]; onSubmit: (v: Partial<CrmLead>) => void; loading?: boolean;
}) {
  const [selectedPipeline, setSelectedPipeline] = useState(String(initial?.pipeline_id ?? pipelines[0]?.id ?? ''));
  const [selectedStage, setSelectedStage] = useState(String(initial?.stage_id ?? ''));
  const availableStages = stages.filter((s) => String(s.pipeline_id) === selectedPipeline);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSubmit({
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      phone: String(data.get('phone') ?? ''),
      pipeline_id: Number(selectedPipeline) || undefined,
      stage_id: Number(selectedStage) || undefined,
      estimated_value: data.get('estimated_value') ? Number(data.get('estimated_value')) : undefined,
      priority: String(data.get('priority') ?? 'medium'),
      lead_source: String(data.get('lead_source') ?? ''),
      owner_id: data.get('owner_id') ? Number(data.get('owner_id')) : undefined,
    });
  }

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={initial ? 'Edit Lead' : 'New Lead'} onSubmit={handleSubmit} loading={loading}>
      <div className="grid gap-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={initial?.name ?? ''} required /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" defaultValue={initial?.email ?? ''} /></div>
        <div className="grid gap-2"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" defaultValue={initial?.phone ?? ''} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="pipeline_id">Pipeline</Label><Select name="pipeline_id" value={selectedPipeline} onValueChange={(v) => { setSelectedPipeline(v); setSelectedStage(''); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{pipelines.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2"><Label htmlFor="stage_id">Stage</Label><Select name="stage_id" value={selectedStage} onValueChange={setSelectedStage}><SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger><SelectContent>{availableStages.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="estimated_value">Estimated Value</Label><Input id="estimated_value" name="estimated_value" type="number" defaultValue={String(initial?.estimated_value ?? 0)} /></div>
        <div className="grid gap-2"><Label htmlFor="priority">Priority</Label><Select name="priority" defaultValue={initial?.priority ?? 'medium'}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label htmlFor="lead_source">Source</Label><Input id="lead_source" name="lead_source" defaultValue={initial?.lead_source ?? ''} /></div>
        <div className="grid gap-2"><Label htmlFor="owner_id">Owner</Label><Select name="owner_id" defaultValue={initial?.owner_id ? String(initial.owner_id) : ''}><SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger><SelectContent>{team.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</SelectItem>)}</SelectContent></Select></div>
      </div>
    </FormDialog>
  );
}

function ScoreDialog({ lead, onClose, onSave }: { lead: CrmLead | null; onClose: () => void; onSave: (score: number) => Promise<void> }) {
  const [score, setScore] = useState(lead?.lead_score ?? 50);
  return (
    <Dialog open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Lead Score</DialogTitle><DialogDescription>Adjust score for {lead?.name}</DialogDescription></DialogHeader>
        <div className="py-4">
          <Slider value={[score]} onValueChange={([v]) => setScore(v)} max={100} step={1} />
          <p className="mt-2 text-center text-lg font-semibold">{score}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(score)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
