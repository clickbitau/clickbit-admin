'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bug, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { DataTable } from '@/components/design-system/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { fetchBugReports, fetchBugReportStats, syncBugReports } from '@/lib/api';
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
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const statsQuery = useQuery<{ success: boolean; data: BugReportStats }>({
    queryKey: ['bug-report-stats', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchBugReportStats(token);
    },
    enabled: !!token,
  });

  const listQuery = useQuery<BugReportListResponse>({
    queryKey: ['bug-reports', token, status, category, search, offset],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const params: Record<string, string | number> = { limit, offset };
      if (status !== 'all') params.status = status;
      if (category !== 'all') params.category = category;
      return fetchBugReports(token, params);
    },
    enabled: !!token,
  });

  const syncMutation = useMutation({
    mutationFn: () => syncBugReports(token!),
    onSuccess: () => {
      toast.success('Bug reports synced');
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
      queryClient.invalidateQueries({ queryKey: ['bug-report-stats'] });
    },
    onError: () => toast.error('Sync failed'),
  });

  const stats = statsQuery.data?.data;
  const reports = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;

  const statCards = stats
    ? [
        { label: 'Total', value: stats.total, icon: Bug },
        { label: 'Active', value: stats.active, icon: Bug, accent: 'warning' as const },
        { label: 'Merged', value: stats.merged, icon: Bug, accent: 'success' as const },
        { label: 'Deployed', value: stats.deployed, icon: Bug, accent: 'success' as const },
      ]
    : [];

  const filtered = reports.filter((r) =>
    search
      ? (r.title + ' ' + (r.description || '') + ' ' + (r.target_repo || '')).toLowerCase().includes(search.toLowerCase())
      : true,
  );

  return (
    <PageShell
      title="Bug Reports"
      icon={Bug}
      description="Devin bug reports and GitHub pipeline"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <RefreshCw className="mr-1 h-4 w-4" /> Sync
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/bug-reports/new"><Plus className="mr-1 h-4 w-4" /> New</Link>
          </Button>
        </div>
      }
    >
      {stats && <StatCards cards={statCards} />}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          placeholder="Search bug reports..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => { setStatus(v); setOffset(0); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => { setCategory(v); setOffset(0); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {['invoice', 'dashboard', 'login', 'crm', 'hr', 'payments', 'other', 'mobile', 'deploy'].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
        data={filtered}
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Showing {Math.min(offset + filtered.length, total)} of {total}</p>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={offset <= 0} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset((o) => o + limit)}>
            Next
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
