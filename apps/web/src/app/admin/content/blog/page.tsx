'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Eye,
  PenLine,
  Archive,
  Star,
  CheckCircle,
  Edit3,
  Trash2,
  ImageIcon,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ContentListPage } from '@/components/content/ContentListPage';
import { fetchAdminBlogPosts, fetchAdminBlogStats, fetchTeam, updateBlogPost, deleteBlogPost } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { BlogPost } from '@clickbit/shared/src/content';
import type { User } from '@/types/crm';
import { toast } from 'sonner';

const statusBadge = (status: string) => {
  switch (status) {
    case 'published': return <Badge variant="default">Published</Badge>;
    case 'draft': return <Badge variant="secondary">Draft</Badge>;
    case 'scheduled': return <Badge variant="outline" className="text-blue-600">Scheduled</Badge>;
    case 'archived': return <Badge variant="outline">Archived</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export default function AdminContentBlogPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-blog', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminBlogPosts(token, { limit: 1000 }); },
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

  const posts = useMemo(() => data?.posts ?? [], [data]);
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
    onSuccess: () => { toast.success('Post deleted'); invalidate(); },
    onError: () => toast.error('Failed to delete post'),
  });

  const statCards = [
    { label: 'Total', value: stats.total, icon: BookOpen },
    { label: 'Published', value: stats.published, icon: Eye, accent: 'success' as const },
    { label: 'Drafts', value: stats.draft, icon: PenLine, accent: 'warning' as const },
    { label: 'Scheduled', value: stats.scheduled, icon: Calendar, accent: 'primary' as const },
    { label: 'Archived', value: stats.archived, icon: Archive, accent: 'secondary' as const },
    { label: 'Featured', value: stats.featured, icon: Star, accent: 'destructive' as const },
  ];

  const teamMembers = (team ?? []) as User[];
  const categories = useMemo(() => Array.from(new Set(posts.map((p) => (p.categories as string[] | undefined)?.[0]).filter(Boolean) as string[])).sort(), [posts]);

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

  const filterTabs = [
    { id: 'all', label: 'All', filter: () => true },
    { id: 'published', label: 'Published', filter: (p: BlogPost) => p.status === 'published', activeClassName: 'bg-emerald-600 text-white' },
    { id: 'draft', label: 'Draft', filter: (p: BlogPost) => p.status === 'draft', activeClassName: 'bg-gray-600 text-white' },
    { id: 'scheduled', label: 'Scheduled', filter: (p: BlogPost) => p.status === 'scheduled', activeClassName: 'bg-blue-600 text-white' },
    { id: 'archived', label: 'Archived', filter: (p: BlogPost) => p.status === 'archived', activeClassName: 'bg-amber-600 text-white' },
    { id: 'featured', label: 'Featured', filter: (p: BlogPost) => !!p.featured, activeClassName: 'bg-yellow-500 text-white' },
  ];

  const searchFn = (p: BlogPost, q: string) =>
    (p.title || '').toLowerCase().includes(q) ||
    (p.excerpt || '').toLowerCase().includes(q) ||
    (p.author ? `${p.author.first_name} ${p.author.last_name}` : '').toLowerCase().includes(q);

  const customFilter = (p: BlogPost) => {
    const authorMatch = !author || String(p.author_id || '') === author;
    const categoryMatch = !category || ((p.categories as string[] | undefined) ?? []).includes(category);
    return authorMatch && categoryMatch;
  };

  const handleStatus = (p: BlogPost, e: React.MouseEvent) => {
    e.stopPropagation();
    statusMutation.mutate({ id: p.id, status: nextStatus(p.status) });
  };

  const handleDelete = (p: BlogPost, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    deleteMutation.mutate(p.id);
  };

  const renderGridCard = (p: BlogPost) => (
    <div className="nm-raised rounded-xl overflow-hidden group">
      <div className="h-32 bg-muted nm-inset-sm m-3 rounded-lg overflow-hidden flex items-center justify-center">
        {p.featured_image ? <img src={p.featured_image} alt={p.title} className="w-full h-full object-cover" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
      </div>
      <div className="px-5 pb-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold truncate">{p.title}</h3>
            <p className="text-xs text-muted-foreground">/{p.slug}</p>
          </div>
          {statusBadge(p.status)}
        </div>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.excerpt || 'No excerpt'}</p>
        <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted-foreground">
          <span>{p.author ? `${p.author.first_name} ${p.author.last_name}` : '—'}</span>
          <span>•</span>
          <span>{p.published_at ? formatDate(p.published_at) : p.scheduled_at ? formatDate(p.scheduled_at) : '—'}</span>
          <span>•</span>
          <span>{p.view_count ?? 0} views</span>
        </div>
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: p.id, status: nextStatus(p.status) }); }}
            disabled={statusMutation.isPending}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all"
          >
            <CheckCircle className="h-3.5 w-3.5" /> {statusActionLabel(p.status)}
          </button>
          <div className="flex items-center gap-1">
            <Link href={`/admin/content/blog/${p.id}`} onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-all"><Edit3 className="h-4 w-4" /></Link>
            <button type="button" onClick={(e) => handleDelete(p, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-all"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTableRow = (p: BlogPost) => [
    <td key="title" className="px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg nm-raised-sm overflow-hidden bg-muted flex items-center justify-center">
          {p.featured_image ? <img src={p.featured_image} alt={p.title} className="w-full h-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div>
          <div className="font-medium">{p.title}</div>
          <div className="text-xs text-muted-foreground">/{p.slug}</div>
        </div>
      </div>
    </td>,
    <td key="author" className="px-4 py-4 text-sm text-muted-foreground">{p.author ? `${p.author.first_name} ${p.author.last_name}` : '—'}</td>,
    <td key="status" className="px-4 py-4">{statusBadge(p.status)}</td>,
    <td key="published" className="px-4 py-4 text-sm text-muted-foreground">{p.published_at ? formatDate(p.published_at) : p.scheduled_at ? formatDate(p.scheduled_at) : '—'}</td>,
    <td key="views" className="px-4 py-4 text-sm text-muted-foreground">{p.view_count ?? 0}</td>,
    <td key="actions" className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-end gap-1">
        <button type="button" onClick={(e) => handleStatus(p, e)} className="p-1.5 rounded-md text-primary hover:bg-primary/10" title={statusActionLabel(p.status)}><CheckCircle className="h-4 w-4" /></button>
        <Link href={`/admin/content/blog/${p.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Edit3 className="h-4 w-4" /></Link>
        <button type="button" onClick={(e) => handleDelete(p, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
    </td>,
  ];

  return (
    <ContentListPage
      title="Blog"
      icon={BookOpen}
      description="Create, schedule, and manage blog articles."
      newHref="/admin/content/blog/new"
      newLabel="New Post"
      items={posts}
      isLoading={isLoading}
      statCards={statCards}
      searchPlaceholder="Search posts..."
      searchFn={searchFn}
      filterTabs={filterTabs}
      customFilter={customFilter}
      headerChildren={
        <>
          <select value={author} onChange={(e) => setAuthor(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">All authors</option>
            {teamMembers.map((u) => (<option key={u.id} value={String(u.id)}>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}</option>))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">All categories</option>
            {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </>
      }
      tableHeaders={[{ key: 'title', label: 'Title' }, { key: 'author', label: 'Author' }, { key: 'status', label: 'Status' }, { key: 'published', label: 'Published / Scheduled' }, { key: 'views', label: 'Views' }, { key: 'actions', label: '', className: 'text-right' }]}
      renderGridCard={renderGridCard}
      renderTableRow={renderTableRow}
      onRowClick={(p) => router.push(`/admin/content/blog/${p.id}`)}
      emptyText="No blog posts found."
    />
  );
}
