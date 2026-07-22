'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { fetchEmployeeContracts } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FileText, Search, Calendar, Briefcase, User, ShieldCheck } from 'lucide-react';
import type { Contract } from '@/types/hr';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
];

export default function EmployeeContractsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['employee-contracts', token, page],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployeeContracts(token, { page, limit });
    },
    enabled: !!token,
  });

  const contracts = useMemo(() => data?.data ?? [], [data]);
  const pagination = data?.pagination;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = contracts;
    if (status !== 'all') rows = rows.filter((c) => c.status?.toLowerCase() === status);
    if (q) {
      rows = rows.filter((c) =>
        (c.position?.toLowerCase() || '').includes(q) ||
        (c.contract_number?.toLowerCase() || '').includes(q) ||
        (c.department?.toLowerCase() || '').includes(q) ||
        (c.employment_type?.toLowerCase() || '').includes(q)
      );
    }
    return rows;
  }, [contracts, status, search]);

  const stats = useMemo(() => {
    return {
      active: contracts.filter((c) => c.status?.toLowerCase() === 'active').length,
      pending: contracts.filter((c) => c.status?.toLowerCase() === 'pending').length,
      total: contracts.length,
    };
  }, [contracts]);

  return (
    <PageShell
      title="My Contracts"
      icon={FileText}
      description="Your employment contracts and agreements."
      actions={
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={status === s.key ? 'default' : 'outline'}
              onClick={() => { setStatus(s.key); setPage(1); }}
            >
              {s.label}
            </Button>
          ))}
        </div>
      }
    >
      <StatCards
        cards={[
          { label: 'Active', value: stats.active, icon: ShieldCheck, accent: 'success' },
          { label: 'Pending', value: stats.pending, icon: FileText, accent: 'warning' },
          { label: 'Total', value: stats.total, icon: Briefcase, accent: 'primary' },
        ]}
      />

      <Card className="nm-raised p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="nm-raised p-8 text-center text-sm text-muted-foreground">
          {search || status !== 'all' ? 'No contracts match your filters.' : 'No contracts found.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c: Contract) => (
            <Card
              key={c.id}
              className={cn(
                'nm-raised hover:shadow-md transition-all cursor-pointer border-l-4',
                c.status?.toLowerCase() === 'active' ? 'border-l-emerald-500' :
                c.status?.toLowerCase() === 'pending' ? 'border-l-amber-500' : 'border-l-gray-400'
              )}
              onClick={() => router.push(`/employee/contracts/${c.id}`)}
            >
              <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 p-4">
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    {c.position || 'Contract'} {c.contract_number ? `· ${c.contract_number}` : ''}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">{c.employment_type?.replace(/_/g, ' ') || 'Employment'}</p>
                </div>
                <StatusBadge status={c.status} />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Salary / Rate</p>
                  <p className="font-medium">
                    {c.salary ? formatCurrency(c.salary, c.currency || undefined) : c.hourly_rate ? `${formatCurrency(c.hourly_rate, c.currency || undefined)}/hr` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Period</p>
                  <p className="font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(c.start_date)} {c.end_date ? `– ${formatDate(c.end_date)}` : ''}</p>
                </div>
                {c.manager?.name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Manager</p>
                    <p className="font-medium flex items-center gap-1"><User className="h-3 w-3" /> {c.manager.name}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          onPageChange={setPage}
        />
      )}
    </PageShell>
  );
}
