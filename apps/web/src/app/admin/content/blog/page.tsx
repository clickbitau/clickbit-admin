'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Plus,
  BookOpen as BookOpenIcon,
  Eye,
  PenLine,
  Calendar,
  Archive,
  Trash2,
  CheckCircle,
  Star,
  Edit3,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { ConfirmDialog } from '@/components/design-system/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCards } from '@/components/design-system/StatCards';
import {
  fetchAdminBlogPosts,
  fetchAdminBlogStats,
  fetchTeam,
  updateBlogPost,
  deleteBlogPost,
} from '@/lib/api';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import type { BlogPost } from '@/types/content';
import type { User } from '@/types/crm';

const statusOptions = ['', 'draft', 'published', 'scheduled', 'archived'];
const limit = 25;

export default function AdminContentBlogPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<BlogPost | null>(null);

  const params: Record<string, string | number> = { limit, offset: (page - 1) * limit };
  if (search) params.search = search;
  if (status) params.status = status;
  if (author) params.author = author;
  if (category) params.category = category;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-blog', token, page, search, status, author, category],
    queryFn: () => {
      if (!token) throw new Error('No token');
      return fetchAdminBlogPosts(token, params);
    },
    enabled: !!token,
  });

  const { data: statsData } = useQuery({
    queryKey: ['admin-blog-stats', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminBlogStats(token); },
    enabled: !!token,
  });

  const { data: team } = useQuery({
    queryKey: ['team', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchTeam(token); },
    enabled: !!token,
  });

  const posts = data?.posts ?? [];
  const pagination = data?.pagination ?? { total: 0, limit, offset: 0, hasMore: false };
  const totalPages = Math.max(1, Math.ceil(pagination.total / limit));
  const stats = statsData ?? { total: 0, published: 0, draft: 0, scheduled: 0, archived: 0, featured: 0 };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-blog'] });
    queryClient.invalidateQueries({ queryKey: ['admin-blog-stats'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateBlogPost(token!, id, { status }),
    onSuccess: () => { toast.success('Post status updated'); invalidate(); },
    onError: () => toast.error('Failed to update post status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBlogPost(token!, id),
    onSuccess: () => { toast.success('Post deleted'); setDeleting(null); invalidate(); },
    onError: () => toast.error('Failed to delete post'),
  });

  const statCards = [
    { label: 'Total', value: stats.total, icon: BookOpenIcon },
    { label: 'Published', value: stats.published, icon: Eye, accent: 'success' as const, onClick: () => { setStatus('published'); setPage(1); } },
    { label: 'Drafts', value: stats.draft, icon: PenLine, accent: 'warning' as const, onClick: () => { setStatus('draft'); setPage(1); } },
    { label: 'Scheduled', value: stats.scheduled, icon: Calendar, accent: 'primary' as const, onClick: () => { setStatus('scheduled'); setPage(1); } },
    { label: 'Archived', value: stats.archived, icon: Archive, accent: 'secondary' as const, onClick: () => { setStatus('archived'); setPage(1); } },
    { label: 'Featured', value: stats.featured, icon: Star, accent: 'destructive' as const, onClick: () => { setStatus(''); setPage(1); } },
  ];

  const statusBadge = (status: string) => {
    if (status === 'published') return <Badge variant="default">Published</Badge>;
    if (status === 'draft') return <Badge variant="secondary">Draft</Badge>;
    if (status === 'scheduled') return <Badge variant="outline" className="text-blue-600">Scheduled</Badge>;
    if (status === 'archived') return <Badge variant="outline">Archived</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const nextStatus = (current: string) => {
    if (current === 'draft' || current === 'scheduled') return 'published';
    if (current === 'published') return 'archived';
    if (current === 'archived') return 'published';
    return 'published';
  };

  const statusActionLabel = (current: string) => {
    if (current === 'draft' || current === 'scheduled' || current === 'archived') return 'Publish';
    return 'Archive';
  };

  const teamMembers = (team ?? []) as User[];

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
          <select
            value={author}
            onChange={(e) => { setAuthor(e.target.value); setPage(1); }}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All authors</option>
            {teamMembers.map((u) => (
              <option key={u.id} value={u.id}>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}</option>
            ))}
          </select>
          <Input
            placeholder="Category..."
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="max-w-xs"
          />
        </CardContent>
      </Card>

      <DataTable<BlogPost>
        headers={[{ key: 'title', label: 'Title' }, { key: 'author', label: 'Author' }, { key: 'status', label: 'Status' }, { key: 'published', label: 'Published / Scheduled' }, { key: 'views', label: 'Views' }, { key: 'actions', label: '' }]}
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
          <span key="published" className="text-sm text-muted-foreground">
            {p.published_at ? formatDate(p.published_at) : p.scheduled_at ? formatDate(p.scheduled_at) : '—'}
          </span>,
          <span key="views" className="text-sm text-muted-foreground">{p.view_count ?? 0}</span>,
          <div key="actions" className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); router.push(`/admin/content/blog/${p.id}`); }} title="Edit">
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: p.id, status: nextStatus(p.status) }); }} title={statusActionLabel(p.status)}>
              <CheckCircle className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleting(p); }} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>,
        ]}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={pagination.total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete blog post"
        description={deleting ? `Delete "${deleting.title}"? This cannot be undone.` : ''}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Delete"
      />
    </PageShell>
  );
}
