'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Calendar, RefreshCw, Search, Trophy, Users } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { DataTable } from '@/components/design-system/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDebounce } from '@/lib/useDebounce';
import { fetchKpiDashboard, snapshotKpi } from '@/lib/api';
import type { KpiScore } from '@/types/hr';

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function scoreVariant(score: number) {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
}

const sortOptions = [
  { value: 'total_score', label: 'Total score' },
  { value: 'employee', label: 'Employee' },
  { value: 'punctuality_score', label: 'Punctuality' },
  { value: 'task_efficiency_score', label: 'Efficiency' },
];

export default function AdminHrKpiPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [sortBy, setSortBy] = useState('total_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, error } = useQuery({
    queryKey: ['kpi-dashboard', token, period],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchKpiDashboard(token, period); },
    enabled: !!token && /^\d{4}-\d{2}$/.test(period),
  });

  const scores = useMemo(() => data?.scores ?? [], [data?.scores]);

  const filtered = useMemo(() => {
    let rows = [...scores];
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      rows = rows.filter((s) => (s.employee?.name || `Employee ${s.employee_id}`).toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'employee') {
        return (a.employee?.name || `Employee ${a.employee_id}`).localeCompare(b.employee?.name || `Employee ${b.employee_id}`) * dir;
      }
      const av = (a as any)[sortBy] ?? 0;
      const bv = (b as any)[sortBy] ?? 0;
      return (Number(av) - Number(bv)) * dir;
    });
    return rows;
  }, [scores, debouncedSearch, sortBy, sortOrder]);

  const stats = useMemo(() => {
    const total = scores.length;
    const avg = total ? scores.reduce((sum, s) => sum + (s.total_score || 0), 0) / total : 0;
    const top = [...scores].sort((a, b) => (b.total_score || 0) - (a.total_score || 0))[0];
    const low = [...scores].sort((a, b) => (a.total_score || 0) - (b.total_score || 0))[0];
    return { total, avg, top, low };
  }, [scores]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['kpi-dashboard', token] });

  const snapshot = useMutation({
    mutationFn: () => { if (!token) throw new Error('No token'); return snapshotKpi(token, period); },
    onSuccess: refresh,
  });

  const statCards = [
    { label: 'Employees Scored', value: stats.total, icon: Users },
    { label: 'Average Score', value: stats.avg.toFixed(1), icon: BarChart3 },
    { label: 'Top Performer', value: stats.top?.employee?.name || '-', icon: Trophy, accent: 'success' as const },
    { label: 'Needs Attention', value: stats.low?.employee?.name || '-', icon: Trophy, accent: 'destructive' as const },
  ];

  return (
    <PageShell title="KPI Dashboard" icon={BarChart3} description="Track employee performance and KPI scores by month.">
      <StatCards cards={statCards} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" className="max-w-[140px]" />
        </div>
        <Button onClick={() => snapshot.mutate()} disabled={snapshot.isPending}>
          <RefreshCw className="mr-2 h-4 w-4" /> Snapshot KPI
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employee..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Button variant="outline" onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}>
          {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        </Button>
      </div>

      {error ? (
        <div className="text-destructive text-sm">Failed to load KPI dashboard.</div>
      ) : (
        <DataTable
          headers={[
            { key: 'employee', label: 'Employee' },
            { key: 'total', label: 'Total' },
            { key: 'punctuality', label: 'Punctuality' },
            { key: 'efficiency', label: 'Efficiency' },
            { key: 'timeliness', label: 'Timeliness' },
            { key: 'support', label: 'Support' },
            { key: 'leadership', label: 'Leadership' },
            { key: 'docs', label: 'Docs' },
          ]}
          data={filtered}
          keyExtractor={(s) => `${s.employee_id}-${s.period}`}
          loading={isLoading}
          onRowClick={(s) => router.push(`/admin/hr/kpi/${s.employee_id}`)}
          emptyText="No KPI data for this period."
          emptyDescription="Try another period or run the snapshot."
          renderRow={(s: KpiScore) => [
            <span key="employee" className="font-medium">{s.employee?.name || `Employee ${s.employee_id}`}</span>,
            <Badge key="total" variant={scoreVariant(s.total_score) as any}>{s.total_score?.toFixed(1) || 0}</Badge>,
            <span key="punctuality">{s.punctuality_score?.toFixed(1) || 0}</span>,
            <span key="efficiency">{s.task_efficiency_score?.toFixed(1) || 0}</span>,
            <span key="timeliness">{s.task_timeliness_score?.toFixed(1) || 0}</span>,
            <span key="support">{s.support_resolution_score?.toFixed(1) || 0}</span>,
            <span key="leadership">{s.leadership_score?.toFixed(1) || 0}</span>,
            <span key="docs">{s.documentation_score?.toFixed(1) || 0}</span>,
          ]}
        />
      )}
    </PageShell>
  );
}
