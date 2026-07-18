'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { LucideIcon, Grid3X3, Plus, Search, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards, StatCard } from '@/components/design-system/StatCards';

export interface FilterTab<T> {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: (items: T[]) => number;
  filter: (item: T) => boolean;
  activeClassName?: string;
}

interface ContentListPageProps<T> {
  title: string;
  icon: LucideIcon;
  description?: string;
  newHref: string;
  newLabel?: string;
  items: T[];
  isLoading: boolean;
  statCards: StatCard[];
  searchPlaceholder?: string;
  searchFn?: (item: T, q: string) => boolean;
  filterTabs?: FilterTab<T>[];
  customFilter?: (item: T) => boolean;
  headerChildren?: React.ReactNode;
  footer?: React.ReactNode;
  tableHeaders: { key: string; label: string; className?: string }[];
  renderGridCard: (item: T) => React.ReactNode;
  renderTableRow: (item: T) => React.ReactNode;
  keyExtractor?: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  emptyText?: string;
}

export function ContentListPage<T extends { id: number | string }>({
  title,
  icon,
  description,
  newHref,
  newLabel = 'New',
  items,
  isLoading,
  statCards,
  searchPlaceholder = 'Search...',
  searchFn,
  filterTabs,
  customFilter,
  headerChildren,
  footer,
  tableHeaders,
  renderGridCard,
  renderTableRow,
  keyExtractor = (item) => item.id,
  onRowClick,
  emptyText = 'No items found.',
}: ContentListPageProps<T>) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(filterTabs?.[0]?.id || 'all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const activeFilter = filterTabs?.find((t) => t.id === activeTab);
    return items.filter((item) => {
      const matchesSearch = !q || (searchFn ? searchFn(item, q) : true);
      const matchesTab = activeFilter ? activeFilter.filter(item) : true;
      const matchesCustom = customFilter ? customFilter(item) : true;
      return matchesSearch && matchesTab && matchesCustom;
    });
  }, [items, search, activeTab, filterTabs, searchFn, customFilter]);

  const tabCounts = useMemo(() => {
    const map = new Map<string, number>();
    filterTabs?.forEach((tab) => {
      const count = tab.count ? tab.count(items) : items.filter(tab.filter).length;
      map.set(tab.id, count);
    });
    return map;
  }, [items, filterTabs]);

  if (isLoading) {
    return (
      <PageShell title={title} icon={icon} description={description}>
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
      title={title}
      icon={icon}
      description={description}
      actions={
        <Button asChild className="gap-1">
          <Link href={newHref}><Plus className="h-4 w-4" /> {newLabel}</Link>
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
              placeholder={searchPlaceholder}
              className="pl-9 nm-inset-sm border-transparent"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {headerChildren}
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
                <Table2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {filterTabs && filterTabs.length > 0 && (
        <div className="nm-inset-sm rounded-2xl p-2 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max px-2 py-1">
            {filterTabs.map((tab, idx) => {
              const Icon = tab.icon;
              const count = tabCounts.get(tab.id) ?? 0;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${isActive ? tab.activeClassName || 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 nm-inset-sm rounded-xl">
          <p className="text-muted-foreground">{emptyText}</p>
          {search && (
            <button type="button" onClick={() => setSearch('')} className="mt-2 text-primary text-sm hover:underline">
              Clear search
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div key={keyExtractor(item)} onClick={() => onRowClick?.(item)} className={onRowClick ? 'cursor-pointer' : undefined}>
              {renderGridCard(item)}
            </div>
          ))}
        </div>
      ) : (
        <div className="nm-inset-sm rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="nm-inset-sm border-b border-transparent">
                  {tableHeaders.map((h) => (
                    <th key={h.key} className={`text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider ${h.className || ''}`}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => (
                  <tr
                    key={keyExtractor(item)}
                    onClick={() => onRowClick?.(item)}
                    className={onRowClick ? 'cursor-pointer hover:brightness-[0.97] dark:hover:brightness-110 transition-all' : undefined}
                  >
                    {renderTableRow(item)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {footer}
    </PageShell>
  );
}
