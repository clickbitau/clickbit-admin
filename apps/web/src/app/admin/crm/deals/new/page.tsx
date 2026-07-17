'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createDeal, fetchCompanies, fetchContacts, fetchPipelines, fetchUsers } from '@/lib/api';
import type { Pipeline } from '@/types/crm';
import { ArrowLeft, Briefcase, Plus } from 'lucide-react';

const priorities = ['low', 'medium', 'high', 'urgent'];

export default function AdminNewDealPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pipelineId, setPipelineId] = useState('');
  const [form, setForm] = useState<Record<string, any>>({
    title: '',
    description: '',
    value: '',
    currency: 'AUD',
    priority: 'medium',
    expected_close_date: '',
    pipeline_id: '',
    stage_id: '',
    contact_id: '',
    company_id: '',
    owner_id: '',
  });

  const { data: pipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines', token],
    queryFn: () => fetchPipelines(token!),
    enabled: !!token,
  });

  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts', 'deal-form'],
    queryFn: () => fetchContacts(token!, { limit: 200 }),
    enabled: !!token,
  });

  const { data: companiesData, isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies', 'deal-form'],
    queryFn: () => fetchCompanies(token!, { limit: 200 }),
    enabled: !!token,
  });

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['users', 'deal-form'],
    queryFn: () => fetchUsers(token!),
    enabled: !!token,
  });

  const selectedPipeline = useMemo(() => pipelines?.find((p: Pipeline) => String(p.id) === pipelineId), [pipelines, pipelineId]);

  const mutation = useMutation({
    mutationFn: () => createDeal(token!, {
      ...form,
      pipeline_id: Number(pipelineId),
      stage_id: form.stage_id ? Number(form.stage_id) : undefined,
      value: form.value ? Number(form.value) : undefined,
      contact_id: form.contact_id ? Number(form.contact_id) : undefined,
      company_id: form.company_id ? Number(form.company_id) : undefined,
      owner_id: form.owner_id ? Number(form.owner_id) : undefined,
    }),
    onSuccess: (data: any) => {
      toast.success('Deal created');
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      const id = data?.id || data?.deal?.id || data?.data?.id;
      router.push(id ? `/admin/crm/deals/${id}` : '/admin/crm/deals');
    },
    onError: () => toast.error('Failed to create deal'),
  });

  return (
    <PageShell
      title="New Deal"
      icon={Briefcase}
      description="Create a new sales opportunity"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/crm/deals"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Deal Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          <div><Label>Value</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
          <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          <div><Label>Priority</Label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div><Label>Expected close date</Label><Input type="date" value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} /></div>
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
              {selectedPipeline?.stages?.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
          </div>
          <div><Label>Contact</Label>
            {loadingContacts ? <Skeleton className="h-10 w-full" /> : (
              <select value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">None</option>
                {contactsData?.contacts?.map((c: any) => <option key={c.id} value={String(c.id)}>{c.name || `${c.first_name} ${c.last_name}`}</option>)}
              </select>
            )}
          </div>
          <div><Label>Company</Label>
            {loadingCompanies ? <Skeleton className="h-10 w-full" /> : (
              <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">None</option>
                {companiesData?.companies?.map((c: any) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div><Label>Owner</Label>
            {loadingUsers ? <Skeleton className="h-10 w-full" /> : (
              <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Unassigned</option>
                {usersData?.users?.map((u: any) => <option key={u.id} value={String(u.id)}>{u.first_name} {u.last_name} ({u.email})</option>)}
              </select>
            )}
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => form.title && pipelineId && mutation.mutate()} disabled={mutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Create Deal
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
