'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createMarketingPost } from '@/lib/api';
import { Plus } from 'lucide-react';

const statuses = ['draft', 'published'];

interface MarketingPostFormProps {
  token: string;
  onSuccess?: (post: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function MarketingPostForm({ token, onSuccess, onCancel, initial }: MarketingPostFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({
    title: '',
    body: '',
    status: 'draft',
    excerpt: '',
    ...initial,
  });

  const mutation = useMutation({
    mutationFn: () => createMarketingPost(token, form),
    onSuccess: (data: any) => {
      toast.success('Marketing post created');
      queryClient.invalidateQueries({ queryKey: ['admin-marketing'] });
      onSuccess?.(data?.post ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create marketing post'),
  });

  return (
    <div className="grid gap-4">
      <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div><Label>Excerpt</Label><Input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></div>
      <div><Label>Body</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} /></div>
      <div><Label>Status</Label>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.title && form.body && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Post
        </Button>
      </div>
    </div>
  );
}
