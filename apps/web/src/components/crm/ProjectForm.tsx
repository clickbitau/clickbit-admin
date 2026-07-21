'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createProject, fetchCompanies, fetchContacts } from '@/lib/api';
import type { Company } from '@clickbit/shared';
import { Plus } from 'lucide-react';

const statuses = ['not_started', 'in_progress', 'on_hold', 'completed', 'cancelled'];
const priorities = ['low', 'medium', 'high', 'urgent'];

interface ProjectFormProps {
  token: string;
  onSuccess?: (project: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function ProjectForm({ token, onSuccess, onCancel, initial }: ProjectFormProps) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Record<string, any>>({
    name: '',
    description: '',
    status: 'not_started',
    priority: 'medium',
    budget: '',
    currency: 'AUD',
    start_date: today,
    due_date: '',
    customer_id: '',
    company_id: '',
    deal_id: '',
    manager_id: '',
    ...initial,
  });

  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts', 'project-form'],
    queryFn: () => fetchContacts(token, { lifecycle_stage: 'customer', limit: 200 }),
    enabled: !!token,
  });

  const { data: companiesData, isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies', 'project-form'],
    queryFn: () => fetchCompanies(token, { limit: 200 }),
    enabled: !!token,
  });

  const customers = contactsData?.contacts ?? [];
  const companies = companiesData?.companies ?? [];

  const mutation = useMutation({
    mutationFn: () => createProject(token, {
      name: form.name,
      description: form.description,
      status: form.status,
      priority: form.priority,
      budget: form.budget ? Number(form.budget) : undefined,
      currency: form.currency,
      start_date: form.start_date || undefined,
      due_date: form.due_date || undefined,
      customer_id: form.customer_id ? Number(form.customer_id) : undefined,
      company_id: form.company_id ? Number(form.company_id) : undefined,
      deal_id: form.deal_id ? Number(form.deal_id) : undefined,
      manager_id: form.manager_id ? Number(form.manager_id) : undefined,
    }),
    onSuccess: (data: any) => {
      toast.success('Project created');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSuccess?.(data?.project ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create project'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
      <div><Label>Status</Label>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div><Label>Priority</Label>
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div><Label>Budget</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
      <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
      <div><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
      <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
      <div><Label>Customer</Label>
        {loadingContacts ? <Skeleton className="h-10 w-full" /> : (
          <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">None</option>
            {customers.map((c: any) => <option key={c.id} value={String(c.id)}>{c.name || `${c.first_name} ${c.last_name}`}</option>)}
          </select>
        )}
      </div>
      <div><Label>Company</Label>
        {loadingCompanies ? <Skeleton className="h-10 w-full" /> : (
          <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">None</option>
            {companies.map((c: Company) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        )}
      </div>
      <div><Label>Deal ID</Label><Input type="number" value={form.deal_id} onChange={(e) => setForm({ ...form, deal_id: e.target.value })} /></div>
      <div><Label>Manager ID</Label><Input type="number" value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.name && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Project
        </Button>
      </div>
    </div>
  );
}
