'use client';

import Link from 'next/link';
import { Plus, BookOpen as BookOpenIcon, Eye, PenLine, Calendar } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchAdminBlogPosts, fetchAdminBlogStats } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { BlogPost } from '@/types/content';

const statusOptions = ['', 'draft', 'published', 'scheduled', 'archived'];
const limit = 25;

export default function AdminContentBlogPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-blog', token, page, search, status],
    queryFn: () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { limit, offset: (page - 1) * limit };
      if (search) params.search = search;
      if (status) params.status = status;
      return fetchAdminBlogPosts(token, params);
    },
    enabled: !!token,
  });

  const { data: statsData } = useQuery({
    queryKey: ['admin-blog-stats', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminBlogStats(token); },
    enabled: !!token,
  });

  const posts = data?.posts ?? [];
  const pagination = data?.pagination ?? { total: 0, limit, offset: 0, hasMore: false };
  const totalPages = Math.max(1, Math.ceil(pagination.total / limit));
  const stats = statsData ?? { total: 0, published: 0, draft: 0, featured: 0 };

  const statCards = [
    { label: 'Total', value: stats.total, icon: BookOpenIcon },
    { label: 'Published', value: stats.published, icon: Eye, accent: 'success' as const, onClick: () => { setStatus('published'); setPage(1); } },
    { label: 'Drafts', value: stats.draft, icon: PenLine, accent: 'warning' as const, onClick: () => { setStatus('draft'); setPage(1); } },
    { label: 'Featured', value: stats.featured, icon: Calendar, accent: 'primary' as const, onClick: () => { setStatus(''); setPage(1); } },
  ];

  const statusBadge = (status: string) => {
    if (status === 'published') return <Badge variant="default">Published</Badge>;
    if (status === 'draft') return <Badge variant="secondary">Draft</Badge>;
    if (status === 'scheduled') return <Badge variant="outline">Scheduled</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <PageShell
      title="Blog"
      icon={BookOpenIcon}
      description="Create, schedule, and manage blog articles."
      actions={<Button asChild><Link href="/admin/content/blog/new"><Plus className="mr-1 h-4 w-4" /> New Post</Link></Button>}
    >
      <StatCards cards={statCards} />

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            placeholder="Search posts..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="max-w-sm"
          />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {statusOptions.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All statuses'}</option>)}
          </select>
        </CardContent>
      </Card>

      <DataTable<BlogPost>
        headers={[{ key: 'title', label: 'Title' }, { key: 'author', label: 'Author' }, { key: 'status', label: 'Status' }, { key: 'published', label: 'Published' }, { key: 'views', label: 'Views' }]}
        data={posts}
        loading={isLoading}
        emptyText="No blog posts found."
        keyExtractor={(p) => p.id}
        onRowClick={(p) => router.push(`/admin/content/blog/${p.id}`)}
        renderRow={(p) => [
          <div key="title">
            <p className="font-medium">{p.title}</p>
            <p className="text-xs text-muted-foreground">/{p.slug}</p>
          </div>,
          <span key="author" className="text-sm text-muted-foreground">{p.author ? `${p.author.first_name} ${p.author.last_name}` : '—'}</span>,
          <div key="status">{statusBadge(p.status)}</div>,
          <span key="published" className="text-sm text-muted-foreground">{p.published_at ? formatDate(p.published_at) : '—'}</span>,
          <span key="views" className="text-sm text-muted-foreground">{p.view_count ?? 0}</span>,
        ]}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={pagination.total}
        onPageChange={setPage}
      />
    </PageShell>
  );
}
