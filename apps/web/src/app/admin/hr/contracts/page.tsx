'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CheckCircle, ChevronDown, ChevronUp, Download, FileText, Plus, Power, Search, XCircle } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { ContractForm } from '@/components/hr/ContractForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { activateContract, fetchContractPdfUrl, fetchContracts, fetchHrStats, terminateContract } from '@/lib/api';
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
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

  const download = useMutation({
    mutationFn: async (c: Contract) => {
      if (!token) throw new Error('No token');
      const blob = await fetchContractPdfUrl(token, c.id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contract-${c.contract_number || c.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
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

  function toggleExpanded(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function employeeName(c: Contract) {
    return c.employee?.name || `Employee ${c.employee_id}`;
  }

  return (
    <PageShell
      title="Contracts"
      icon={FileText}
      description="Manage employee contracts, activations, and terminations."
      actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Contract</Button>}
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <div className="nm-raised p-4">
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
      </div>

      {error ? (
        <div className="text-destructive text-sm">Failed to load contracts.</div>
      ) : (
        <div className="space-y-4">
          {isLoading && filtered.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">Loading contracts…</div>
          ) : filtered.length === 0 ? (
            <div className="nm-raised p-12 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No contracts found</p>
              <p className="text-sm mt-1">Try adjusting your search or status filter.</p>
            </div>
          ) : (
            filtered.map((c: Contract) => {
              const isExpanded = expandedId === c.id;
              return (
                <Card key={c.id} className={`overflow-hidden ${c.status === 'active' ? 'border-l-4 border-l-emerald-400' : ''}`}>
                  <div
                    className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer hover:brightness-[0.97] dark:hover:brightness-110"
                    onClick={() => toggleExpanded(c.id)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <PersonAvatar name={employeeName(c)} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          <Link href={`/admin/hr/contracts/${c.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                            {employeeName(c)}
                          </Link>
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.contract_number || `Contract #${c.id}`} · {c.position || 'No position'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium">
                          {c.hourly_rate ? `${formatCurrency(Number(c.hourly_rate), c.currency || 'AUD')}/hr` : (c.salary ? formatCurrency(Number(c.salary), c.currency || 'AUD') : '-')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(c.start_date)} → {c.end_date ? formatDate(c.end_date) : 'Ongoing'}
                        </p>
                      </div>
                      <StatusBadge status={c.status || 'active'} />
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); toggleExpanded(c.id); }}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <CardContent className="border-t bg-muted/30 px-5 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Employment Type</p>
                          <p className="font-medium capitalize">{(c.employment_type || '').replace(/_/g, ' ')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Department</p>
                          <p className="font-medium">{c.department || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Hourly Rate</p>
                          <p className="font-medium">{c.hourly_rate ? formatCurrency(Number(c.hourly_rate), c.currency || 'AUD') : '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Annual Salary</p>
                          <p className="font-medium">{c.salary ? formatCurrency(Number(c.salary), c.currency || 'AUD') : '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Weekly Hours</p>
                          <p className="font-medium">{c.default_weekly_hours ? `${c.default_weekly_hours} hrs` : '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Pay Frequency</p>
                          <p className="font-medium capitalize">{c.pay_frequency || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                          <p className="font-medium">{formatDate(c.start_date)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">End Date</p>
                          <p className="font-medium">{c.end_date ? formatDate(c.end_date) : 'Ongoing'}</p>
                        </div>
                      </div>

                      {c.renewal_date && (
                        <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                          Renewal review: {formatDate(c.renewal_date)}
                        </p>
                      )}
                      {c.terms_summary && (
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground mb-1">Terms / Notes</p>
                          <p className="text-sm whitespace-pre-wrap">{c.terms_summary}</p>
                        </div>
                      )}
                      {c.change_reason && (
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground mb-1">Reason for Change</p>
                          <p className="text-sm">{c.change_reason}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-3 border-t">
                        <Button size="sm" variant="outline" onClick={() => router.push(`/admin/hr/contracts/${c.id}`)}>
                          <FileText className="mr-1 h-4 w-4" /> View
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => download.mutate(c)} disabled={download.isPending}>
                          <Download className="mr-1 h-4 w-4" /> PDF
                        </Button>
                        {c.status !== 'active' && (
                          <Button size="sm" variant="outline" onClick={() => activate.mutate(c.id)} disabled={activate.isPending}>
                            <Power className="mr-1 h-4 w-4" /> Activate
                          </Button>
                        )}
                        {c.status !== 'terminated' && (
                          <Button size="sm" variant="destructive" onClick={() => terminate.mutate(c.id)} disabled={terminate.isPending}>
                            <XCircle className="mr-1 h-4 w-4" /> Terminate
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
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
