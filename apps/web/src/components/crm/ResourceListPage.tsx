'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable, Column } from '@/components/design-system/DataTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface PaginationEnvelope<T> {
  [key: string]: T[] | unknown;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

interface ResourceListPageProps<T> {
  title: string;
  resourceKey: string;
  fetcher: (token: string, params: { page: number; limit: number; search?: string }) => Promise<PaginationEnvelope<T>>;
  columns: Column<T>[];
  getRowId: (row: T) => string | number;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}

export function ResourceListPage<T>({
  title,
  resourceKey,
  fetcher,
  columns,
  getRowId,
  searchPlaceholder = 'Search...',
  actions,
}: ResourceListPageProps<T>) {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: [resourceKey, page, search],
    queryFn: () =>
      fetcher(token!, {
        page,
        limit: 20,
        search: search || undefined,
      }),
    enabled: !!token,
  });

  const rows = (data?.[resourceKey] as T[]) ?? [];
  const pagination = data?.pagination;

  return (
    <PageShell
      title={title}
      actions={actions}
    >
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      </div>
      {error && (
        <div className="rounded-lg border border-destructive p-4 text-destructive">
          Failed to load {title.toLowerCase()}.
        </div>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        getRowKey={getRowId}
        page={pagination?.currentPage}
        totalPages={pagination?.totalPages}
        onPageChange={setPage}
      />
    </PageShell>
  );
}
