'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bug, Plus, RefreshCw, AlertCircle, Search, X } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Pagination } from '@/components/design-system/Pagination';
import { DataTable } from '@/components/design-system/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { fetchBugReports, fetchBugReportStats, syncBugReports, fetchBugReportConfig, fetchBugReportRepos } from '@/lib/api';
import { useDebounce } from '@/lib/useDebounce';
import { formatDate } from '@/lib/format';
import type { BugReport, BugReportListResponse, BugReportStats } from '@/types/bug-reports';

const statuses = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'fixing', label: 'Fixing' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'merged', label: 'Merged' },
  { value: 'deployed', label: 'Deployed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const priorities = ['critical', 'high', 'medium', 'low'];

function statusVariant(status?: string | null) {
  switch (status) {
    case 'merged':
    case 'deployed':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'investigating':
    case 'fixing':
      return 'outline';
    case 'blocked':
    case 'failed':
      return 'destructive';
    case 'cancelled':
      return 'secondary';
    default:
      return 'outline';
  }
}

function priorityColor(p?: string | null) {
  if (p === 'critical') return 'text-red-600';
  if (p === 'high') return 'text-orange-500';
  if (p === 'medium') return 'text-yellow-500';
  return 'text-muted-foreground';
}

export default function AdminBugReportsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [targetRepo, setTargetRepo] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;
  const debouncedSearch = useDebounce(search, 300);

  const configQuery = useQuery({
    queryKey: ['bug-report-config', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchBugReportConfig(token);
    },
    enabled: !!token,
  });

  const reposQuery = useQuery({
    queryKey: ['bug-report-repos', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchBugReportRepos(token);
    },
    enabled: !!token,
  });

  const statsQuery = useQuery<{ success: boolean; data: BugReportStats }>({
    queryKey: ['bug-report-stats', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchBugReportStats(token);
    },
    enabled: !!token,
  });

  const listQuery = useQuery<BugReportListResponse>({
    queryKey: ['bug-reports', token, status, category, targetRepo, debouncedSearch, page],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { limit, offset: (page - 1) * limit };
      if (status !== 'all') params.status = status;
      if (category !== 'all') params.category = category;
      if (targetRepo !== 'all') params.target_repo = targetRepo;
      if (debouncedSearch) params.search = debouncedSearch;
      return fetchBugReports(token, params);
    },
    enabled: !!token,
  });

  const syncMutation = useMutation({
    mutationFn: () => syncBugReports(token!),
    onSuccess: (res) => {
      toast.success(res.message || 'Bug reports synced');
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
      queryClient.invalidateQueries({ queryKey: ['bug-report-stats'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Sync failed'),
  });

  const stats = statsQuery.data?.data;
  const reports = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;
  const repos = reposQuery.data?.data ?? [];

  const statCards = stats
    ? [
        { label: 'Total', value: stats.total, icon: Bug },
        { label: 'Active', value: stats.active, icon: Bug, accent: 'warning' as const },
        { label: 'Merged', value: stats.merged, icon: Bug, accent: 'success' as const },
        { label: 'Deployed', value: stats.deployed, icon: Bug, accent: 'success' as const },
      ]
    : [];

  const canSync =
    configQuery.data?.data?.github?.configured || configQuery.data?.data?.devin?.configured;

  const categories = ['invoice', 'dashboard', 'login', 'crm', 'hr', 'payments', 'other', 'mobile', 'deploy'];

  function resetFilters() {
    setStatus('all');
    setCategory('all');
    setTargetRepo('all');
    setSearch('');
    setPage(1);
  }

  const activeFilters = (status !== 'all' ? 1 : 0) + (category !== 'all' ? 1 : 0) + (targetRepo !== 'all' ? 1 : 0) + (search ? 1 : 0);

  return (
    <PageShell
      title="Bug Reports"
      icon={Bug}
      description="Devin bug reports and GitHub pipeline"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !canSync}
            title={canSync ? 'Sync with Devin/GitHub' : 'GitHub or Devin not configured'}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} /> Sync
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/bug-reports/new"><Plus className="mr-1 h-4 w-4" /> New</Link>
          </Button>
        </div>
      }
    >
      {!canSync && !configQuery.isLoading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          GitHub and Devin are not configured, so sync is disabled. You can still create bug reports manually.
        </div>
      )}

      {stats && <StatCards cards={statCards} />}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bug reports..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={targetRepo} onValueChange={(v) => { setTargetRepo(v); setPage(1); }}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Target repo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All repos</SelectItem>
              {repos.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
              <X className="mr-1 h-4 w-4" /> Clear ({activeFilters})
            </Button>
          )}
        </div>
      </div>

      {listQuery.error ? (
        <div className="text-destructive">Failed to load bug reports.</div>
      ) : (
        <DataTable<BugReport>
          headers={[
            { key: 'id', label: '#' },
            { key: 'title', label: 'Title' },
            { key: 'category', label: 'Category' },
            { key: 'status', label: 'Status' },
            { key: 'priority', label: 'Priority' },
            { key: 'target_repo', label: 'Repo' },
            { key: 'created', label: 'Created' },
          ]}
          data={reports}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => router.push(`/admin/bug-reports/${row.id}`)}
          loading={listQuery.isLoading}
          emptyText="No bug reports found."
          renderRow={(row) => [
            <span key="id" className="text-muted-foreground">#{row.id}</span>,
            <div key="title"><p className="font-medium">{row.title}</p><p className="text-xs text-muted-foreground truncate max-w-[240px]">{row.description?.slice(0, 80)}</p></div>,
            <Badge key="category" variant="outline">{row.category || 'other'}</Badge>,
            <Badge key="status" variant={statusVariant(row.status)}>{row.status || 'pending'}</Badge>,
            <span key="priority" className={`text-sm font-medium ${priorityColor(row.priority)}`}>{row.priority || 'medium'}</span>,
            <span key="repo" className="text-xs text-muted-foreground">{row.target_repo || '-'}</span>,
            <span key="created" className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span>,
          ]}
        />
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={setPage}
      />
    </PageShell>
  );
}
