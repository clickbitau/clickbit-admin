'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createNote } from '@/lib/crm-api';
import { Plus } from 'lucide-react';

const noteTypes = ['general', 'meeting', 'call', 'email', 'follow_up', 'system'];

interface NoteFormProps {
  token: string;
  onSuccess?: (note: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function NoteForm({ token, onSuccess, onCancel, initial }: NoteFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({
    content: '',
    note_type: 'general',
    contact_id: undefined,
    company_id: undefined,
    deal_id: undefined,
    activity_id: undefined,
    is_pinned: false,
    is_private: false,
    ...initial,
  });

  const mutation = useMutation({
    mutationFn: () => createNote(token, {
      ...form,
      contact_id: form.contact_id ? Number(form.contact_id) : undefined,
      company_id: form.company_id ? Number(form.company_id) : undefined,
      deal_id: form.deal_id ? Number(form.deal_id) : undefined,
      activity_id: form.activity_id ? Number(form.activity_id) : undefined,
    }),
    onSuccess: (data: any) => {
      toast.success('Note created');
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      onSuccess?.(data?.note ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create note'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Content</Label><Textarea value={form.content || ''} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} /></div>
      <div><Label>Note type</Label>
        <select value={form.note_type || 'general'} onChange={(e) => setForm({ ...form, note_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {noteTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div><Label>Contact ID</Label><Input type="number" value={form.contact_id || ''} onChange={(e) => setForm({ ...form, contact_id: e.target.value ? Number(e.target.value) : undefined })} /></div>
      <div><Label>Company ID</Label><Input type="number" value={form.company_id || ''} onChange={(e) => setForm({ ...form, company_id: e.target.value ? Number(e.target.value) : undefined })} /></div>
      <div><Label>Deal ID</Label><Input type="number" value={form.deal_id || ''} onChange={(e) => setForm({ ...form, deal_id: e.target.value ? Number(e.target.value) : undefined })} /></div>
      <div><Label>Activity ID</Label><Input type="number" value={form.activity_id || ''} onChange={(e) => setForm({ ...form, activity_id: e.target.value ? Number(e.target.value) : undefined })} /></div>
      <div className="flex flex-wrap gap-4 md:col-span-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} /> Pinned</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.is_private} onChange={(e) => setForm({ ...form, is_private: e.target.checked })} /> Private</label>
      </div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.content && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Note
        </Button>
      </div>
    </div>
  );
}
