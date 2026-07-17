'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CompanyTable } from '@/components/companies/CompanyTable';
import { PageShell } from '@/components/design-system/PageShell';
import { Pagination } from '@/components/design-system/Pagination';
import { fetchCompanies } from '@/lib/api';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { Building2, Users, TrendingUp, Briefcase, Search, X, Plus, RefreshCw } from 'lucide-react';

const LIFECYCLE_STAGES = [
  { value: 'subscriber', label: 'Subscriber' },
  { value: 'lead', label: 'Lead' },
  { value: 'marketing_qualified', label: 'MQL' },
  { value: 'sales_qualified', label: 'SQL' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'customer', label: 'Customer' },
  { value: 'evangelist', label: 'Evangelist' },
  { value: 'other', label: 'Other' },
  { value: 'completed', label: 'Completed' },
];

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing',
  'Real Estate', 'Hospitality', 'Construction', 'Professional Services', 'Other',
];

export default function AdminCrmCompaniesPage() {
  const { token } = useAuth();

  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [lifecycleStage, setLifecycleStage] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['companies', token, page, debouncedSearch, industry, lifecycleStage, sortBy, sortOrder],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number | boolean> = {
        page,
        limit: 12,
        sortBy,
        sortOrder,
        includeStats: true,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (industry) params.industry = industry;
      if (lifecycleStage) params.lifecycle_stage = lifecycleStage;
      return fetchCompanies(token, params);
    },
    enabled: !!token,
  });

  useRealtimeRefresh(['companies'], ['companies'], { enabled: !!token });

  const companies = data?.companies ?? [];
  const pagination = data?.pagination ?? {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 12,
  };
  const aggregatedStats = data?.aggregatedStats ?? { totalValue: 0, totalDeals: 0, customerCount: 0 };

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
    setPage(1);
  }

  function handleStageFilter(stage: string) {
    setLifecycleStage((prev) => (prev === stage ? '' : stage));
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setIndustry('');
    setLifecycleStage('');
    setPage(1);
  }

  const hasActiveFilters = search || industry || lifecycleStage;

  const statCards = [
    { key: 'total', label: 'Total Companies', value: pagination.totalItems, icon: Building2, active: false, onClick: () => { setLifecycleStage(''); setPage(1); } },
    { key: 'value', label: 'Pipeline Value', value: `$${(aggregatedStats.totalValue / 1000).toFixed(0)}k`, icon: TrendingUp, active: false, onClick: () => {} },
    { key: 'deals', label: 'Open / Won Deals', value: aggregatedStats.totalDeals, icon: Briefcase, active: false, onClick: () => {} },
    { key: 'customers', label: 'Customers', value: aggregatedStats.customerCount, icon: Users, active: lifecycleStage === 'customer', onClick: () => handleStageFilter('customer') },
  ];

  return (
    <PageShell
      title="Companies"
      icon={Building2}
      description="Manage business accounts and organization relationships"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild>
            <Link href="/admin/crm/companies/new"><Plus className="mr-1 h-4 w-4" /> New Company</Link>
          </Button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={s.onClick}
              className={`nm-raised p-3 text-left transition-all hover:-translate-y-0.5 ${s.active ? 'ring-2 ring-[#1FBBD2]' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label}</span>
                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="nm-raised p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search companies..."
              className="pl-9 bg-transparent"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select value={lifecycleStage} onValueChange={(v) => { setLifecycleStage(v); setPage(1); }}>
            <SelectTrigger className="nm-raised-sm bg-transparent">
              <SelectValue placeholder="Lifecycle stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All stages</SelectItem>
              {LIFECYCLE_STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={industry} onValueChange={(v) => { setIndustry(v); setPage(1); }}>
            <SelectTrigger className="nm-raised-sm bg-transparent">
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All industries</SelectItem>
              {INDUSTRIES.map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => toggleSort('updated_at')}>
            Sort: {sortBy} {sortOrder}
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" className="text-destructive" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">Active filters:</span>
            {search && <FilterChip label={`"${search}"`} onClear={() => setSearch('')} />}
            {lifecycleStage && <FilterChip label={LIFECYCLE_STAGES.find((s) => s.value === lifecycleStage)?.label || lifecycleStage} onClear={() => setLifecycleStage('')} />}
            {industry && <FilterChip label={industry} onClear={() => setIndustry('')} />}
            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 underline">
              Clear all
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {(error as Error)?.message || 'Failed to load companies'}
        </p>
      )}

      <CompanyTable companies={companies} loading={isLoading} />

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        onPageChange={setPage}
      />
    </PageShell>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
      {label}
      <button onClick={onClear} className="hover:text-gray-900 dark:hover:text-gray-100">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
