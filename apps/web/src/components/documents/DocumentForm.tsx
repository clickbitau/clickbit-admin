'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { uploadDocument } from '@/lib/api';

import { Upload } from 'lucide-react';

const accessLevels = ['private', 'internal', 'public'];

interface DocumentFormProps {
  token: string;
  onSuccess?: (document: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function DocumentForm({ token, onSuccess, onCancel, initial }: DocumentFormProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    document_type: '',
    category: '',
    access_level: 'private',
    is_sensitive: false,
    is_public: false,
    related_entity_type: '',
    related_entity_id: '',
    tags: '',
    expires_at: '',
    ...(initial || {}),
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Missing file');
      const fd = new FormData();
      fd.append('file', file);
      Object.entries(form).forEach(([key, value]) => {
        if (value !== '' && value !== false && value !== undefined) fd.append(key, String(value));
      });
      return uploadDocument(token, fd);
    },
    onSuccess: (data: any) => {
      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      onSuccess?.(data?.document ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to upload document'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>File</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
      <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div><Label>Document type</Label><Input value={form.document_type} onChange={(e) => setForm({ ...form, document_type: e.target.value })} placeholder="contract, invoice, etc." /></div>
      <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
      <div><Label>Access level</Label>
        <select value={form.access_level} onChange={(e) => setForm({ ...form, access_level: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {accessLevels.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div><Label>Related entity type</Label><Input value={form.related_entity_type} onChange={(e) => setForm({ ...form, related_entity_type: e.target.value })} placeholder="employee, project, ticket..." /></div>
      <div><Label>Related entity ID</Label><Input value={form.related_entity_id} onChange={(e) => setForm({ ...form, related_entity_id: e.target.value })} /></div>
      <div><Label>Tags</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="comma separated" /></div>
      <div><Label>Expires at</Label><Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></div>
      <div className="flex flex-wrap gap-4 md:col-span-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_sensitive} onChange={(e) => setForm({ ...form, is_sensitive: e.target.checked })} id="sensitive" /> Sensitive</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} id="public" /> Public</label>
      </div>
      <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => file && mutation.mutate()} disabled={mutation.isPending}>
          <Upload className="mr-2 h-4 w-4" /> Upload Document
        </Button>
      </div>
    </div>
  );
}
