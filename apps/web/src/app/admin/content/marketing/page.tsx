'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Megaphone,
  Plus,
  Calendar,
  Eye,
  PenLine,
  Archive,
  Star,
  Edit3,
  Trash2,
  ImageIcon,
  Tag,
  User,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ContentListPage } from '@/components/content/ContentListPage';
import { MarketingPostForm } from '@/components/content/MarketingPostForm';
import { fetchMarketingPosts, fetchAdminMarketingStats, fetchTeam, updateMarketingPost, deleteMarketingPost } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { BlogPost } from '@clickbit/shared/src/content';
import type { User as TeamUser } from '@/types/crm';
import { toast } from 'sonner';

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'archived', label: 'Archived' },
];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400',
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    archived: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
};

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* empty */ }
    return value ? [value] : [];
  }
  return [];
}

export default function AdminContentMarketingPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [author, setAuthor] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [category, setCategory] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-marketing', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchMarketingPosts(token, { limit: 1000 }); },
    enabled: !!token,
  });

  const { data: statsData } = useQuery({
    queryKey: ['admin-marketing-stats', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminMarketingStats(token); },
    enabled: !!token,
  });

  const { data: team } = useQuery({
    queryKey: ['team', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchTeam(token); },
    enabled: !!token,
  });

  const posts = useMemo(() => data?.posts ?? [], [data]);
  const stats = statsData ?? { total: 0, published: 0, draft: 0 };
  const teamMembers = (team ?? []) as TeamUser[];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-marketing'] });
    queryClient.invalidateQueries({ queryKey: ['admin-marketing-stats'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateMarketingPost(token!, id, { status }),
    onSuccess: () => { toast.success('Post status updated'); invalidate(); },
    onError: () => toast.error('Failed to update post status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMarketingPost(token!, id),
    onSuccess: () => { toast.success('Post deleted'); invalidate(); },
    onError: () => toast.error('Failed to delete post'),
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => asArray(p.categories).forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [posts]);

  const statCards = [
    { label: 'Total Posts', value: stats.total, icon: Megaphone },
    { label: 'Published', value: stats.published, icon: Eye, accent: 'success' as const },
    { label: 'Drafts', value: stats.draft, icon: PenLine, accent: 'warning' as const },
    { label: 'Categories', value: categories.length, icon: Tag, accent: 'secondary' as const },
  ];

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
    (p.slug || '').toLowerCase().includes(q) ||
    (p.author ? `${p.author.first_name} ${p.author.last_name}` : '').toLowerCase().includes(q) ||
    asArray(p.categories).some((c) => c.toLowerCase().includes(q)) ||
    asArray(p.tags).some((t) => t.toLowerCase().includes(q));

  const customFilter = (p: BlogPost) => {
    const authorMatch = !author || String(p.author_id || '') === author;
    const cats = asArray(p.categories);
    const categoryMatch = !category || cats.includes(category) || cats.some((c) => c.toLowerCase() === category.toLowerCase());
    return authorMatch && categoryMatch;
  };

  const handleStatus = (p: BlogPost, status: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (status === p.status) return;
    statusMutation.mutate({ id: p.id, status });
  };

  const handleDelete = (p: BlogPost, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    deleteMutation.mutate(p.id);
  };

  const coverImage = (p: BlogPost) => p.featured_image || undefined;

  const postDate = (p: BlogPost) => p.published_at ? formatDate(p.published_at) : p.scheduled_at ? formatDate(p.scheduled_at) : formatDate(p.created_at);

  const renderGridCard = (p: BlogPost) => (
    <div className="nm-raised rounded-xl overflow-hidden group h-full flex flex-col">
      <div className="h-40 bg-muted nm-inset-sm m-3 rounded-lg overflow-hidden flex items-center justify-center">
        {coverImage(p) ? <img src={coverImage(p)} alt={p.title} className="w-full h-full object-cover" /> : <ImageIcon className="h-10 w-10 text-muted-foreground" />}
      </div>
      <div className="px-5 pb-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold truncate">{p.title}</h3>
            <p className="text-xs text-muted-foreground">/{p.slug}</p>
          </div>
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${statusBadge(p.status)}`}>{p.status}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.excerpt || 'No excerpt.'}</p>
        <div className="flex flex-wrap gap-1 mt-3">
          {asArray(p.categories).slice(0, 3).map((c) => <Badge key={c} variant="secondary" className="text-xs font-normal">{c}</Badge>)}
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {p.author ? `${p.author.first_name} ${p.author.last_name}` : '—'}</span>
          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {postDate(p)}</span>
          <span>{p.view_count ?? 0} views</span>
        </div>
        <div className="flex items-center justify-between mt-auto pt-4" onClick={(e) => e.stopPropagation()}>
          <select value={p.status} onChange={(e) => handleStatus(p, e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
            {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <Link href={`/admin/content/marketing/${p.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Edit3 className="h-4 w-4" /></Link>
            <button type="button" onClick={(e) => handleDelete(p, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTableRow = (p: BlogPost) => [
    <td key="title" className="px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg nm-raised-sm overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
          {coverImage(p) ? <img src={coverImage(p)} alt={p.title} className="w-full h-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate">{p.title}</div>
          <div className="text-xs text-muted-foreground">/{p.slug}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {asArray(p.categories).slice(0, 3).map((c) => <Badge key={c} variant="secondary" className="text-[10px] px-1 py-0">{c}</Badge>)}
          </div>
        </div>
      </div>
    </td>,
    <td key="author" className="px-4 py-4 text-sm text-muted-foreground">{p.author ? `${p.author.first_name} ${p.author.last_name}` : '—'}</td>,
    <td key="status" className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
      <select value={p.status} onChange={(e) => handleStatus(p, e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
        {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </td>,
    <td key="published" className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">{postDate(p)}</td>,
    <td key="views" className="px-4 py-4 text-sm text-muted-foreground">{p.view_count ?? 0}</td>,
    <td key="actions" className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-end gap-1">
        <Link href={`/admin/content/marketing/${p.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Edit3 className="h-4 w-4" /></Link>
        <button type="button" onClick={(e) => handleDelete(p, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
    </td>,
  ];

  return (
    <ContentListPage
      title="Marketing"
      description="Create and manage marketing content."
      icon={Megaphone}
      actions={<Button onClick={() => setCreateOpen(true)} className="gap-1"><Plus className="h-4 w-4" /> New Post</Button>}
      items={posts}
      isLoading={isLoading}
      statCards={statCards}
      searchPlaceholder="Search marketing posts, authors, categories, tags..."
      searchFn={searchFn}
      filterTabs={filterTabs}
      customFilter={customFilter}
      pageSize={10}
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
      tableHeaders={[{ key: 'title', label: 'Post' }, { key: 'author', label: 'Author' }, { key: 'status', label: 'Status' }, { key: 'published', label: 'Published' }, { key: 'views', label: 'Views' }, { key: 'actions', label: '', className: 'text-right' }]}
      renderGridCard={renderGridCard}
      renderTableRow={renderTableRow}
      onRowClick={(p) => router.push(`/admin/content/marketing/${p.id}`)}
      emptyText="No marketing posts found."
      footer={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New Marketing Post</DialogTitle>
              <DialogDescription>Create a marketing update or announcement.</DialogDescription>
            </DialogHeader>
            {token && (
              <MarketingPostForm
                token={token}
                onSuccess={() => { setCreateOpen(false); queryClient.invalidateQueries({ queryKey: ['admin-marketing'] }); }}
                onCancel={() => setCreateOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      }
    />
  );
}
