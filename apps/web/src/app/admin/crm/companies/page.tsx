'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CompanyStats } from '@/components/companies/CompanyStats';
import { CompanyTable } from '@/components/companies/CompanyTable';
import { fetchCompanies } from '@/lib/api';

export default function AdminCrmCompaniesPage() {
  const { token, clearToken } = useAuth();

  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [lifecycleStage, setLifecycleStage] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'companies',
      token,
      page,
      search,
      industry,
      lifecycleStage,
      sortBy,
      sortOrder,
    ],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number | boolean> = {
        page,
        limit: 12,
        sortBy,
        sortOrder,
        includeStats: true,
      };
      if (search) params.search = search;
      if (industry) params.industry = industry;
      if (lifecycleStage) params.lifecycle_stage = lifecycleStage;
      return fetchCompanies(token, params);
    },
    enabled: !!token,
  });

  const companies = data?.companies ?? [];
  const pagination = data?.pagination ?? {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 12,
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
            <p className="text-muted-foreground">
              Manage business accounts and organization relationships
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => clearToken()}>
            Clear token
          </Button>
        </div>

        <CompanyStats
          totalCompanies={pagination.totalItems}
          aggregatedStats={data?.aggregatedStats}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Input
            placeholder="Industry"
            value={industry}
            onChange={(e) => {
              setIndustry(e.target.value);
              setPage(1);
            }}
          />
          <Input
            placeholder="Lifecycle stage"
            value={lifecycleStage}
            onChange={(e) => {
              setLifecycleStage(e.target.value);
              setPage(1);
            }}
          />
          <Button
            variant="outline"
            onClick={() => toggleSort('updated_at')}
          >{`Sort: ${sortBy} ${sortOrder}`}</Button>
        </div>

        {error && (
          <p className="text-sm text-destructive">
            {(error as Error)?.message || 'Failed to load companies'}
          </p>
        )}

        <CompanyTable companies={companies} loading={isLoading} />

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {pagination.currentPage} of {pagination.totalPages} (
              {pagination.totalItems} total)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.currentPage === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
