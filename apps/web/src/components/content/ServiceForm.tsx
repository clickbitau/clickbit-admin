'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createService } from '@/lib/api';
import { Plus } from 'lucide-react';

const statuses = ['draft', 'published', 'archived'];

interface ServiceFormProps {
  token: string;
  onSuccess?: (service: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function ServiceForm({ token, onSuccess, onCancel, initial }: ServiceFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({
    name: '',
    slug: '',
    description: '',
    category: '',
    status: 'draft',
    is_active: true,
    is_popular: false,
    ...initial,
  });

  const mutation = useMutation({
    mutationFn: () => createService(token, {
      ...form,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
    }),
    onSuccess: (data: any) => {
      toast.success('Service created');
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      onSuccess?.(data?.service ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create service'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>Slug</Label><Input placeholder="auto-generated" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
      <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
      <div><Label>Status</Label>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} /></div>
      <div className="md:col-span-2 flex gap-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_popular} onChange={(e) => setForm({ ...form, is_popular: e.target.checked })} /> Popular</label>
      </div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.name && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Service
        </Button>
      </div>
    </div>
  );
}
