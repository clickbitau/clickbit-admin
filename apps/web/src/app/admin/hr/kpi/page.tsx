'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Calendar, RefreshCw, Trophy, Users } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/components/auth/AuthProvider';
import { fetchKpiDashboard, snapshotKpi } from '@/lib/api';

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function scoreVariant(score: number) {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
}

export default function AdminHrKpiPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());

  const { data, isLoading, error } = useQuery({
    queryKey: ['kpi-dashboard', token, period],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchKpiDashboard(token, period);
    },
    enabled: !!token && /^\d{4}-\d{2}$/.test(period),
  });

  const scores = useMemo(() => data?.scores ?? [], [data?.scores]);

  const stats = useMemo(() => {
    const total = scores.length;
    const avg = total ? scores.reduce((sum, s) => sum + (s.total_score || 0), 0) / total : 0;
    const top = scores.slice().sort((a, b) => (b.total_score || 0) - (a.total_score || 0))[0];
    const low = scores.slice().sort((a, b) => (a.total_score || 0) - (b.total_score || 0))[0];
    return { total, avg, top, low };
  }, [scores]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['kpi-dashboard', token] });

  const snapshot = useMutation({
    mutationFn: () => {
      if (!token) throw new Error('No token');
      return snapshotKpi(token, period);
    },
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

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="YYYY-MM"
            className="max-w-[140px]"
          />
        </div>
        <Button onClick={() => snapshot.mutate()} disabled={snapshot.isPending}>
          <RefreshCw className="mr-2 h-4 w-4" /> Snapshot KPI
        </Button>
      </div>

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle>Performance Scores — {period}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="text-destructive">Failed to load KPI dashboard.</div>}
          {isLoading && <div className="text-muted-foreground">Loading...</div>}

          {!isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Punctuality</TableHead>
                  <TableHead>Efficiency</TableHead>
                  <TableHead>Timeliness</TableHead>
                  <TableHead>Support</TableHead>
                  <TableHead>Leadership</TableHead>
                  <TableHead>Docs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">No KPI data for this period.</TableCell>
                  </TableRow>
                )}
                {scores.map((s: any) => (
                  <TableRow
                    key={`${s.employee_id}-${s.period}`}
                    className="cursor-pointer hover:bg-primary/5"
                    onClick={() => router.push(`/admin/hr/kpi/${s.employee_id}`)}
                  >
                    <TableCell className="font-medium">{s.employee?.name || `Employee ${s.employee_id}`}</TableCell>
                    <TableCell>
                      <Badge variant={scoreVariant(s.total_score) as any}>{s.total_score?.toFixed(1) || 0}</Badge>
                    </TableCell>
                    <TableCell>{s.punctuality_score?.toFixed(1) || 0}</TableCell>
                    <TableCell>{s.task_efficiency_score?.toFixed(1) || 0}</TableCell>
                    <TableCell>{s.task_timeliness_score?.toFixed(1) || 0}</TableCell>
                    <TableCell>{s.support_resolution_score?.toFixed(1) || 0}</TableCell>
                    <TableCell>{s.leadership_score?.toFixed(1) || 0}</TableCell>
                    <TableCell>{s.documentation_score?.toFixed(1) || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
