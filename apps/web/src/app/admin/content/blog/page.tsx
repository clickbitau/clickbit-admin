'use client';
import Link from 'next/link';
import { BookOpen as BookOpenIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAdminBlogPosts, createBlogPost, deleteBlogPost } from '@/lib/api';
import type { BlogPost } from '@/types/content';

export default function AdminContentBlogPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: '', content: '', status: 'draft' });
  const { data, isLoading } = useQuery({ queryKey: ['admin-blog', token], queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminBlogPosts(token); }, enabled: !!token });

  const add = useMutation({
    mutationFn: () => createBlogPost(token!, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-blog', token] }); setForm({ title: '', content: '', status: 'draft' }); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteBlogPost(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-blog', token] }),
  });

  return (
    <PageShell
      title="Blog"
      icon={BookOpenIcon}
    >
      <Card>
        <CardHeader><CardTitle>New Post</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
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
                <Link href={`/admin/content/blog/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
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