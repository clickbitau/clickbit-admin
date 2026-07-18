'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FolderKanban,
  Star,
  Globe,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Calendar,
  ImageIcon,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { ContentListPage } from '@/components/content/ContentListPage';
import { fetchAdminPortfolio, fetchAdminPortfolioStats, updatePortfolioItem, deletePortfolioItem } from '@/lib/api';
import type { PortfolioItem } from '@clickbit/shared/src/content';
import { toast } from 'sonner';

const statusBadge = (status?: string | null) => {
  const map: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400',
    archived: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  };
  return map[status || ''] || 'bg-gray-100 text-gray-700';
};

export default function AdminContentPortfolioPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-portfolio', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminPortfolio(token); },
    enabled: !!token,
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-portfolio-stats', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminPortfolioStats(token); },
    enabled: !!token,
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  const categories = useMemo(() => Array.from(new Set(items.map((p) => p.category).filter(Boolean) as string[])).sort(), [items]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PortfolioItem> }) => updatePortfolioItem(token!, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-portfolio'] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deletePortfolioItem(token!, id),
    onSuccess: () => { toast.success('Portfolio item deleted'); queryClient.invalidateQueries({ queryKey: ['admin-portfolio'] }); },
  });

  const statCards = [
    { label: 'Total Items', value: stats?.total ?? 0, icon: FolderKanban },
    { label: 'Published', value: stats?.published ?? 0, icon: CheckCircle2, accent: 'success' as const },
    { label: 'Draft', value: stats?.draft ?? 0, icon: XCircle, accent: 'warning' as const },
    { label: 'Featured', value: stats?.featured ?? 0, icon: Star, accent: 'primary' as const },
  ];

  const filterTabs = [
    { id: 'all', label: 'All', filter: () => true },
    { id: 'published', label: 'Published', filter: (p: PortfolioItem) => p.status === 'published', activeClassName: 'bg-emerald-600 text-white' },
    { id: 'draft', label: 'Draft', filter: (p: PortfolioItem) => p.status === 'draft', activeClassName: 'bg-gray-600 text-white' },
    { id: 'archived', label: 'Archived', filter: (p: PortfolioItem) => p.status === 'archived', activeClassName: 'bg-amber-600 text-white' },
    { id: 'featured', label: 'Featured', filter: (p: PortfolioItem) => !!p.featured, activeClassName: 'bg-yellow-500 text-white' },
    ...categories.map((cat) => ({ id: `cat-${cat}`, label: cat, filter: (p: PortfolioItem) => p.category === cat })),
  ];

  const searchFn = (p: PortfolioItem, q: string) =>
    (p.title || '').toLowerCase().includes(q) ||
    (p.client_name || '').toLowerCase().includes(q) ||
    (p.category || '').toLowerCase().includes(q);

  const toggleFeatured = (p: PortfolioItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    toggleMutation.mutate({ id: p.id, data: { featured: !p.featured } });
  };

  const handleDelete = (p: PortfolioItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('Delete this portfolio item?')) return;
    remove.mutate(p.id);
  };

  const renderGridCard = (p: PortfolioItem) => (
    <div className="nm-raised rounded-xl overflow-hidden group">
      <div className="h-32 bg-muted nm-inset-sm m-3 rounded-lg overflow-hidden flex items-center justify-center">
        {p.featured_image ? <img src={p.featured_image} alt={p.title} className="w-full h-full object-cover" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
      </div>
      <div className="px-5 pb-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold truncate">{p.title}</h3>
            <p className="text-sm text-muted-foreground">{p.client_name || 'No client'} · {p.category || 'No category'}</p>
          </div>
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${statusBadge(p.status)}`}>{p.status}</span>
        </div>
        {p.project_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
            <Calendar className="h-3.5 w-3.5" /> {new Date(p.project_date).toLocaleDateString()}
          </div>
        )}
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={(e) => toggleFeatured(p, e)}
            disabled={toggleMutation.isPending}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${p.featured ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400'}`}
          >
            <Star className={`h-3.5 w-3.5 ${p.featured ? 'fill-current' : ''}`} /> {p.featured ? 'Featured' : 'Not featured'}
          </button>
          <div className="flex items-center gap-1">
            {p.project_url && (
              <a href={p.project_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-all">
                <Globe className="h-4 w-4" />
              </a>
            )}
            <Link href={`/admin/content/portfolio/${p.id}`} onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-all"><Edit className="h-4 w-4" /></Link>
            <button type="button" onClick={(e) => handleDelete(p, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-all"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTableRow = (p: PortfolioItem) => [
    <td key="title" className="px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg nm-raised-sm overflow-hidden bg-muted flex items-center justify-center">
          {p.featured_image ? <img src={p.featured_image} alt={p.title} className="w-full h-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div>
          <div className="font-medium">{p.title}</div>
          <div className="text-xs text-muted-foreground">{p.client_name || 'No client'}</div>
        </div>
      </div>
    </td>,
    <td key="category" className="px-4 py-4 text-sm">{p.category || '—'}</td>,
    <td key="status" className="px-4 py-4">
      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${statusBadge(p.status)}`}>{p.status}</span>
    </td>,
    <td key="featured" className="px-4 py-4 text-center">
      <button type="button" onClick={(e) => toggleFeatured(p, e)} className={`p-1.5 rounded-md transition-all ${p.featured ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-500/20' : 'text-muted-foreground'}`}>
        <Star className={`h-4 w-4 ${p.featured ? 'fill-current' : ''}`} />
      </button>
    </td>,
    <td key="actions" className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-end gap-1">
        {p.project_url && <a href={p.project_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Globe className="h-4 w-4" /></a>}
        <Link href={`/admin/content/portfolio/${p.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Edit className="h-4 w-4" /></Link>
        <button type="button" onClick={(e) => handleDelete(p, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
    </td>,
  ];

  return (
    <ContentListPage
      title="Portfolio"
      icon={FolderKanban}
      newHref="/admin/content/portfolio/new"
      newLabel="New Item"
      items={items}
      isLoading={isLoading}
      statCards={statCards}
      searchPlaceholder="Search portfolio items..."
      searchFn={searchFn}
      filterTabs={filterTabs}
      tableHeaders={[{ key: 'title', label: 'Item' }, { key: 'category', label: 'Category' }, { key: 'status', label: 'Status' }, { key: 'featured', label: 'Featured', className: 'text-center' }, { key: 'actions', label: '', className: 'text-right' }]}
      renderGridCard={renderGridCard}
      renderTableRow={renderTableRow}
      onRowClick={(p) => router.push(`/admin/content/portfolio/${p.id}`)}
      emptyText="No portfolio items found."
    />
  );
}
