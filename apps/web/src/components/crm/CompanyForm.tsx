'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createCompany } from '@/lib/api';
import type { Company } from '@/types/crm';
import { Plus } from 'lucide-react';

const sizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

interface CompanyFormProps {
  token: string;
  onSuccess?: (company: Company) => void;
  onCancel?: () => void;
  initial?: Partial<Company>;
}

export function CompanyForm({ token, onSuccess, onCancel, initial }: CompanyFormProps) {
  const [form, setForm] = useState<Partial<Company>>({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    domain: '',
    industry: '',
    company_size: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    description: '',
    logo_url: '',
    linkedin_url: '',
    twitter_url: '',
    facebook_url: '',
    ...initial,
  });

  const createMutation = useMutation({
    mutationFn: () => createCompany(token, form),
    onSuccess: (data: any) => {
      toast.success('Company created');
      onSuccess?.(data?.company ?? data);
    },
    onError: () => toast.error('Failed to create company'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Name</Label><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>Contact person</Label><Input value={form.contact_person || ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
      <div><Label>Email</Label><Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div><Label>Phone</Label><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <div><Label>Domain</Label><Input value={form.domain || ''} onChange={(e) => setForm({ ...form, domain: e.target.value })} /></div>
      <div><Label>Industry</Label><Input value={form.industry || ''} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
      <div><Label>Company size</Label>
        <select value={form.company_size || ''} onChange={(e) => setForm({ ...form, company_size: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">Select...</option>
          {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div><Label>Logo URL</Label><Input value={form.logo_url || ''} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Address line 1</Label><Input value={form.address_line1 || ''} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Address line 2</Label><Input value={form.address_line2 || ''} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} /></div>
      <div><Label>City</Label><Input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
      <div><Label>State</Label><Input value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
      <div><Label>Postal code</Label><Input value={form.postal_code || ''} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
      <div><Label>Country</Label><Input value={form.country || ''} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.name && createMutation.mutate()} disabled={createMutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Company
        </Button>
      </div>
    </div>
  );
}
