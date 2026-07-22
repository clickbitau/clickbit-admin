'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { fetchKpiEmployeeHistory, snapshotKpi } from '@/lib/api';
import type { KpiScore } from '@/types/hr';
import { ArrowLeft, BarChart3, Calendar, Info, RefreshCw, Trophy, User } from 'lucide-react';

function scoreVariant(score: number) {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
}

function scoreInsights(s: KpiScore) {
  const insights: string[] = [];
  const m = s.metadata || {};
  if (s.total_score != null && s.total_score < 60) insights.push('Overall performance is below expectations');
  if (s.punctuality_score != null && s.punctuality_score < 70) {
    const lateMinutes = Number((m as any).lateMinutes || 0);
    const missingBreaks = Number((m as any).missingBreaks || 0);
    if (lateMinutes > 0 || missingBreaks > 0) insights.push(`Punctuality impacted by ${lateMinutes} late minutes and ${missingBreaks} missing breaks`);
    else insights.push('Punctuality is low (late clock-ins or absences)');
  }
  if (s.task_efficiency_score != null && s.task_efficiency_score < 70) {
    const actual = Number((m as any).taskActualHours || 0);
    const estimated = Number((m as any).taskEstimatedHours || 0);
    if (estimated > 0 && actual > estimated) insights.push(`Tasks overran estimate by ${(actual - estimated).toFixed(1)}h (${actual.toFixed(1)}h actual vs ${estimated.toFixed(1)}h estimated)`);
    else insights.push('Task efficiency is low (actual hours exceed or no baseline)');
  }
  if (s.task_timeliness_score != null && s.task_timeliness_score < 70) {
    const avgDays = Number((m as any).averageDaysDelta || 0);
    if (avgDays > 0) insights.push(`Tasks delivered an average of ${avgDays.toFixed(1)} days late`);
    else insights.push('Task timeliness is low (deadlines missed)');
  }
  if (s.support_resolution_score != null && s.support_resolution_score < 70) {
    const tickets = Number((m as any).ticketCount || 0);
    insights.push(`Support resolution is slow (${tickets} ticket${tickets === 1 ? '' : 's'} in period)`);
  }
  if (s.leadership_score != null && s.leadership_score < 70) {
    const phases = Number((m as any).managedPhasesCount || 0);
    insights.push(phases > 0 ? `Leadership contribution is low (${phases} managed phases)` : 'No leadership/mentoring contribution recorded');
  }
  if (s.documentation_score != null && s.documentation_score < 70) {
    const ratio = String((m as any).documentedItemsRatio || '0/0');
    insights.push(`Documentation is low (${ratio} documented)`);
  }
  return insights;
}

function metadataSummary(s: KpiScore) {
  const m = s.metadata || {};
  const items = [
    { label: 'Tasks', value: Number((m as any).taskCount || 0) },
    { label: 'Tickets', value: Number((m as any).ticketCount || 0) },
    { label: 'Task hours', value: `${Number((m as any).taskActualHours || 0).toFixed(1)} / ${Number((m as any).taskEstimatedHours || 0).toFixed(1)}` },
    { label: 'Avg days delta', value: Number((m as any).averageDaysDelta || 0).toFixed(1) },
    { label: 'Late minutes', value: Number((m as any).lateMinutes || 0) },
    { label: 'Missing breaks', value: Number((m as any).missingBreaks || 0) },
    { label: 'Documentation', value: String((m as any).documentedItemsRatio || '0/0') },
    { label: 'Managed phases', value: Number((m as any).managedPhasesCount || 0) },
  ];
  return items;
}

export default function AdminKpiEmployeeDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<KpiScore[]>({
    queryKey: ['kpi-history', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchKpiEmployeeHistory(token, id);
    },
    enabled: !!token && !!id,
  });

  const scores = useMemo(() => data ?? [], [data]);
  const employeeName = scores[0]?.employee?.name || `Employee ${id}`;

  const latest = scores[0];

  const stats = useMemo(() => {
    const total = scores.length;
    const avg = total ? scores.reduce((sum, s) => sum + (s.total_score || 0), 0) / total : 0;
    const best = scores.slice().sort((a, b) => (b.total_score || 0) - (a.total_score || 0))[0];
    return { total, avg, best };
  }, [scores]);

  const statCards = [
    { label: 'Total Scores', value: stats.total, icon: Calendar },
    { label: 'Average Score', value: stats.avg.toFixed(1), icon: BarChart3 },
    { label: 'Latest Score', value: latest ? latest.total_score.toFixed(1) : '-', icon: Trophy, accent: latest ? (scoreVariant(latest.total_score) as any) : undefined },
    { label: 'Best Period', value: stats.best ? `${stats.best.period} (${stats.best.total_score.toFixed(1)})` : '-', icon: Trophy, accent: 'success' as const },
  ];

  const snapshot = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      const period = new Date().toISOString().substring(0, 7);
      return snapshotKpi(token, period, [Number(id)]);
    },
    onSuccess: () => {
      toast.success('KPI snapshot created');
      queryClient.invalidateQueries({ queryKey: ['kpi-history', token, id] });
      queryClient.invalidateQueries({ queryKey: ['kpi-dashboard', token] });
    },
    onError: () => toast.error('Snapshot failed'),
  });

  if (error) {
    return (
      <PageShell title="KPI History" icon={BarChart3} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/hr/kpi"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load KPI history.</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`${employeeName} — KPI History`}
      icon={BarChart3}
      description="Employee performance score history and breakdown."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/admin/hr/kpi"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>
          <Button variant="outline" size="sm" onClick={() => snapshot.mutate()} disabled={snapshot.isPending}><RefreshCw className="mr-1 h-4 w-4" /> Snapshot</Button>
        </div>
      }
    >
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <StatCards cards={statCards} />

          <Card className="nm-raised">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> {employeeName}</CardTitle>
            </CardHeader>
            <CardContent>
              {scores.length === 0 ? (
                <div className="text-muted-foreground">No KPI history found for this employee.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
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
                    {scores.map((s) => (
                      <TableRow key={s.period}>
                        <TableCell className="font-medium">{s.period}</TableCell>
                        <TableCell><Badge variant={scoreVariant(s.total_score) as any}>{s.total_score.toFixed(1)}</Badge></TableCell>
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

          {latest?.metadata && (
            <Card className="nm-raised">
              <CardHeader><CardTitle className="flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> Latest Insights — {latest.period}</CardTitle></CardHeader>
              <CardContent>
                {scoreInsights(latest).length > 0 ? (
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-4">
                    {scoreInsights(latest).map((insight, i) => (
                      <li key={i}>{insight}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">No issues — all component scores are healthy.</p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {metadataSummary(latest).map((item) => (
                    <div key={item.label} className="nm-raised-sm p-2">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="font-semibold">{item.value}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}
