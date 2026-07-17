'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { uploadDocument } from '@/lib/api';
import { ArrowLeft, FileUp, Plus, Upload } from 'lucide-react';

const accessLevels = ['private', 'internal', 'public'];

export default function AdminNewDocumentPage() {
  const { token } = useAuth();
  const router = useRouter();
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
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!token || !file) throw new Error('Missing file or token');
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
      const id = data?.document?.id || data?.data?.id;
      router.push(id ? `/admin/documents/${id}` : '/admin/documents');
    },
    onError: () => toast.error('Failed to upload document'),
  });

  return (
    <PageShell
      title="Upload Document"
      icon={FileUp}
      description="Upload a new file and set its metadata"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/documents"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Document Upload</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
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
          <div className="md:col-span-2">
            <Button onClick={() => file && mutation.mutate()} disabled={mutation.isPending}>
              <Upload className="mr-2 h-4 w-4" /> Upload Document
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
