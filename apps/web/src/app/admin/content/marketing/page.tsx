'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, TrendingUp as TrendingUpIcon, Star, Search } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { StatCards } from '@/components/design-system/StatCards';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { fetchMarketingPosts, fetchAdminMarketingStats, updateMarketingPost, deleteMarketingPost } from '@/lib/api';
import type { BlogPost } from '@/types/content';

export default function AdminContentMarketingPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search.trim()) p.search = search.trim();
    if (status !== 'all') p.status = status;
    return p;
  }, [search, status]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-marketing', token, params],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchMarketingPosts(token, params); },
    enabled: !!token,
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-marketing-stats', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminMarketingStats(token); },
    enabled: !!token,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BlogPost> }) => updateMarketingPost(token!, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-marketing'] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteMarketingPost(token!, id),
    onSuccess: () => { toast.success('Marketing post deleted'); queryClient.invalidateQueries({ queryKey: ['admin-marketing'] }); },
  });

  const statCards = [
    { label: 'Total Posts', value: stats?.total ?? 0, icon: TrendingUpIcon },
    { label: 'Published', value: stats?.published ?? 0, icon: TrendingUpIcon, accent: 'success' as const },
    { label: 'Draft', value: stats?.draft ?? 0, icon: TrendingUpIcon, accent: 'warning' as const },
  ];

  const posts = data?.posts ?? [];

  return (
    <PageShell
      title="Marketing Posts"
      icon={TrendingUpIcon}
      actions={
        <Button asChild>
          <Link href="/admin/content/marketing/new"><Plus className="mr-1 h-4 w-4" /> New Post</Link>
        </Button>
      }
    >
      <StatCards cards={statCards} />

      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-3 pt-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search marketing posts..." className="pl-9" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </CardContent>
      </Card>

      <DataTable
        loading={isLoading}
        emptyText="No marketing posts found."
        headers={[
          { key: 'post', label: 'Post' },
          { key: 'status', label: 'Status' },
          { key: 'featured', label: 'Featured' },
          { key: 'actions', label: '', className: 'text-right' },
        ]}
        data={posts}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => router.push(`/admin/content/marketing/${p.id}`)}
        renderRow={(p) => [
          <div key={p.id}>
            <div className="font-medium">{p.title}</div>
            <div className="text-xs text-muted-foreground">/{p.slug}</div>
          </div>,
          <span key="status" className="text-sm capitalize">{p.status}</span>,
          <Button key="featured" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleMutation.mutate({ id: p.id, data: { featured: !p.featured } }); }}>
            {p.featured ? 'Featured' : '—'}
          </Button>,
          <div key="actions" className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" asChild><Link href={`/admin/content/marketing/${p.id}`}>Edit</Link></Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) remove.mutate(p.id); }}>Delete</Button>
          </div>,
        ]}
      />
    </PageShell>
  );
}
