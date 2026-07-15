'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCards } from '@/components/design-system/StatCards';
import { FormDialog } from '@/components/design-system/FormDialog';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchPipelines, fetchPipelineBoard, moveDeal, moveLead, createLead } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Pipeline, PipelineStage, CrmLead, Deal } from '@/types/crm';
import {
  Building2,
  Calendar,
  Mail,
  Phone,
  Plus,
  Search,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

type BoardItem = (CrmLead | Deal) & { type: 'lead' | 'deal' };

export default function PipelinePage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [addOpen, setAddOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<BoardItem | null>(null);

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

  const moveDealMutation = useMutation({
    mutationFn: ({ id, stage_id }: { id: number; stage_id: number }) => moveDeal(token!, id, { stage_id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-board'] }),
    onError: (err: Error) => toast.error(err.message || 'Failed to move deal'),
  });

  const moveLeadMutation = useMutation({
    mutationFn: ({ id, stage_id }: { id: number; stage_id: number }) => moveLead(token!, id, { stage_id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-board'] }),
    onError: (err: Error) => toast.error(err.message || 'Failed to move lead'),
  });

  const createLeadMutation = useMutation({
    mutationFn: (values: { name: string; email: string; phone: string; estimated_value: number; pipeline_id: number; stage_id: number }) =>
      createLead(token!, values),
    onSuccess: () => {
      toast.success('Lead created');
      setAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create lead'),
  });

  const stages = useMemo<(PipelineStage & { items: BoardItem[] })[]>(() => {
    if (!board) return [];
    return board.stages.map((s) => ({
      ...s,
      items: [
        ...(s.leads ?? []).map((l) => ({ ...l, type: 'lead' as const })),
        ...(s.deals ?? []).map((d) => ({ ...d, type: 'deal' as const })),
      ].filter((item) => {
        if (!debouncedSearch) return true;
        const term = debouncedSearch.toLowerCase();
        const name = item.type === 'lead' ? item.name : item.title;
        return name?.toLowerCase().includes(term) ?? false;
      }) as BoardItem[],
    }));
  }, [board, debouncedSearch]);

  const stats = board?.stats;

  const [selectedStage, setSelectedStage] = useState(String(stages[0]?.id ?? ''));
  useEffect(() => {
    setSelectedStage(String(stages[0]?.id ?? ''));
  }, [stages]);

  function handleDragStart(item: BoardItem) {
    setDraggedItem(item);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, stage: PipelineStage) {
    e.preventDefault();
    if (!draggedItem) return;

    if (draggedItem.type === 'deal') {
      moveDealMutation.mutate({ id: draggedItem.id, stage_id: stage.id });
    } else {
      moveLeadMutation.mutate({ id: draggedItem.id, stage_id: stage.id });
    }
    setDraggedItem(null);
  }

  function handleAddLeadSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    createLeadMutation.mutate({
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      phone: String(data.get('phone') ?? ''),
      estimated_value: Number(data.get('estimated_value') || 0),
      pipeline_id: Number(selectedPipelineId),
      stage_id: Number(selectedStage || 0),
    });
  }

  const statCards = [
    { label: 'Total Leads', value: stats?.totalLeads ?? 0 },
    { label: 'Total Deals', value: stats?.totalDeals ?? 0 },
    { label: 'Total Value', value: formatCurrency(stats?.totalValue ?? 0) },
    { label: 'Weighted Value', value: formatCurrency(stats?.weightedValue ?? 0) },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
            <p className="text-muted-foreground">Drag and drop leads and deals across stages</p>
          </div>
          <div className="flex items-center gap-2">
            {pipelines && pipelines.length > 0 && (
              <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p: Pipeline) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add Lead
            </Button>
          </div>
        </div>

        <StatCards cards={statCards} />

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search board..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading board...</p>}

        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="flex min-w-[280px] max-w-[320px] flex-1 flex-col"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
            >
              <Card className="flex h-full flex-col bg-muted/30">
                <CardHeader className="py-3">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: stage.color ?? '#94a3b8' }}
                      />
                      {stage.name}
                    </span>
                    <span className="text-muted-foreground">{stage.items.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 overflow-y-auto">
                  {stage.items.map((item) => (
                    <BoardCard key={`${item.type}-${item.id}`} item={item} onDragStart={handleDragStart} />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      <FormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Lead"
        onSubmit={handleAddLeadSubmit}
        loading={createLeadMutation.isPending}
      >
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estimated_value">Estimated Value</Label>
          <Input id="estimated_value" name="estimated_value" type="number" defaultValue="0" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="stage_id">Stage</Label>
          <Select name="stage_id" value={selectedStage} onValueChange={setSelectedStage}>
            <SelectTrigger>
              <SelectValue placeholder="Select stage" />
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
      </FormDialog>
    </div>
  );
}

function BoardCard({ item, onDragStart }: { item: BoardItem; onDragStart: (item: BoardItem) => void }) {
  const isLead = item.type === 'lead';
  const title = isLead ? (item as CrmLead).name : (item as Deal).title;
  const value = isLead ? (item as CrmLead).estimated_value : (item as Deal).value;
  const currency = (item as Deal).currency ?? 'AUD';

  return (
    <Card
      draggable
      onDragStart={() => onDragStart(item)}
      className="cursor-grab border-l-4 shadow-sm active:cursor-grabbing"
      style={{ borderLeftColor: item.stage?.color ?? '#e2e8f0' }}
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold">{title}</p>
          <span className="text-xs font-medium text-emerald-600">{formatCurrency(Number(value ?? 0), currency)}</span>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          {item.company && (
            <div className="flex items-center gap-1">
              <Building2 className="h-3 w-3" /> {item.company.name}
            </div>
          )}
          {isLead && (item as CrmLead).email && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" /> {(item as CrmLead).email}
            </div>
          )}
          {isLead && (item as CrmLead).phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> {(item as CrmLead).phone}
            </div>
          )}
          {(item as Deal).expected_close_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {(item as Deal).expected_close_date}
            </div>
          )}
          {item.owner && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" /> {item.owner.first_name} {item.owner.last_name}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
