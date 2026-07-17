'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { FormDialog } from '@/components/design-system/FormDialog';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import {
  fetchPipelines,
  fetchPipelineBoard,
  moveDeal,
  moveLead,
  createLead,
  winLead,
  loseLead,
  deleteLead,
  deleteDeal,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Pipeline, PipelineStage, CrmLead, Deal } from '@/types/crm';
import {
  Kanban,
  Plus,
  Search,
  Building2,
  Calendar,
  Mail,
  Phone,
  Target,
  TrendingUp,
  CheckCircle,
  XCircle,
  GripVertical,
  Star,
  User,
  RefreshCw,
  ChevronDown,
  Trash2,
  Trophy,
  Frown,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';

type BoardItem = (CrmLead & { type: 'lead' }) | (Deal & { type: 'deal' });

const leadSources = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social', label: 'Social Media' },
  { value: 'email', label: 'Email Campaign' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
];

const priorities = ['low', 'medium', 'high', 'urgent'];

function getPriorityColor(priority?: string | null) {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'high':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'low':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getLeadScoreColor(score?: number) {
  if (!score) return 'text-gray-400';
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-gray-500 dark:text-gray-400';
}

function getStageTotal(stage: PipelineStage) {
  const leadValue =
    stage.leads?.reduce((sum, l) => sum + (Number((l as CrmLead).estimated_value) || 0), 0) ?? 0;
  const dealValue = stage.deals?.reduce((sum, d) => sum + (Number((d as Deal).value) || 0), 0) ?? 0;
  return leadValue + dealValue;
}

function getItemValue(item: BoardItem) {
  if (item.type === 'lead') return Number(item.estimated_value || 0);
  return Number(item.value || 0);
}

function getItemCurrency(item: BoardItem, pipelineCurrency?: string) {
  return item.currency || pipelineCurrency || 'AUD';
}

export default function PipelinePage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [showPipelineSelector, setShowPipelineSelector] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [draggedType, setDraggedType] = useState<'lead' | 'deal' | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [draggedSourceStageId, setDraggedSourceStageId] = useState<number | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newLead, setNewLead] = useState<Partial<CrmLead> & { stage_id?: number; create_deal?: boolean }>({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    job_title: '',
    estimated_value: '',
    currency: 'AUD',
    lead_source: 'website',
    priority: 'medium',
    description: '',
    stage_id: undefined,
  });

  const [winOpen, setWinOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [winReason, setWinReason] = useState('');
  const [winCreateDeal, setWinCreateDeal] = useState(true);
  const [winDealTitle, setWinDealTitle] = useState('');

  const [loseOpen, setLoseOpen] = useState(false);
  const [loseReason, setLoseReason] = useState('');
  const [loseCompetitor, setLoseCompetitor] = useState('');

  const { data: pipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => fetchPipelines(token!),
    enabled: !!token,
  });

  const defaultPipeline = useMemo(() => {
    if (!pipelines?.length) return undefined;
    return pipelines.find((p) => p.is_default) ?? pipelines[0];
  }, [pipelines]);

  useEffect(() => {
    if (defaultPipeline && !selectedPipelineId) {
      setSelectedPipelineId(String(defaultPipeline.id));
    }
  }, [defaultPipeline, selectedPipelineId]);

  const { data: board, isLoading } = useQuery({
    queryKey: ['pipeline-board', selectedPipelineId],
    queryFn: () => fetchPipelineBoard(token!, selectedPipelineId),
    enabled: !!token && !!selectedPipelineId,
  });

  useRealtimeRefresh(
    ['crm_pipelines', 'crm_pipeline_stages', 'crm_leads', 'deals'],
    ['pipeline-board', selectedPipelineId],
    { enabled: !!selectedPipelineId },
  );

  const selectedPipeline = board?.pipeline;
  const stages = useMemo<PipelineStage[]>(() => {
    return (board?.stages ?? []).sort((a, b) => a.position - b.position);
  }, [board]);

  useEffect(() => {
    if (stages.length && !newLead.stage_id) {
      const firstOpen = stages.find((s) => !s.is_won && !s.is_lost);
      setNewLead((prev) => ({ ...prev, stage_id: firstOpen?.id ?? stages[0].id }));
    }
  }, [stages, newLead.stage_id]);

  const filteredStages = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    return stages.map((stage) => ({
      ...stage,
      items: [
        ...(stage.leads?.map((l) => ({ ...(l as CrmLead), type: 'lead' as const })) ?? []),
        ...(stage.deals?.map((d) => ({ ...(d as Deal), type: 'deal' as const })) ?? []),
      ]
        .filter((item) => {
          if (!term) return true;
          const name = item.type === 'lead' ? (item as CrmLead).name : (item as Deal).title;
          const lead = item.type === 'lead' ? (item as CrmLead) : null;
          const deal = item.type === 'deal' ? (item as Deal) : null;
          const hay = [
            name,
            lead?.email,
            lead?.phone,
            lead?.company_name,
            lead?.company?.name,
            deal?.company?.name,
            deal?.primaryContact?.name,
            deal?.primaryContact?.email,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(term);
        })
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) as BoardItem[],
    }));
  }, [stages, debouncedSearch]);

  const moveDealMutation = useMutation({
    mutationFn: ({ id, stage_id }: { id: number; stage_id: number }) => moveDeal(token!, id, { stage_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
      toast.success('Deal moved');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to move deal'),
  });

  const moveLeadMutation = useMutation({
    mutationFn: ({ id, stage_id }: { id: number; stage_id: number }) => moveLead(token!, id, { stage_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
      toast.success('Lead moved');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to move lead'),
  });

  const createLeadMutation = useMutation({
    mutationFn: (values: Partial<CrmLead>) => createLead(token!, values),
    onSuccess: () => {
      toast.success('Lead created');
      setAddOpen(false);
      resetNewLead();
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to create lead'),
  });

  const winLeadMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { reason?: string; create_deal?: boolean; deal_title?: string } }) =>
      winLead(token!, id, data),
    onSuccess: () => {
      toast.success('Lead won and converted');
      setWinOpen(false);
      resetWin();
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to win lead'),
  });

  const loseLeadMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { reason?: string; competitor?: string } }) =>
      loseLead(token!, id, data),
    onSuccess: () => {
      toast.success('Lead marked as lost');
      setLoseOpen(false);
      resetLose();
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to mark lead as lost'),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: (id: number) => deleteLead(token!, id),
    onSuccess: () => {
      toast.success('Lead deleted');
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to delete lead'),
  });

  const deleteDealMutation = useMutation({
    mutationFn: (id: number) => deleteDeal(token!, id),
    onSuccess: () => {
      toast.success('Deal deleted');
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Failed to delete deal'),
  });

  function resetNewLead() {
    const firstOpen = stages.find((s) => !s.is_won && !s.is_lost);
    setNewLead({
      name: '',
      email: '',
      phone: '',
      company_name: '',
      job_title: '',
      estimated_value: '',
      currency: 'AUD',
      lead_source: 'website',
      priority: 'medium',
      description: '',
      stage_id: firstOpen?.id ?? stages[0]?.id,
    });
  }

  function resetWin() {
    setSelectedLead(null);
    setWinReason('');
    setWinCreateDeal(true);
    setWinDealTitle('');
  }

  function resetLose() {
    setSelectedLead(null);
    setLoseReason('');
    setLoseCompetitor('');
  }

  function handleDragStart(e: React.DragEvent, item: BoardItem, stageId: number) {
    const sourceStage = stages.find((s) => s.id === stageId);
    if (sourceStage && (sourceStage.is_won || sourceStage.is_lost)) {
      e.preventDefault();
      return;
    }
    setDraggedType(item.type);
    setDraggedId(item.id);
    setDraggedSourceStageId(stageId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ type: item.type, id: item.id, stageId }));
  }

  function handleDragOver(e: React.DragEvent, stageId: number) {
    e.preventDefault();
    setDragOverStageId(stageId);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverStageId(null);
    }
  }

  function handleDrop(e: React.DragEvent, stage: PipelineStage) {
    e.preventDefault();
    setDragOverStageId(null);

    let type: 'lead' | 'deal' | null = null;
    let id: number | null = null;

    try {
      const json = e.dataTransfer.getData('application/json');
      if (json) {
        const parsed = JSON.parse(json);
        type = parsed.type;
        id = parsed.id;
        if (draggedSourceStageId === null) setDraggedSourceStageId(parsed.stageId);
      }
    } catch {
      // fallback to state
    }

    if (!type || !id) {
      type = draggedType;
      id = draggedId;
    }

    const sourceId = draggedSourceStageId;
    const sourceStage = sourceId ? stages.find((s) => s.id === sourceId) : undefined;
    if (sourceStage && (sourceStage.is_won || sourceStage.is_lost)) {
      clearDrag();
      return;
    }

    if (!type || !id || stage.id === sourceId) {
      clearDrag();
      return;
    }

    if (type === 'lead') {
      const lead = findItemById('lead', id) as CrmLead | undefined;
      if (stage.is_won) {
        if (lead) {
          setSelectedLead(lead);
          setWinDealTitle(`Deal for ${lead.name}`);
          setWinOpen(true);
        }
      } else if (stage.is_lost) {
        if (lead) {
          setSelectedLead(lead);
          setLoseOpen(true);
        }
      } else {
        moveLeadMutation.mutate({ id, stage_id: stage.id });
      }
    } else if (type === 'deal') {
      if ((stage.is_won || stage.is_lost) && !window.confirm(`Move deal to ${stage.name}?`)) {
        clearDrag();
        return;
      }
      moveDealMutation.mutate({ id, stage_id: stage.id });
    }

    clearDrag();
  }

  function clearDrag() {
    setDraggedType(null);
    setDraggedId(null);
    setDraggedSourceStageId(null);
  }

  function findItemById(type: 'lead' | 'deal', id: number): BoardItem | undefined {
    for (const stage of filteredStages) {
      const found = stage.items.find((i) => i.type === type && i.id === id);
      if (found) return found;
    }
    return undefined;
  }

  function handleCardClick(item: BoardItem) {
    if (item.type === 'lead') {
      router.push(`/admin/crm/leads/${item.id}`);
    } else {
      router.push(`/admin/crm/deals/${item.id}`);
    }
  }

  function handleQuickWin(item: BoardItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (item.type === 'lead') {
      setSelectedLead(item as CrmLead);
      setWinDealTitle(`Deal for ${(item as CrmLead).name}`);
      setWinOpen(true);
    }
  }

  function handleQuickLose(item: BoardItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (item.type === 'lead') {
      setSelectedLead(item as CrmLead);
      setLoseOpen(true);
    }
  }

  function handleQuickDelete(item: BoardItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Delete this ${item.type}? This cannot be undone.`)) return;
    if (item.type === 'lead') deleteLeadMutation.mutate(item.id);
    else deleteDealMutation.mutate(item.id);
  }

  function handleCreateLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPipelineId || !newLead.stage_id) return;
    createLeadMutation.mutate({
      ...newLead,
      estimated_value: newLead.estimated_value ? Number(newLead.estimated_value) : 0,
      pipeline_id: Number(selectedPipelineId),
    });
  }

  function handleWinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLead) return;
    winLeadMutation.mutate({
      id: selectedLead.id,
      data: {
        reason: winReason || 'Won via pipeline',
        create_deal: winCreateDeal,
        deal_title: winCreateDeal ? winDealTitle || `Deal for ${selectedLead.name}` : undefined,
      },
    });
  }

  function handleLoseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLead) return;
    loseLeadMutation.mutate({
      id: selectedLead.id,
      data: {
        reason: loseReason || 'Lost via pipeline',
        competitor: loseCompetitor || undefined,
      },
    });
  }

  const stats = board?.stats ?? { totalLeads: 0, totalDeals: 0, totalValue: 0, weightedValue: 0 };
  const statCards = [
    { label: 'Open Leads', value: stats.totalLeads, icon: Target, accent: 'primary' as const },
    { label: 'Open Deals', value: stats.totalDeals, icon: CheckCircle, accent: 'secondary' as const },
    { label: 'Pipeline Value', value: formatCurrency(stats.totalValue, selectedPipeline?.currency), icon: DollarSign, accent: 'success' as const },
    { label: 'Weighted Value', value: formatCurrency(stats.weightedValue, selectedPipeline?.currency), icon: TrendingUp, accent: 'warning' as const },
  ];

  const selectedPipelineName = pipelines?.find((p) => String(p.id) === selectedPipelineId)?.name || selectedPipeline?.name || 'Select Pipeline';

  return (
    <PageShell
      title="Sales Pipeline"
      icon={Kanban}
      description="Drag and drop leads and deals across stages to manage your sales process."
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowPipelineSelector(!showPipelineSelector)}
              className="nm-interactive flex items-center gap-2 px-4 py-2 text-sm"
            >
              <span className="font-medium text-gray-700 dark:text-gray-300">{selectedPipelineName}</span>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>
            {showPipelineSelector && pipelines && pipelines.length > 0 && (
              <div className="absolute right-0 mt-2 w-64 nm-raised border border-gray-200 dark:border-gray-700/50 z-20 rounded-xl overflow-hidden">
                {pipelines.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPipelineId(String(p.id));
                      setShowPipelineSelector(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:brightness-95 dark:hover:brightness-110 transition-colors ${
                      String(p.id) === selectedPipelineId
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {p.name}
                    {p.is_default && (
                      <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded">Default</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['pipeline-board'] })}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Lead
          </Button>
        </div>
      }
    >
      <StatCards cards={statCards} />

      <div className="relative nm-raised-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search board..."
          className="pl-9 bg-transparent shadow-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading board...</p>}

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
        {filteredStages.map((stage) => (
          <div
            key={stage.id}
            className={`flex min-w-[300px] max-w-[340px] flex-1 flex-col transition-all ${
              dragOverStageId === stage.id ? 'scale-[1.01]' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage)}
          >
            <Card className="flex h-full flex-col nm-flat border-t-4" style={{ borderTopColor: stage.color ?? '#94a3b8' }}>
              <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{stage.name}</h3>
                    <span className="px-2 py-0.5 text-xs font-medium nm-raised-sm text-gray-600 dark:text-gray-300 rounded-full">
                      {stage.items.length}
                    </span>
                    {stage.is_won && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {stage.is_lost && <XCircle className="h-4 w-4 text-red-500" />}
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{stage.probability ?? 0}%</span>
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">
                  {formatCurrency(getStageTotal(stage), selectedPipeline?.currency)}
                </p>
              </div>
              <CardContent className="flex-1 space-y-3 overflow-y-auto p-3">
                {stage.items.map((item) => (
                  <BoardCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    stage={stage}
                    currency={selectedPipeline?.currency}
                    onDragStart={(e) => handleDragStart(e, item, stage.id)}
                    onClick={() => handleCardClick(item)}
                    onWin={handleQuickWin}
                    onLose={handleQuickLose}
                    onDelete={handleQuickDelete}
                  />
                ))}
                {stage.items.length === 0 && !isLoading && (
                  <p className="text-xs text-center text-gray-400 py-6">No items</p>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <FormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Lead"
        onSubmit={handleCreateLeadSubmit}
        loading={createLeadMutation.isPending}
      >
        <div className="grid gap-2">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={newLead.email || ''} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={newLead.phone || ''} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input id="company_name" value={newLead.company_name || ''} onChange={(e) => setNewLead({ ...newLead, company_name: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="job_title">Job Title</Label>
            <Input id="job_title" value={newLead.job_title || ''} onChange={(e) => setNewLead({ ...newLead, job_title: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="estimated_value">Estimated Value</Label>
            <Input id="estimated_value" type="number" value={newLead.estimated_value || ''} onChange={(e) => setNewLead({ ...newLead, estimated_value: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expected_close_date">Expected Close Date</Label>
            <Input id="expected_close_date" type="date" value={newLead.expected_close_date || ''} onChange={(e) => setNewLead({ ...newLead, expected_close_date: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Lead Source</Label>
            <Select value={newLead.lead_source} onValueChange={(v) => setNewLead({ ...newLead, lead_source: v })}>
              <SelectTrigger className="nm-raised-sm bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leadSources.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Priority</Label>
            <Select value={newLead.priority} onValueChange={(v) => setNewLead({ ...newLead, priority: v })}>
              <SelectTrigger className="nm-raised-sm bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Stage *</Label>
          <Select value={String(newLead.stage_id)} onValueChange={(v) => setNewLead({ ...newLead, stage_id: Number(v) })}>
            <SelectTrigger className="nm-raised-sm bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={newLead.description || ''} onChange={(e) => setNewLead({ ...newLead, description: e.target.value })} />
        </div>
      </FormDialog>

      <FormDialog
        open={winOpen}
        onOpenChange={setWinOpen}
        title="Win Lead"
        submitLabel="Mark as Won"
        onSubmit={handleWinSubmit}
        loading={winLeadMutation.isPending}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Mark <strong>{selectedLead?.name}</strong> as won. This will convert the lead to a customer.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="winReason">Reason</Label>
          <Input id="winReason" value={winReason} onChange={(e) => setWinReason(e.target.value)} placeholder="Won via pipeline" />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="createDeal"
            type="checkbox"
            checked={winCreateDeal}
            onChange={(e) => setWinCreateDeal(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#1FBBD2] focus:ring-[#1FBBD2]"
          />
          <Label htmlFor="createDeal" className="text-sm font-normal cursor-pointer">
            Create a deal from this lead
          </Label>
        </div>
        {winCreateDeal && (
          <div className="grid gap-2">
            <Label htmlFor="dealTitle">Deal Title</Label>
            <Input id="dealTitle" value={winDealTitle} onChange={(e) => setWinDealTitle(e.target.value)} />
          </div>
        )}
      </FormDialog>

      <FormDialog
        open={loseOpen}
        onOpenChange={setLoseOpen}
        title="Lose Lead"
        submitLabel="Mark as Lost"
        onSubmit={handleLoseSubmit}
        loading={loseLeadMutation.isPending}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Mark <strong>{selectedLead?.name}</strong> as lost.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="loseReason">Reason</Label>
          <Input id="loseReason" value={loseReason} onChange={(e) => setLoseReason(e.target.value)} placeholder="Lost to competitor" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="competitor">Competitor</Label>
          <Input id="competitor" value={loseCompetitor} onChange={(e) => setLoseCompetitor(e.target.value)} />
        </div>
      </FormDialog>
    </PageShell>
  );
}

function BoardCard({
  item,
  stage,
  currency,
  onDragStart,
  onClick,
  onWin,
  onLose,
  onDelete,
}: {
  item: BoardItem;
  stage: PipelineStage;
  currency?: string;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
  onWin: (item: BoardItem, e: React.MouseEvent) => void;
  onLose: (item: BoardItem, e: React.MouseEvent) => void;
  onDelete: (item: BoardItem, e: React.MouseEvent) => void;
}) {
  const isLead = item.type === 'lead';
  const lead = isLead ? (item as CrmLead) : undefined;
  const deal = !isLead ? (item as Deal) : undefined;
  const title = isLead ? lead?.name : deal?.title;
  const value = getItemValue(item);
  const itemCurrency = getItemCurrency(item, currency);
  const isTerminal = stage.is_won || stage.is_lost;

  return (
    <Card
      draggable={!isTerminal}
      onDragStart={onDragStart}
      onDragEnd={(e) => {
        e.preventDefault();
      }}
      onClick={onClick}
      className={`cursor-pointer transition-all hover:-translate-y-0.5 ${
        isTerminal ? '' : 'cursor-grab active:cursor-grabbing'
      } nm-raised-sm border-l-4`}
      style={{ borderLeftColor: stage.color ?? '#e2e8f0' }}
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span
              className={`px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wide ${
                isLead
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
              }`}
            >
              {isLead ? 'Lead' : 'Deal'}
            </span>
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1">{title}</h4>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isLead && lead?.lead_score && lead.lead_score > 0 && (
              <span className={`text-xs font-medium ${getLeadScoreColor(lead.lead_score)}`} title="Lead Score">
                <Star className="h-3 w-3 inline" /> {lead.lead_score}
              </span>
            )}
            {!isTerminal && <GripVertical className="h-4 w-4 text-gray-400" />}
          </div>
        </div>

        {value > 0 && (
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(value, itemCurrency)}</div>
        )}

        <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
          {isLead && lead?.company_name && (
            <div className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{lead.company_name}</span>
            </div>
          )}
          {!isLead && deal?.company?.name && (
            <div className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{deal.company.name}</span>
            </div>
          )}
          {isLead && lead?.email && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {!isLead && deal?.primaryContact?.email && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span className="truncate">{deal.primaryContact.email}</span>
            </div>
          )}
          {isLead && lead?.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span>{lead.phone}</span>
            </div>
          )}
          {(lead?.expected_close_date || deal?.expected_close_date) && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(lead?.expected_close_date || deal?.expected_close_date || '')}</span>
            </div>
          )}
          {(lead?.owner || deal?.owner) && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>
                {lead?.owner?.first_name || deal?.owner?.first_name} {lead?.owner?.last_name?.[0] || deal?.owner?.last_name?.[0] || ''}
                .
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-600">
          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase ${getPriorityColor(item.priority)}`}>
            {item.priority || 'normal'}
          </span>
          <div className="flex items-center gap-1">
            {!isTerminal && isLead && (
              <>
                <button
                  onClick={(e) => onWin(item, e)}
                  title="Mark as won"
                  className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                >
                  <Trophy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => onLose(item, e)}
                  title="Mark as lost"
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                >
                  <Frown className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button
              onClick={(e) => onDelete(item, e)}
              title="Delete"
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
