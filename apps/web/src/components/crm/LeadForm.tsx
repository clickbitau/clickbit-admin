'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createLead, fetchContacts, fetchPipelines, fetchUsers } from '@/lib/api';
import type { Pipeline } from '@/types/crm';
import { Plus } from 'lucide-react';

const priorities = ['low', 'medium', 'high', 'urgent'];

interface LeadFormProps {
  token: string;
  onSuccess?: (lead: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function LeadForm({ token, onSuccess, onCancel, initial }: LeadFormProps) {
  const queryClient = useQueryClient();
  const [pipelineId, setPipelineId] = useState(initial?.pipeline_id || '');
  const [form, setForm] = useState<Record<string, any>>({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    job_title: '',
    website: '',
    description: '',
    requirements: '',
    priority: 'medium',
    source: '',
    source_detail: '',
    pipeline_id: '',
    stage_id: '',
    owner_id: '',
    ...initial,
  });

  const { data: pipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines', token],
    queryFn: () => fetchPipelines(token),
    enabled: !!token,
  });

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['users', 'lead-form'],
    queryFn: () => fetchUsers(token),
    enabled: !!token,
  });

  const selectedPipeline = useMemo(() => pipelines?.find((p: Pipeline) => String(p.id) === pipelineId), [pipelines, pipelineId]);

  const mutation = useMutation({
    mutationFn: () => createLead(token, {
      ...form,
      pipeline_id: Number(pipelineId),
      stage_id: form.stage_id ? Number(form.stage_id) : undefined,
      owner_id: form.owner_id ? Number(form.owner_id) : undefined,
    }),
    onSuccess: (data: any) => {
      toast.success('Lead created');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onSuccess?.(data?.lead ?? data);
    },
    onError: () => toast.error('Failed to create lead'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <div><Label>Company</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
      <div><Label>Job title</Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
      <div><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
      <div><Label>Priority</Label>
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div><Label>Source</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. website, referral" /></div>
      <div><Label>Pipeline</Label>
        {loadingPipelines ? <Skeleton className="h-10 w-full" /> : (
          <select value={pipelineId} onChange={(e) => { setPipelineId(e.target.value); setForm((f: any) => ({ ...f, stage_id: '' })); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Select pipeline</option>
            {pipelines?.map((p: Pipeline) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
        )}
      </div>
      <div><Label>Stage</Label>
        <select value={form.stage_id} onChange={(e) => setForm({ ...form, stage_id: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">Select stage</option>
          {selectedPipeline?.stages?.map((s: any) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </select>
      </div>
      <div><Label>Owner</Label>
        {loadingUsers ? <Skeleton className="h-10 w-full" /> : (
          <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Unassigned</option>
            {usersData?.users?.map((u: any) => <option key={u.id} value={String(u.id)}>{u.first_name} {u.last_name} ({u.email})</option>)}
          </select>
        )}
      </div>
      <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
      <div className="md:col-span-2"><Label>Requirements</Label><Textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={3} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.name && pipelineId && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Lead
        </Button>
      </div>
    </div>
  );
}
