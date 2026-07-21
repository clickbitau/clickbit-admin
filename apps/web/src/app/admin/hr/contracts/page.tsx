'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CheckCircle, FileText, Plus, Power, Search, XCircle } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { DataTable } from '@/components/design-system/DataTable';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { ContractForm } from '@/components/hr/ContractForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/AuthProvider';
import { activateContract, fetchContracts, fetchHrStats, terminateContract } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import type { Contract } from '@/types/hr';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'superseded', label: 'Superseded' },
];

const sortOptions = [
  { value: 'start_date', label: 'Start date' },
  { value: 'position', label: 'Position' },
];

export default function AdminHrContractsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('start_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, error } = useQuery({
    queryKey: ['contracts', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchContracts(token, status ? { status } : undefined);
    },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['hr-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchHrStats(token); },
    enabled: !!token,
  });

  useRealtimeRefresh(['contracts'], ['contracts'], { enabled: !!token });

  const stats = statsData?.data;

  const filtered = useMemo(() => {
    let rows = [...(data?.data ?? [])];
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      rows = rows.filter((c) =>
        (c.employee?.name || '').toLowerCase().includes(q) ||
        (c.position || '').toLowerCase().includes(q) ||
        (c.employment_type || '').toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'start_date') {
        return (new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime()) * dir;
      }
      return ((a.position || '').localeCompare(b.position || '')) * dir;
    });
    return rows;
  }, [data, debouncedSearch, sortBy, sortOrder]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['contracts', token] });
    queryClient.invalidateQueries({ queryKey: ['hr-stats', token] });
  };

  const activate = useMutation({
    mutationFn: (id: number) => { if (!token) throw new Error('No token'); return activateContract(token, id); },
    onSuccess: refresh,
  });

  const terminate = useMutation({
    mutationFn: (id: number) => { if (!token) throw new Error('No token'); return terminateContract(token, id, 'Terminated from UI'); },
    onSuccess: refresh,
  });

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total', value: stats.contracts.total, icon: FileText },
      { label: 'Active', value: stats.contracts.active, icon: CheckCircle, accent: 'success' as const, onClick: () => { setStatus('active'); } },
      { label: 'Pending', value: stats.contracts.active ? stats.contracts.total - stats.contracts.active - stats.contracts.expired : 0, icon: Power, accent: 'warning' as const },
      { label: 'Expired', value: stats.contracts.expired, icon: XCircle, accent: 'destructive' as const },
    ];
  }, [stats]);

  return (
    <PageShell
      title="Contracts"
      icon={FileText}
      description="Manage employee contracts, activations, and terminations."
      actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Contract</Button>}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contracts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); }}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>{sortOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}>
          {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        </Button>
      </div>

      {error ? (
        <div className="text-destructive text-sm">Failed to load contracts.</div>
      ) : (
        <DataTable
          headers={[
            { key: 'employee', label: 'Employee' },
            { key: 'position', label: 'Position' },
            { key: 'type', label: 'Type' },
            { key: 'start', label: 'Start' },
            { key: 'end', label: 'End' },
            { key: 'salary', label: 'Salary' },
            { key: 'status', label: 'Status' },
            { key: 'actions', label: '' },
          ]}
          data={filtered}
          keyExtractor={(c) => c.id}
          loading={isLoading}
          onRowClick={(c) => router.push(`/admin/hr/contracts/${c.id}`)}
          emptyText="No contracts found."
          emptyDescription="Try adjusting your search or status filter."
          renderRow={(c: Contract) => [
            <div key="employee" className="flex items-center gap-3">
              <PersonAvatar name={c.employee?.name || `Employee ${c.employee_id}`} />
              <Link href={`/admin/hr/contracts/${c.id}`} className="font-medium hover:underline">{c.employee?.name || `Employee ${c.employee_id}`}</Link>
            </div>,
            <span key="position">{c.position || '-'}</span>,
            <span key="type" className="capitalize">{(c.employment_type || '').replace(/_/g, ' ')}</span>,
            <span key="start">{formatDate(c.start_date)}</span>,
            <span key="end">{formatDate(c.end_date)}</span>,
            <span key="salary">{c.salary ? formatCurrency(Number(c.salary) || 0, c.currency || 'AUD') : '-'}</span>,
            <StatusBadge key="status" status={c.status || 'active'} />,
            <div key="actions" className="flex justify-end gap-1">
              {c.status !== 'active' && (
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); activate.mutate(c.id); }} disabled={activate.isPending}>
                  <CheckCircle className="h-4 w-4" />
                </Button>
              )}
              {c.status !== 'terminated' && (
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); terminate.mutate(c.id); }} disabled={terminate.isPending}>
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>,
          ]}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Contract</DialogTitle>
            <DialogDescription>Create an employee contract.</DialogDescription>
          </DialogHeader>
          {token && (
            <ContractForm
              token={token}
              onSuccess={() => { setCreateOpen(false); refresh(); }}
              onCancel={() => setCreateOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
