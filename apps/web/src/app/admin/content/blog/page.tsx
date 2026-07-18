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
  Edit3,
  Trash2,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Tag,
  User,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { ContentListPage } from '@/components/content/ContentListPage';
import { fetchAdminBlogPosts, fetchAdminBlogStats, fetchTeam, updateBlogPost, deleteBlogPost } from '@/lib/api';
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

function getPostDate(post: BlogPost): string | null {
  const raw = post.published_at || post.scheduled_at || post.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function BlogCalendar({ posts }: { posts: BlogPost[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const today = useMemo(() => new Date(), []);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const postDates = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => { const d = getPostDate(p); if (d) set.add(d); });
    return set;
  }, [posts]);

  const months = useMemo(() => {
    const list: Date[] = [];
    for (let i = -2; i <= 2; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i + monthOffset, 1);
      list.push(d);
    }
    return list;
  }, [monthOffset, today]);

  const canLeft = months[0].getFullYear() > 2024 || (months[0].getFullYear() === 2024 && months[0].getMonth() > 0);
  const canRight = monthOffset < 12;

  return (
    <div className="nm-raised rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Calendar</h3>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMonthOffset((o) => o - 1)} disabled={!canLeft} className="p-2 rounded-md nm-inset-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setMonthOffset((o) => o + 1)} disabled={!canRight} className="p-2 rounded-md nm-inset-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 min-w-max lg:min-w-0">
          {months.map((monthDate, idx) => {
            const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
            const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
            const isCurrentMonth = monthDate.getMonth() === today.getMonth() && monthDate.getFullYear() === today.getFullYear();
            return (
              <div key={idx} className="min-w-[180px]">
                <div className={`text-center font-semibold mb-2 p-2 rounded ${isCurrentMonth ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                  {monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}
                </div>
                <div className="grid grid-cols-7 gap-1 text-xs">
                  {dayNames.map((d) => <div key={d} className="text-center font-medium text-muted-foreground py-1">{d.charAt(0)}</div>)}
                  {Array.from({ length: firstDay }, (_, i) => <div key={`empty-${i}`} className="aspect-square" />)}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const isToday = isCurrentMonth && day === today.getDate();
                    const dateString = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const hasPost = postDates.has(dateString);
                    return (
                      <div
                        key={day}
                        className={`aspect-square flex items-center justify-center text-xs rounded ${isToday ? 'bg-primary text-primary-foreground font-bold' : hasPost ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 font-semibold hover:bg-emerald-200 dark:hover:bg-emerald-800' : 'text-foreground hover:bg-muted'}`}
                        title={hasPost ? 'Has blog post(s)' : ''}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
  const teamMembers = (team ?? []) as TeamUser[];

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

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => asArray(p.categories).forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [posts]);

  const statCards = [
    { label: 'Total Posts', value: stats.total, icon: BookOpen },
    { label: 'Published', value: stats.published, icon: Eye, accent: 'success' as const },
    { label: 'Drafts', value: stats.draft, icon: PenLine, accent: 'warning' as const },
    { label: 'Scheduled', value: stats.scheduled, icon: Calendar, accent: 'primary' as const },
    { label: 'Archived', value: stats.archived, icon: Archive, accent: 'secondary' as const },
    { label: 'Featured', value: stats.featured, icon: Star, accent: 'destructive' as const },
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
            <Link href={`/admin/content/blog/${p.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Edit3 className="h-4 w-4" /></Link>
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
        <Link href={`/admin/content/blog/${p.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Edit3 className="h-4 w-4" /></Link>
        <button type="button" onClick={(e) => handleDelete(p, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
    </td>,
  ];

  return (
    <ContentListPage
      title="Blog"
      description="Create, schedule, and manage blog articles."
      icon={BookOpen}
      newHref="/admin/content/blog/new"
      newLabel="New Post"
      items={posts}
      isLoading={isLoading}
      statCards={statCards}
      searchPlaceholder="Search posts, authors, categories, tags..."
      searchFn={searchFn}
      filterTabs={filterTabs}
      customFilter={customFilter}
      pageSize={10}
      topSection={<BlogCalendar posts={posts} />}
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
      tableHeaders={[{ key: 'title', label: 'Post' }, { key: 'author', label: 'Author' }, { key: 'status', label: 'Status' }, { key: 'published', label: 'Published / Scheduled' }, { key: 'views', label: 'Views' }, { key: 'actions', label: '', className: 'text-right' }]}
      renderGridCard={renderGridCard}
      renderTableRow={renderTableRow}
      onRowClick={(p) => router.push(`/admin/content/blog/${p.id}`)}
      emptyText="No blog posts found."
    />
  );
}
