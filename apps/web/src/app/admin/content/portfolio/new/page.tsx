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
import { createPortfolioItem } from '@/lib/api';
import { ArrowLeft, Plus, FolderKanban } from 'lucide-react';

const statuses = ['draft', 'published', 'archived'];

export default function AdminNewPortfolioPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({
    title: '',
    slug: '',
    description: '',
    short_description: '',
    client_name: '',
    project_url: '',
    project_date: '',
    category: '',
    status: 'draft',
    featured: false,
    sort_order: 0,
    meta_title: '',
    meta_description: '',
  });

  const mutation = useMutation({
    mutationFn: () => createPortfolioItem(token!, {
      ...form,
      slug: form.slug || form.title.toLowerCase().replace(/\s+/g, '-'),
      project_date: form.project_date || undefined,
      sort_order: Number(form.sort_order) || 0,
    }),
    onSuccess: () => {
      toast.success('Portfolio item created');
      queryClient.invalidateQueries({ queryKey: ['admin-portfolio'] });
      router.push('/admin/content/portfolio');
    },
    onError: () => toast.error('Failed to create portfolio item'),
  });

  return (
    <PageShell
      title="New Portfolio Item"
      icon={FolderKanban}
      description="Add a project to the portfolio"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/content/portfolio"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Slug</Label><Input placeholder="auto-generated" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
          <div><Label>Client name</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
          <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div><Label>Status</Label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><Label>Project date</Label><Input type="date" value={form.project_date} onChange={(e) => setForm({ ...form, project_date: e.target.value })} /></div>
          <div><Label>Project URL</Label><Input value={form.project_url} onChange={(e) => setForm({ ...form, project_url: e.target.value })} /></div>
          <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Short description</Label><Textarea value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} rows={2} /></div>
          <div className="md:col-span-2"><Label>Full description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} /></div>
          <div><Label>Meta title</Label><Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} /></div>
          <div><Label>Meta description</Label><Input value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} /></div>
          <div className="md:col-span-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => form.title && mutation.mutate()} disabled={mutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Create Portfolio Item
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
