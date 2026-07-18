'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Edit,
  Eye,
  EyeOff,
  Grid3X3,
  Layers,
  List,
  Package,
  Plus,
  Search,
  Settings,
  Star,
  StarOff,
  Table,
  Trash2,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { fetchAdminServices, fetchAdminServiceStats, updateService, deleteService } from '@/lib/api';
import type { Service } from '@clickbit/shared/src/content';
import { toast } from 'sonner';

interface PricingTier {
  name: string;
  price: string;
  subtitle?: string;
  features?: string[];
}

interface ServicePricingData {
  tiers?: PricingTier[];
}

const categoryIcons: Record<string, React.ReactNode> = {
  Development: <Package className="h-3.5 w-3.5" />,
  Infrastructure: <Layers className="h-3.5 w-3.5" />,
  'Business Systems': <Settings className="h-3.5 w-3.5" />,
  'Design & Branding': <Star className="h-3.5 w-3.5" />,
  'Marketing & Growth': <TrendingUp className="h-3.5 w-3.5" />,
  'Specialized Tech': <Settings className="h-3.5 w-3.5" />,
  'Business Packages': <Package className="h-3.5 w-3.5" />,
};

const categoryColors: Record<string, string> = {
  Development: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
  Infrastructure: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
  'Business Systems': 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/30',
  'Design & Branding': 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/30',
  'Marketing & Growth': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
  'Specialized Tech': 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30',
  'Business Packages': 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30',
};

function getSectionCount(service: Service): number {
  const sections = Array.isArray(service.sections) ? service.sections : [];
  const features = Array.isArray(service.features) ? service.features : [];
  return sections.length || features.length || 0;
}

function getPricingTierCount(service: Service): number {
  const pricing = (service.pricing as ServicePricingData | null) ?? null;
  if (pricing?.tiers?.length) return pricing.tiers.length;
  return 0;
}

function getPricingRange(service: Service): string | null {
  const pricing = (service.pricing as ServicePricingData | null) ?? null;
  if (!pricing?.tiers?.length) return null;
  const prices = pricing.tiers
    .map((tier) => {
      const priceStr = tier.price?.replace(/[^0-9.]/g, '');
      return priceStr ? parseFloat(priceStr) : null;
    })
    .filter((p): p is number => p !== null && !Number.isNaN(p));

  if (prices.length === 0) return 'Custom';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `$${min.toLocaleString()}`;
  return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
}

export default function AdminContentServicesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-services', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminServices(token, { limit: 1000 }); },
    enabled: !!token,
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-services-stats', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchAdminServiceStats(token); },
    enabled: !!token,
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((s) => {
      const cat = s.category || 'Uncategorized';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((s) => {
      const matchesCategory =
        activeCategory === 'All' ||
        s.category === activeCategory ||
        (activeCategory === 'Popular' && s.is_popular) ||
        (activeCategory === 'Inactive' && !s.is_active) ||
        (activeCategory === 'Uncategorized' && !s.category);
      const matchesSearch = !search.trim() ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.description?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (s.category?.toLowerCase() || '').includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, activeCategory, search]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Service> }) => updateService(token!, id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-services'] }); queryClient.invalidateQueries({ queryKey: ['admin-services-stats'] }); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteService(token!, id),
    onSuccess: () => { toast.success('Service deleted'); queryClient.invalidateQueries({ queryKey: ['admin-services'] }); queryClient.invalidateQueries({ queryKey: ['admin-services-stats'] }); },
  });

  const statCards = [
    { label: 'Total Services', value: stats?.total ?? 0, icon: Briefcase },
    { label: 'Active', value: stats?.active ?? 0, icon: CheckCircle2, accent: 'success' as const },
    { label: 'Inactive', value: stats?.inactive ?? 0, icon: XCircle, accent: 'destructive' as const },
    { label: 'Popular', value: stats?.popular ?? 0, icon: Star, accent: 'warning' as const },
  ];

  const toggleStatus = (id: number, isActive: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    toggleMutation.mutate({ id, data: { is_active: !isActive } });
  };

  const togglePopular = (id: number, isPopular: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    toggleMutation.mutate({ id, data: { is_popular: !isPopular } });
  };

  const handleDelete = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('Delete this service? This cannot be undone.')) return;
    remove.mutate(id);
  };

  const CategoryBadge = ({ category }: { category?: string | null }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${categoryColors[category || ''] || 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/30'}`}>
      {categoryIcons[category || ''] || <Package className="h-3.5 w-3.5" />}
      {category || 'Uncategorized'}
    </span>
  );

  if (isLoading) {
    return (
      <PageShell title="Service Management" icon={Briefcase}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (<Skeleton key={i} className="h-24 rounded-xl" />))}
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (<Skeleton key={i} className="h-40 rounded-xl" />))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Service Management"
      icon={Briefcase}
      actions={
        <Button asChild className="gap-1">
          <Link href="/admin/content/services/new"><Plus className="h-4 w-4" /> Add Service</Link>
        </Button>
      }
    >
      <StatCards cards={statCards} />

      <div className="nm-raised p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services..."
              className="pl-9 nm-inset-sm border-transparent"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center nm-inset-sm rounded-lg p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                title="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                title="Table view"
              >
                <Table className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="nm-inset-sm rounded-2xl p-2 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max px-2 py-1">
          <button
            type="button"
            onClick={() => setActiveCategory('All')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategory === 'All' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('Popular')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${activeCategory === 'Popular' ? 'bg-amber-500 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          >
            <Star className="h-3.5 w-3.5" /> Popular ({items.filter((s) => s.is_popular).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('Inactive')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${activeCategory === 'Inactive' ? 'bg-red-500 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          >
            <EyeOff className="h-3.5 w-3.5" /> Inactive ({items.filter((s) => !s.is_active).length})
          </button>
          <div className="w-px h-6 bg-border mx-2" />
          {categories.map(([cat, count]) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${activeCategory === cat ? 'bg-muted-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              {categoryIcons[cat] || <Package className="h-3.5 w-3.5" />}
              {cat} ({count})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 nm-inset-sm rounded-xl">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No services found.</p>
          {search && (
            <button type="button" onClick={() => setSearch('')} className="mt-2 text-primary text-sm hover:underline">
              Clear search
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((service) => (
            <div
              key={service.id}
              onClick={() => router.push(`/admin/content/services/${service.id}`)}
              className={`group relative nm-raised rounded-xl overflow-hidden cursor-pointer nm-interactive transition-all ${service.is_active ? '' : 'nm-inset-sm opacity-70'}`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <CategoryBadge category={service.category} />
                      {service.is_popular && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30">
                          <Star className="h-3 w-3 fill-current" /> Popular
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold truncate">{service.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">/{service.slug}</p>
                  </div>
                  <div className={`flex-shrink-0 w-2 h-2 rounded-full ${service.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} title={service.is_active ? 'Active' : 'Inactive'} />
                </div>

                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{service.description || 'No description provided'}</p>

                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <List className="h-4 w-4" />
                    <span>{getSectionCount(service)} sections</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" />
                    <span>{getPricingTierCount(service)} tiers</span>
                  </div>
                  {getPricingRange(service) && (
                    <div className="text-primary font-medium">{getPricingRange(service)}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between px-5 py-3 nm-inset-sm border-t border-transparent">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => toggleStatus(service.id, !!service.is_active, e)}
                    disabled={toggleMutation.isPending}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${service.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20'}`}
                  >
                    {service.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {service.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => togglePopular(service.id, !!service.is_popular, e)}
                    disabled={toggleMutation.isPending}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${service.is_popular ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:hover:bg-gray-500/20'}`}
                  >
                    {service.is_popular ? <Star className="h-3.5 w-3.5 fill-current" /> : <StarOff className="h-3.5 w-3.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <Link
                    href={`/admin/content/services/${service.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:brightness-95 transition-all"
                  >
                    Edit Details <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); router.push(`/admin/content/services/${service.id}`); }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:brightness-95 transition-all"
                    title="Quick edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(service.id, e)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:brightness-95 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="nm-inset-sm rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="nm-inset-sm border-b border-transparent">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Service</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sections</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tiers</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Pricing</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Popular</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((service) => (
                  <tr
                    key={service.id}
                    onClick={() => router.push(`/admin/content/services/${service.id}`)}
                    className={`cursor-pointer hover:brightness-[0.97] dark:hover:brightness-110 transition-all ${!service.is_active ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-xs text-muted-foreground">/{service.slug}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <CategoryBadge category={service.category} />
                    </td>
                    <td className="px-4 py-4 text-center">{getSectionCount(service)}</td>
                    <td className="px-4 py-4 text-center">{getPricingTierCount(service)}</td>
                    <td className="px-4 py-4">
                      <span className="text-primary font-medium text-sm">{getPricingRange(service) || '—'}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => toggleStatus(service.id, !!service.is_active, e)}
                        disabled={toggleMutation.isPending}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${service.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}
                      >
                        {service.is_active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {service.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => togglePopular(service.id, !!service.is_popular, e)}
                        disabled={toggleMutation.isPending}
                        className={`p-1.5 rounded-md transition-all ${service.is_popular ? 'text-amber-500 bg-amber-100 dark:bg-amber-500/20' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {service.is_popular ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/admin/content/services/${service.id}`}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-all"
                          title="Edit details"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(service.id, e)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-all"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}
