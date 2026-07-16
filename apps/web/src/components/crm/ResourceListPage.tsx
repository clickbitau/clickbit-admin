'use client';

import { ReactNode, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { Input } from '@/components/ui/input';
import { Search, Contact, FileText, Cog, LayoutDashboard } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  accessor?: keyof T | string;
  cell?: (row: T) => ReactNode;
}

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

const iconMap: Record<string, typeof LayoutDashboard> = {
  Contacts: Contact,
  Notes: FileText,
  Automations: Cog,
};

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

  const headers = columns.map((c) => ({ key: c.key, label: c.header }));

  const renderRow = (row: T) =>
    columns.map((c) => {
      if (c.cell) return c.cell(row);
      const key = (c.accessor ?? c.key) as keyof T;
      const value = row[key];
      if (value == null) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return String(value);
      if (value instanceof Date) return value.toLocaleString();
      return String(value);
    });

  const Icon = iconMap[title] || LayoutDashboard;

  return (
    <PageShell title={title} icon={Icon} actions={actions}>
      <div className="flex flex-col gap-4">
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
        <DataTable<T>
          headers={headers}
          data={rows}
          keyExtractor={getRowId}
          renderRow={renderRow}
          loading={isLoading}
          emptyText={`No ${title.toLowerCase()} found.`}
        />
        {pagination && (
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            onPageChange={setPage}
          />
        )}
      </div>
    </PageShell>
  );
}
