'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FolderKanban as FolderKanbanIcon, Star, Search } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { StatCards } from '@/components/design-system/StatCards';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { fetchAdminPortfolio, fetchAdminPortfolioStats, updatePortfolioItem, deletePortfolioItem } from '@/lib/api';
import type { PortfolioItem } from '@/types/content';

export default function AdminContentPortfolioPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search.trim()) p.search = search.trim();
    if (status !== 'all') p.status = status;
    if (category !== 'all') p.category = category;
    return p;
  }, [search, status, category]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-portfolio', token, params],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminPortfolio(token, params); },
    enabled: !!token,
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-portfolio-stats', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminPortfolioStats(token); },
    enabled: !!token,
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    data?.items?.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [data]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PortfolioItem> }) => updatePortfolioItem(token!, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-portfolio'] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deletePortfolioItem(token!, id),
    onSuccess: () => { toast.success('Portfolio item deleted'); queryClient.invalidateQueries({ queryKey: ['admin-portfolio'] }); },
  });

  const statCards = [
    { label: 'Total Items', value: stats?.total ?? 0, icon: FolderKanbanIcon },
    { label: 'Published', value: stats?.published ?? 0, icon: FolderKanbanIcon, accent: 'success' as const },
    { label: 'Draft', value: stats?.draft ?? 0, icon: FolderKanbanIcon, accent: 'warning' as const },
    { label: 'Featured', value: stats?.featured ?? 0, icon: Star, accent: 'warning' as const },
  ];

  return (
    <PageShell
      title="Portfolio"
      icon={FolderKanbanIcon}
      actions={
        <Button asChild>
          <Link href="/admin/content/portfolio/new"><Plus className="mr-1 h-4 w-4" /> New Item</Link>
        </Button>
      }
    >
      <StatCards cards={statCards} />

      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-3 pt-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search portfolio..." className="pl-9" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </CardContent>
      </Card>

      <DataTable
        loading={isLoading}
        emptyText="No portfolio items found."
        headers={[
          { key: 'item', label: 'Item' },
          { key: 'category', label: 'Category' },
          { key: 'status', label: 'Status' },
          { key: 'featured', label: 'Featured' },
          { key: 'actions', label: '', className: 'text-right' },
        ]}
        data={data?.items ?? []}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => router.push(`/admin/content/portfolio/${p.id}`)}
        renderRow={(p) => [
          <div key={p.id}>
            <div className="font-medium">{p.title}</div>
            <div className="text-xs text-muted-foreground">{p.client_name || 'No client'} &middot; /{p.slug}</div>
          </div>,
          <span key="cat" className="text-sm">{p.category || '—'}</span>,
          <span key="status" className="text-sm capitalize">{p.status}</span>,
          <Button key="featured" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleMutation.mutate({ id: p.id, data: { featured: !p.featured } }); }}>
            {p.featured ? 'Featured' : '—'}
          </Button>,
          <div key="actions" className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" asChild><Link href={`/admin/content/portfolio/${p.id}`}>Edit</Link></Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) remove.mutate(p.id); }}>Delete</Button>
          </div>,
        ]}
      />
    </PageShell>
  );
}
