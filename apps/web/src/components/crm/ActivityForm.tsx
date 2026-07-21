'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createActivity, fetchCompanies, fetchContacts, fetchDeals, fetchUsers } from '@/lib/api';
import { Plus } from 'lucide-react';

const types = ['call', 'meeting', 'email', 'task', 'follow_up', 'demo'];
const statuses = ['planned', 'in_progress', 'completed', 'cancelled', 'overdue'];
const priorities = ['low', 'medium', 'high', 'urgent'];

interface ActivityFormProps {
  token: string;
  onSuccess?: (activity: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function ActivityForm({ token, onSuccess, onCancel, initial }: ActivityFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({
    subject: '',
    description: '',
    activity_type: 'task',
    status: 'planned',
    priority: 'medium',
    due_date: '',
    duration_minutes: '',
    contact_id: '',
    company_id: '',
    deal_id: '',
    assigned_to: '',
    ...initial,
  });

  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts', 'activity-form'],
    queryFn: () => fetchContacts(token, { limit: 200 }),
    enabled: !!token,
  });

  const { data: companiesData, isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies', 'activity-form'],
    queryFn: () => fetchCompanies(token, { limit: 200 }),
    enabled: !!token,
  });

  const { data: dealsData, isLoading: loadingDeals } = useQuery({
    queryKey: ['deals', 'activity-form'],
    queryFn: () => fetchDeals(token, { limit: 200 }),
    enabled: !!token,
  });

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['users', 'activity-form'],
    queryFn: () => fetchUsers(token),
    enabled: !!token,
  });

  const mutation = useMutation({
    mutationFn: () => createActivity(token, {
      subject: form.subject,
      description: form.description,
      activity_type: form.activity_type,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || undefined,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      contact_id: form.contact_id ? Number(form.contact_id) : undefined,
      company_id: form.company_id ? Number(form.company_id) : undefined,
      deal_id: form.deal_id ? Number(form.deal_id) : undefined,
      assigned_to: form.assigned_to ? Number(form.assigned_to) : undefined,
    } as any),
    onSuccess: (data: any) => {
      toast.success('Activity created');
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      onSuccess?.(data?.activity ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create activity'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
      <div><Label>Type</Label>
        <select value={form.activity_type} onChange={(e) => setForm({ ...form, activity_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {types.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div><Label>Priority</Label>
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div><Label>Status</Label>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div><Label>Due date</Label><Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
      <div><Label>Duration (minutes)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
      <div><Label>Assignee</Label>
        {loadingUsers ? <Skeleton className="h-10 w-full" /> : (
          <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Unassigned</option>
            {usersData?.users?.map((u: any) => <option key={u.id} value={String(u.id)}>{u.first_name} {u.last_name} ({u.email})</option>)}
          </select>
        )}
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
      <div><Label>Deal</Label>
        {loadingDeals ? <Skeleton className="h-10 w-full" /> : (
          <select value={form.deal_id} onChange={(e) => setForm({ ...form, deal_id: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">None</option>
            {dealsData?.deals?.map((d: any) => <option key={d.id} value={String(d.id)}>{d.title}</option>)}
          </select>
        )}
      </div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.subject && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Activity
        </Button>
      </div>
    </div>
  );
}
