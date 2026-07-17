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
import { ArrowLeft, BarChart3, Calendar, RefreshCw, Trophy, User } from 'lucide-react';

function scoreVariant(score: number) {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
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
        <div className="flex items-center gap-2">
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

          <Card>
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
            <Card>
              <CardHeader><CardTitle>Latest Metadata — {latest.period}</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground overflow-x-auto">{JSON.stringify(latest.metadata, null, 2)}</pre>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}
