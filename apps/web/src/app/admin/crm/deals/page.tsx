'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatCards } from '@/components/design-system/StatCards';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { FormDialog } from '@/components/design-system/FormDialog';
import { ConfirmDialog } from '@/components/design-system/ConfirmDialog';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import {
  fetchDeals,
  fetchPipelines,
  fetchPipeline,
  fetchContacts,
  createDeal,
  updateDeal,
  deleteDeal,
  markDealWon,
  markDealLost,
  reopenDeal,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Deal, Pipeline, PipelineStage, CrmContact } from '@/types/crm';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function DealsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [priority, setPriority] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState<Deal | null>(null);

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

  const { data: contactsData } = useQuery({
    queryKey: ['contacts', 'deal-form'],
    queryFn: () => fetchContacts(token!, { limit: 200 }),
    enabled: !!token && formOpen,
  });

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      page,
      limit: 25,
      sortBy: 'created_at',
      sortOrder: 'DESC',
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.status = status;
    if (pipelineId) params.pipeline_id = pipelineId;
    if (stageId) params.stage_id = stageId;
    if (priority) params.priority = priority;
    return params;
  }, [page, debouncedSearch, status, pipelineId, stageId, priority]);

  const { data, isLoading } = useQuery({
    queryKey: ['deals', queryParams],
    queryFn: () => fetchDeals(token!, queryParams),
    enabled: !!token,
  });

  useRealtimeRefresh(['deals', 'crm_pipelines', 'crm_pipeline_stages'], ['deals'], { enabled: !!token });

  const deals = useMemo(() => data?.deals ?? [], [data?.deals]);
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 25 };

  const stats = useMemo(() => {
    const totalValue = deals.reduce((sum, d) => sum + (Number(d.value ?? 0)), 0);
    return [
      { label: 'Total Deals', value: pagination.totalItems },
      { label: 'Total Value', value: formatCurrency(totalValue) },
      { label: 'Open', value: deals.filter((d) => d.status === 'open').length },
      { label: 'Won', value: deals.filter((d) => d.status === 'won').length },
    ];
  }, [deals, pagination.totalItems]);

  const createMutation = useMutation({
    mutationFn: (values: Partial<Deal>) => createDeal(token!, values),
    onSuccess: () => {
      toast.success('Deal created');
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create deal'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<Deal> }) => updateDeal(token!, id, values),
    onSuccess: () => {
      toast.success('Deal updated');
      setFormOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update deal'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDeal(token!, id),
    onSuccess: () => {
      toast.success('Deal deleted');
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete deal'),
  });

  function handleSubmit(values: Partial<Deal>) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values });
    } else {
      createMutation.mutate(values);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(deal: Deal) {
    setEditing(deal);
    setFormOpen(true);
  }

  function handleStatusAction(deal: Deal, action: 'won' | 'lost' | 'reopen') {
    if (action === 'won') {
      markDealWon(token!, deal.id).then(() => {
        toast.success('Deal marked as won');
        queryClient.invalidateQueries({ queryKey: ['deals'] });
      }).catch((err: Error) => toast.error(err.message || 'Failed'));
    } else if (action === 'lost') {
      markDealLost(token!, deal.id).then(() => {
        toast.success('Deal marked as lost');
        queryClient.invalidateQueries({ queryKey: ['deals'] });
      }).catch((err: Error) => toast.error(err.message || 'Failed'));
    } else {
      reopenDeal(token!, deal.id).then(() => {
        toast.success('Deal reopened');
        queryClient.invalidateQueries({ queryKey: ['deals'] });
      }).catch((err: Error) => toast.error(err.message || 'Failed'));
    }
  }

  const pipelineOptions = pipelines ?? [];
  const stageOptions = currentPipeline?.stages ?? [];
  const contactOptions = contactsData?.contacts ?? [];

  const filters = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search deals..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
        <SelectTrigger>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="won">Won</SelectItem>
          <SelectItem value="lost">Lost</SelectItem>
        </SelectContent>
      </Select>
      <Select value={pipelineId} onValueChange={(v) => { setPipelineId(v); setStageId(''); setPage(1); }}>
        <SelectTrigger>
          <SelectValue placeholder="Pipeline" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All pipelines</SelectItem>
          {pipelineOptions.map((p: Pipeline) => (
            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={stageId} onValueChange={(v) => { setStageId(v); setPage(1); }}>
        <SelectTrigger>
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          {stageOptions.map((s: PipelineStage) => (
            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
        <SelectTrigger>
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const headers = [
    { key: 'title', label: 'Deal' },
    { key: 'stage', label: 'Stage' },
    { key: 'status', label: 'Status' },
    { key: 'value', label: 'Value' },
    { key: 'contact', label: 'Contact / Company' },
    { key: 'expected', label: 'Expected Close' },
    { key: 'actions', label: '' },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Deals</h1>
            <p className="text-muted-foreground">Manage opportunities and sales pipeline</p>
          </div>
          <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> New Deal</Button>
        </div>

        <StatCards cards={stats} />
        {filters}

        <DataTable
          headers={headers}
          data={deals}
          keyExtractor={(d) => d.id}
          loading={isLoading}
          renderRow={(deal) => [
            <div key="title" className="font-medium">
              <Link href={`/admin/crm/deals/${deal.id}`} className="hover:underline">{deal.title}</Link>
              <div className="text-xs text-muted-foreground">{deal.deal_number}</div>
            </div>,
            <div key="stage">
              <div className="text-sm">{deal.stage?.name}</div>
              {deal.pipeline && <div className="text-xs text-muted-foreground">{deal.pipeline.name}</div>}
            </div>,
            <StatusBadge key="status" status={deal.status} />,
            <PriorityBadge key="priority" priority={deal.priority} />,
            <div key="value">{formatCurrency(Number(deal.value ?? 0), deal.currency ?? 'AUD')}</div>,
            <div key="contact" className="text-sm">
              {deal.primaryContact ? (
                <div>{deal.primaryContact.name} <span className="text-muted-foreground">({deal.primaryContact.email})</span></div>
              ) : deal.contact ? (
                <div>{deal.contact.name}</div>
              ) : '-'}
              {deal.company && <div className="text-xs text-muted-foreground">{deal.company.name}</div>}
            </div>,
            <div key="expected">{formatDate(deal.expected_close_date)}</div>,
            <div key="actions" className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => openEdit(deal)}>Edit</Button>
              {deal.status === 'open' && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => handleStatusAction(deal, 'won')}>Won</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleStatusAction(deal, 'lost')}>Lost</Button>
                </>
              )}
              {(deal.status === 'won' || deal.status === 'lost') && (
                <Button variant="ghost" size="sm" onClick={() => handleStatusAction(deal, 'reopen')}>Reopen</Button>
              )}
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleting(deal)}>Delete</Button>
            </div>,
          ]}
        />

        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          onPageChange={setPage}
        />
      </div>

      <DealFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        pipelines={pipelineOptions}
        stages={stageOptions}
        contacts={contactOptions}
        onSubmit={handleSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete Deal"
        description={`Are you sure you want to delete "${deleting?.title}"?`}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

function DealFormDialog({
  open,
  onOpenChange,
  initial,
  pipelines,
  stages,
  contacts,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Deal | null;
  pipelines: Pipeline[];
  stages: PipelineStage[];
  contacts: CrmContact[];
  onSubmit: (values: Partial<Deal>) => void;
  loading?: boolean;
}) {
  const [selectedPipeline, setSelectedPipeline] = useState(String(initial?.pipeline_id ?? pipelines[0]?.id ?? ''));
  const [selectedStage, setSelectedStage] = useState(String(initial?.stage_id ?? ''));
  const availableStages = stages.filter((s) => String(s.pipeline_id) === selectedPipeline);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSubmit({
      title: String(data.get('title') ?? ''),
      description: String(data.get('description') ?? ''),
      value: data.get('value') ? Number(data.get('value')) : undefined,
      currency: String(data.get('currency') ?? 'AUD'),
      pipeline_id: Number(selectedPipeline) || undefined,
      stage_id: Number(selectedStage) || undefined,
      contact_id: data.get('contact_id') ? Number(data.get('contact_id')) : undefined,
      priority: String(data.get('priority') ?? 'medium'),
      expected_close_date: String(data.get('expected_close_date') ?? '') || undefined,
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? 'Edit Deal' : 'New Deal'}
      onSubmit={handleSubmit}
      loading={loading}
    >
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={initial?.title ?? ''} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={initial?.description ?? ''}
          className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="value">Value</Label>
          <Input id="value" name="value" type="number" defaultValue={String(initial?.value ?? '')} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" name="currency" defaultValue={initial?.currency ?? 'AUD'} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="pipeline_id">Pipeline</Label>
          <Select
            name="pipeline_id"
            value={selectedPipeline}
            onValueChange={(v) => { setSelectedPipeline(v); setSelectedStage(''); }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="stage_id">Stage</Label>
          <Select name="stage_id" value={selectedStage} onValueChange={setSelectedStage}>
            <SelectTrigger>
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {availableStages.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact_id">Primary Contact</Label>
        <Select name="contact_id" defaultValue={initial?.contact_id ? String(initial.contact_id) : ''}>
          <SelectTrigger>
            <SelectValue placeholder="Select contact" />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.email && `(${c.email})`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="priority">Priority</Label>
          <Select name="priority" defaultValue={initial?.priority ?? 'medium'}>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="expected_close_date">Expected Close</Label>
          <Input id="expected_close_date" name="expected_close_date" type="date" defaultValue={initial?.expected_close_date?.slice(0, 10) ?? ''} />
        </div>
      </div>
    </FormDialog>
  );
}
