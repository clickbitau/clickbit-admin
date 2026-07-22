'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BarChart3, Calendar, RefreshCw, Search, Trophy, TrendingUp, Users } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

function rankBadgeClass(index: number) {
  if (index === 0) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200';
  if (index === 1) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-200';
  if (index === 2) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200';
  return 'bg-muted text-muted-foreground border-border';
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
  const [selected, setSelected] = useState<KpiScore | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['kpi-dashboard', token, period],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchKpiDashboard(token, period); },
    enabled: !!token && /^\d{4}-\d{2}$/.test(period),
  });

  const scores = useMemo(() => data?.scores ?? [], [data?.scores]);

  const sortedScores = useMemo(() => {
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

  function employeeName(s?: KpiScore | null) {
    return s?.employee?.name || `Employee ${s?.employee_id}`;
  }

  function metadataCounts(s: KpiScore) {
    const taskCount = (s.metadata?.taskCount as number) ?? 0;
    const ticketCount = (s.metadata?.ticketCount as number) ?? 0;
    return { taskCount, ticketCount };
  }

  const detailCards = selected ? [
    { label: 'Total Score', value: selected.total_score?.toFixed(1) || 0, icon: Trophy, accent: scoreVariant(selected.total_score) as any },
    { label: 'Punctuality', value: selected.punctuality_score?.toFixed(1) || 0, icon: Calendar },
    { label: 'Task Efficiency', value: selected.task_efficiency_score?.toFixed(1) || 0, icon: TrendingUp },
    { label: 'Task Timeliness', value: selected.task_timeliness_score?.toFixed(1) || 0, icon: Calendar },
    { label: 'Support Resolution', value: selected.support_resolution_score?.toFixed(1) || 0, icon: Trophy },
    { label: 'Leadership', value: selected.leadership_score?.toFixed(1) || 0, icon: Users },
    { label: 'Documentation', value: selected.documentation_score?.toFixed(1) || 0, icon: BarChart3 },
  ] : [];

  return (
    <PageShell title="KPI Dashboard" icon={BarChart3} description="Track employee performance and KPI scores by month.">
      <StatCards cards={statCards} />

      <div className="nm-raised p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" className="max-w-[140px]" />
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search employee..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))} className="flex-1">
              {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </Button>
            <Button onClick={() => snapshot.mutate()} disabled={snapshot.isPending}>
              <RefreshCw className={`mr-1 h-4 w-4 ${snapshot.isPending ? 'animate-spin' : ''}`} /> Snapshot
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="text-destructive text-sm">Failed to load KPI dashboard.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <Card className="overflow-hidden">
              <CardHeader className="p-4">
                <CardTitle className="text-base">Leaderboard</CardTitle>
              </CardHeader>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {isLoading && sortedScores.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">Loading…</div>
                ) : sortedScores.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <p>No calculations run for {period}</p>
                    <p className="text-xs mt-1">Click Snapshot to generate.</p>
                  </div>
                ) : (
                  sortedScores.map((s, idx) => {
                    const { taskCount, ticketCount } = metadataCounts(s);
                    const isSelected = selected?.employee_id === s.employee_id;
                    return (
                      <button
                        key={`${s.employee_id}-${s.period}`}
                        onClick={() => setSelected(s)}
                        className={`w-full text-left flex items-center justify-between gap-3 p-4 transition-colors border-l-4 ${isSelected ? 'border-l-primary bg-primary/5' : 'border-l-transparent hover:bg-muted/50'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${rankBadgeClass(idx)}`}>
                            #{idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{employeeName(s)}</p>
                            <p className="text-xs text-muted-foreground">{taskCount} tasks · {ticketCount} tickets</p>
                          </div>
                        </div>
                        <p className={`font-bold text-lg ${s.total_score >= 100 ? 'text-green-600' : ''}`}>{s.total_score?.toFixed(1) || 0}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {selected ? (
              <Card className="h-full">
                <CardHeader className="p-5 border-b">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={employeeName(selected)} />
                      <div>
                        <CardTitle className="text-xl">{employeeName(selected)}</CardTitle>
                        <p className="text-sm text-muted-foreground">{selected.period} · Total score {selected.total_score?.toFixed(1) || 0}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/hr/kpi/${selected.employee_id}`}>
                        History <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <StatCards cards={detailCards} />
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] nm-raised text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-3 opacity-20" />
                <p>Select an employee from the leaderboard to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
