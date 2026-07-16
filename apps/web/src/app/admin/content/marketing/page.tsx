'use client';
import { TrendingUp as TrendingUpIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { BlogPost } from '@/types/content';

const api = {
  get: async (url: string, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  },
  post: async (url: string, data: unknown, token?: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  },
  del: async (url: string, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  },
};

export default function AdminContentMarketingPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: '', body: '', status: 'draft' });
  const { data, isLoading } = useQuery({
    queryKey: ['admin-marketing', token],
    queryFn: () => api.get('/api/marketing-posts/admin', token || undefined),
    enabled: !!token,
  });

  const add = useMutation({
    mutationFn: () => api.post('/api/marketing-posts/admin', form, token || undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-marketing', token] }); setForm({ title: '', body: '', status: 'draft' }); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/marketing-posts/admin/${id}`, token || undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-marketing', token] }),
  });

  return (
    <PageShell
      title="Marketing Posts"
      icon={TrendingUpIcon}
    >
      <Card>
        <CardHeader><CardTitle>New Post</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <Button onClick={() => form.title && add.mutate()} disabled={add.isPending}>Add</Button>
        </CardContent>
      </Card>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="divide-y">
          {data?.posts?.map((p: BlogPost) => (
            <div key={p.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="text-sm text-muted-foreground">{p.status}</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => remove.mutate(p.id)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}