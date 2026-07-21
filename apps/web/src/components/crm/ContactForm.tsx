'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createContact } from '@/lib/api';
import type { CrmContact } from '@/types/crm';
import { Plus } from 'lucide-react';

const types = ['lead', 'customer', 'agent', 'employee', 'vendor', 'partner'];
const stages = ['lead', 'prospect', 'qualified', 'customer', 'churned'];
const statuses = ['active', 'inactive', 'prospect', 'customer'];

interface ContactFormProps {
  token: string;
  onSuccess?: (contact: CrmContact) => void;
  onCancel?: () => void;
  initial?: Partial<CrmContact>;
}

export function ContactForm({ token, onSuccess, onCancel, initial }: ContactFormProps) {
  const [form, setForm] = useState<Partial<CrmContact>>({
    name: '',
    email: '',
    phone: '',
    contact_type: 'lead',
    lifecycle_stage: 'lead',
    status: 'active',
    company: '',
    company_id: undefined,
    job_title: '',
    department: '',
    source: '',
    website: '',
    location: '',
    linkedin_url: '',
    twitter_url: '',
    preferred_contact_method: 'email',
    priority: 'medium',
    lead_score: 0,
    ...initial,
  });

  const createMutation = useMutation({
    mutationFn: () => createContact(token, form),
    onSuccess: (data: any) => {
      toast.success('Contact created');
      const id = data?.id || data?.contact?.id || data?.data?.id;
      onSuccess?.(data?.contact ?? data);
    },
    onError: () => toast.error('Failed to create contact'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Name</Label><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>Email</Label><Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div><Label>Phone</Label><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <div><Label>Contact type</Label>
        <select value={form.contact_type || 'lead'} onChange={(e) => setForm({ ...form, contact_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div><Label>Lifecycle stage</Label>
        <select value={form.lifecycle_stage || 'lead'} onChange={(e) => setForm({ ...form, lifecycle_stage: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {stages.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div><Label>Status</Label>
        <select value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div><Label>Company name</Label><Input value={form.company || ''} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
      <div><Label>Company ID</Label><Input type="number" value={form.company_id || ''} onChange={(e) => setForm({ ...form, company_id: e.target.value ? Number(e.target.value) : undefined })} /></div>
      <div><Label>Job title</Label><Input value={form.job_title || ''} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
      <div><Label>Department</Label><Input value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
      <div><Label>Source</Label><Input value={form.source || ''} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
      <div><Label>Website</Label><Input value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
      <div><Label>Location</Label><Input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
      <div><Label>LinkedIn</Label><Input value={form.linkedin_url || ''} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></div>
      <div><Label>Twitter</Label><Input value={form.twitter_url || ''} onChange={(e) => setForm({ ...form, twitter_url: e.target.value })} /></div>
      <div><Label>Preferred contact</Label>
        <select value={form.preferred_contact_method || 'email'} onChange={(e) => setForm({ ...form, preferred_contact_method: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="sms">SMS</option>
        </select>
      </div>
      <div><Label>Lead score</Label><Input type="number" value={form.lead_score ?? ''} onChange={(e) => setForm({ ...form, lead_score: e.target.value ? Number(e.target.value) : 0 })} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.name && form.email && createMutation.mutate()} disabled={createMutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Contact
        </Button>
      </div>
    </div>
  );
}
