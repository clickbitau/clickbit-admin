'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatCards } from '@/components/design-system/StatCards';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import { fetchContacts, fetchCustomerStats } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { CrmContact } from '@/types/crm';
import { Search } from 'lucide-react';

export default function CustomersPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      page,
      limit: 25,
      lifecycle_stage: 'customer',
      sortBy,
      sortOrder,
    };
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [page, debouncedSearch, sortBy, sortOrder]);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', queryParams],
    queryFn: () => fetchContacts(token!, queryParams),
    enabled: !!token,
  });

  const { data: stats } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: () => fetchCustomerStats(token!),
    enabled: !!token,
  });

  useRealtimeRefresh(['contacts'], ['customers'], { enabled: !!token });

  const customers = data?.contacts ?? [];
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 25 };

  const statCards = [
    { label: 'Total Customers', value: stats?.total ?? pagination.totalItems },
    { label: 'Total Revenue', value: formatCurrency(stats?.totalRevenue ?? 0) },
    { label: 'New This Month', value: stats?.newThisMonth ?? 0 },
    { label: 'Active (90d)', value: stats?.activeCustomers ?? 0 },
  ];

  function toggleSort(field: string) {
    if (sortBy === field) setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
    else { setSortBy(field); setSortOrder('ASC'); }
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground">Manage customer accounts and revenue</p>
          </div>
        </div>

        <StatCards cards={statCards} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customers..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Created</SelectItem>
              <SelectItem value="became_customer_at">Customer Since</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="total_revenue">Revenue</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => toggleSort(sortBy)}>
            {sortOrder === 'ASC' ? 'Ascending' : 'Descending'}
          </Button>
        </div>

        <DataTable
          headers={[
            { key: 'name', label: 'Customer' },
            { key: 'company', label: 'Company' },
            { key: 'revenue', label: 'Revenue' },
            { key: 'since', label: 'Customer Since' },
            { key: 'contacted', label: 'Last Contacted' },
          ]}
          data={customers}
          keyExtractor={(c) => c.id}
          loading={isLoading}
          renderRow={(c) => [
            <div key="name">
              <Link href={`/admin/crm/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
              <p className="text-xs text-muted-foreground">{c.email}</p>
            </div>,
            <div key="company">
              {c.primary_company ? (
                <div>
                  <p className="text-sm">{c.primary_company.name}</p>
                  <p className="text-xs text-muted-foreground">{c.primary_company.email}</p>
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>,
            <span key="revenue" className="font-medium text-emerald-600">{formatCurrency(c.total_revenue ?? 0)}</span>,
            <span key="since">{formatDate(c.became_customer_at)}</span>,
            <span key="contacted">{formatDate(c.last_contacted_at)}</span>,
          ]}
          onRowClick={(c) => { /* row is a link via Link */ }}
        />

        <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} onPageChange={setPage} />
      </div>
    </div>
  );
}
