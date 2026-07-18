'use client';

import { useMemo, useState } from 'react';
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
  User,
  Tag,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { ContentListPage } from '@/components/content/ContentListPage';
import { fetchAdminPortfolio, fetchAdminPortfolioStats, updatePortfolioItem, deletePortfolioItem } from '@/lib/api';
import type { PortfolioItem } from '@clickbit/shared/src/content';
import { toast } from 'sonner';

const statusOptions = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const statusBadge = (status?: string | null) => {
  const map: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400',
    archived: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    featured: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  };
  return map[status || ''] || 'bg-gray-100 text-gray-700';
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

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-AU');
}

export default function AdminContentPortfolioPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-portfolio', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminPortfolio(token, { limit: 1000 }); },
    enabled: !!token,
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-portfolio-stats', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminPortfolioStats(token); },
    enabled: !!token,
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PortfolioItem> }) => updatePortfolioItem(token!, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-portfolio'] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deletePortfolioItem(token!, id),
    onSuccess: () => { toast.success('Portfolio item deleted'); queryClient.invalidateQueries({ queryKey: ['admin-portfolio'] }); },
  });

  const categories = useMemo(() => Array.from(new Set(items.map((p) => p.category).filter(Boolean) as string[])).sort(), [items]);

  const statCards = [
    { label: 'Total Projects', value: stats?.total ?? items.length, icon: FolderKanban },
    { label: 'Published', value: stats?.published ?? 0, icon: CheckCircle2, accent: 'success' as const },
    { label: 'Draft', value: stats?.draft ?? 0, icon: XCircle, accent: 'warning' as const },
    { label: 'Featured', value: stats?.featured ?? 0, icon: Star, accent: 'primary' as const },
    { label: 'Categories', value: categories.length, icon: Tag, accent: 'secondary' as const },
  ];

  const filterTabs = [
    { id: 'all', label: 'All', filter: () => true },
    { id: 'published', label: 'Published', filter: (p: PortfolioItem) => p.status === 'published', activeClassName: 'bg-emerald-600 text-white' },
    { id: 'draft', label: 'Draft', filter: (p: PortfolioItem) => p.status === 'draft', activeClassName: 'bg-gray-600 text-white' },
    { id: 'archived', label: 'Archived', filter: (p: PortfolioItem) => p.status === 'archived', activeClassName: 'bg-amber-600 text-white' },
    { id: 'featured', label: 'Featured', filter: (p: PortfolioItem) => !!p.featured, activeClassName: 'bg-purple-600 text-white' },
    ...categories.map((cat) => ({ id: `cat-${cat}`, label: cat, filter: (p: PortfolioItem) => p.category === cat })),
  ];

  const customFilter = (p: PortfolioItem) => !category || p.category === category;

  const searchFn = (p: PortfolioItem, q: string) =>
    (p.title || '').toLowerCase().includes(q) ||
    (p.client_name || '').toLowerCase().includes(q) ||
    (p.category || '').toLowerCase().includes(q) ||
    asArray(p.technologies).some((t) => t.toLowerCase().includes(q)) ||
    asArray(p.services_provided).some((s) => s.toLowerCase().includes(q));

  const setStatus = (p: PortfolioItem, status: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (status === p.status) return;
    toggleMutation.mutate({ id: p.id, data: { status } });
  };

  const toggleFeatured = (p: PortfolioItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    toggleMutation.mutate({ id: p.id, data: { featured: !p.featured } });
  };

  const handleDelete = (p: PortfolioItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    remove.mutate(p.id);
  };

  const coverImage = (p: PortfolioItem) => p.featured_image || asArray(p.gallery_images)[0];

  const renderGridCard = (p: PortfolioItem) => {
    const technologies = asArray(p.technologies);
    const services = asArray(p.services_provided);
    return (
      <div className="nm-raised rounded-xl overflow-hidden group h-full flex flex-col">
        <div className="relative h-48 bg-muted nm-inset-sm m-3 rounded-lg overflow-hidden flex items-center justify-center">
          {coverImage(p) ? <img src={coverImage(p)} alt={p.title} className="w-full h-full object-cover" /> : <ImageIcon className="h-10 w-10 text-muted-foreground" />}
          <div className="absolute top-2 right-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(p.status)}`}>{p.status}</span>
          </div>
        </div>
        <div className="px-5 pb-5 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-semibold truncate">{p.title}</h3>
            <button type="button" onClick={(e) => toggleFeatured(p, e)} className={`p-1 rounded-md transition-all ${p.featured ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-500/20' : 'text-muted-foreground hover:text-yellow-500'}`}>
              <Star className={`h-4 w-4 ${p.featured ? 'fill-current' : ''}`} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.description || 'No description.'}</p>
          <div className="space-y-1 mt-3 text-xs text-muted-foreground">
            {p.client_name && <div className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {p.client_name}</div>}
            {p.category && <div className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> {p.category}</div>}
            {p.project_date && <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(p.project_date)}</div>}
          </div>
          {(technologies.length > 0 || services.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-3">
              {technologies.slice(0, 3).map((t) => <Badge key={t} variant="secondary" className="text-xs font-normal">{t}</Badge>)}
              {services.slice(0, 2).map((s) => <Badge key={s} variant="outline" className="text-xs font-normal">{s}</Badge>)}
              {technologies.length > 3 && <Badge variant="secondary" className="text-xs">+{technologies.length - 3}</Badge>}
            </div>
          )}
          <div className="flex items-center justify-between mt-auto pt-4">
            <div className="flex items-center gap-1">
              {p.project_url && <a href={p.project_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Globe className="h-4 w-4" /></a>}
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Link href={`/admin/content/portfolio/${p.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-primary"><Edit className="h-4 w-4" /></Link>
              <button type="button" onClick={(e) => handleDelete(p, e)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTableRow = (p: PortfolioItem) => {
    const technologies = asArray(p.technologies);
    return [
      <td key="title" className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg nm-raised-sm overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
            {coverImage(p) ? <img src={coverImage(p)} alt={p.title} className="w-full h-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{p.title}</div>
            <div className="text-xs text-muted-foreground truncate">{p.client_name || 'No client'} · {p.category || 'No category'}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {technologies.slice(0, 3).map((t) => <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0">{t}</Badge>)}
            </div>
          </div>
        </div>
      </td>,
      <td key="date" className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">{formatDate(p.project_date)}</td>,
      <td key="status" className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
        <select value={p.status} onChange={(e) => setStatus(p, e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
          {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </td>,
      <td key="featured" className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
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
  };

  return (
    <ContentListPage
      title="Portfolio"
      description="Manage portfolio projects, showcases, and case studies."
      icon={FolderKanban}
      newHref="/admin/content/portfolio/new"
      newLabel="New Item"
      items={items}
      isLoading={isLoading}
      statCards={statCards}
      searchPlaceholder="Search projects, clients, tech, services..."
      searchFn={searchFn}
      filterTabs={filterTabs}
      customFilter={customFilter}
      headerChildren={
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      }
      pageSize={9}
      tableHeaders={[{ key: 'title', label: 'Project' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'featured', label: 'Featured', className: 'text-center' }, { key: 'actions', label: '', className: 'text-right' }]}
      renderGridCard={renderGridCard}
      renderTableRow={renderTableRow}
      onRowClick={(p) => router.push(`/admin/content/portfolio/${p.id}`)}
      emptyText="No portfolio items found."
    />
  );
}
