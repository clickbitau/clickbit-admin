'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createBlogPost, uploadContentImage } from '@/lib/api';
import { Plus } from 'lucide-react';

const statuses = ['draft', 'published', 'scheduled'];

interface BlogPostFormProps {
  token: string;
  onSuccess?: (post: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function BlogPostForm({ token, onSuccess, onCancel, initial }: BlogPostFormProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    status: 'draft',
    featured: false,
    allow_comments: false,
    meta_title: '',
    meta_description: '',
    scheduled_at: '',
    published_at: '',
    featured_image: '',
    ...initial,
  });

  const mutation = useMutation({
    mutationFn: () => createBlogPost(token, {
      ...form,
      scheduled_at: form.scheduled_at || undefined,
      published_at: form.published_at || undefined,
      slug: form.slug || form.title.toLowerCase().replace(/\s+/g, '-'),
    }),
    onSuccess: (data: any) => {
      toast.success('Blog post created');
      queryClient.invalidateQueries({ queryKey: ['admin-blog'] });
      onSuccess?.(data?.post ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create blog post'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div><Label>Slug</Label><Input placeholder="auto-generated from title" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
      <div><Label>Status</Label>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="md:col-span-2"><Label>Excerpt</Label><Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} /></div>
      <div className="md:col-span-2"><Label>Content</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} /></div>
      <div className="md:col-span-2 space-y-2">
        <Label>Featured image</Label>
        <Input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !token) return;
            setUploading(true);
            try {
              const result = await uploadContentImage(token, 'blog', file, form.featured_image || undefined);
              setForm({ ...form, featured_image: result.imageUrl });
              toast.success('Featured image uploaded');
            } catch (err: any) {
              toast.error(err?.response?.data?.message || 'Upload failed');
            } finally {
              setUploading(false);
            }
          }}
        />
        {form.featured_image && <img src={form.featured_image} alt="Featured" className="max-h-40 rounded-md object-cover" />}
      </div>
      <div><Label>Meta title</Label><Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} /></div>
      <div><Label>Meta description</Label><Input value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} /></div>
      <div><Label>Published at</Label><Input type="datetime-local" value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} /></div>
      <div><Label>Scheduled at</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
      <div className="md:col-span-2 flex gap-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allow_comments} onChange={(e) => setForm({ ...form, allow_comments: e.target.checked })} /> Allow comments</label>
      </div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.title && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Post
        </Button>
      </div>
    </div>
  );
}
