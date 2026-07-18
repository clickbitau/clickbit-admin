'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bug, ArrowLeft, RefreshCw, CheckCircle, GitMerge, RotateCcw, Play, XCircle } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { fetchBugReport, fetchBugReportPrDetails, syncBugReport, retryBugReport, approveBugReport, forceMergeBugReport, markBugReportFixed, updateBugReportStatus } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { BugReport } from '@/types/bug-reports';

const statusOptions = ['pending', 'investigating', 'fixing', 'blocked', 'merged', 'deployed', 'failed', 'cancelled'];

function statusVariant(status?: string | null) {
  if (!status) return 'outline';
  if (['merged', 'deployed'].includes(status)) return 'default';
  if (status === 'pending') return 'secondary';
  if (['investigating', 'fixing'].includes(status)) return 'outline';
  if (['blocked', 'failed'].includes(status)) return 'destructive';
  return 'secondary';
}

export default function AdminBugReportDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ success: boolean; data: BugReport & { pipelineStatus?: string | null } }>({
    queryKey: ['bug-report', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchBugReport(token, id);
    },
    enabled: !!token && !!id,
  });

  const prDetailsQuery = useQuery<{ success: boolean; data: Record<string, unknown> }>({
    queryKey: ['bug-report-pr', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchBugReportPrDetails(token, id);
    },
    enabled: !!token && !!id,
  });

  const report = data?.data;
  const prDetails = prDetailsQuery.data?.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['bug-report', token, id] });
    queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
    queryClient.invalidateQueries({ queryKey: ['bug-report-stats'] });
  };

  const syncMutation = useMutation({ mutationFn: () => syncBugReport(token!, id), onSuccess: () => { toast.success('Synced'); invalidate(); }, onError: () => toast.error('Sync failed') });
  const retryMutation = useMutation({ mutationFn: () => retryBugReport(token!, id), onSuccess: () => { toast.success('Retried'); invalidate(); }, onError: () => toast.error('Retry failed') });
  const approveMutation = useMutation({ mutationFn: () => approveBugReport(token!, id), onSuccess: () => { toast.success('Approved'); invalidate(); }, onError: () => toast.error('Approve failed') });
  const mergeMutation = useMutation({ mutationFn: () => forceMergeBugReport(token!, id), onSuccess: () => { toast.success('Force merged'); invalidate(); }, onError: () => toast.error('Force merge failed') });
  const fixedMutation = useMutation({ mutationFn: () => markBugReportFixed(token!, id, {}), onSuccess: () => { toast.success('Marked fixed'); invalidate(); }, onError: () => toast.error('Mark fixed failed') });
  const statusMutation = useMutation({ mutationFn: (status: string) => updateBugReportStatus(token!, id, { status }), onSuccess: () => { toast.success('Status updated'); invalidate(); }, onError: () => toast.error('Status update failed') });

  if (error) {
    return (
      <PageShell title="Bug Report" icon={Bug} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/bug-reports"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load bug report.</div>
      </PageShell>
    );
  }

  const title = report ? `#${report.id} ${report.title}` : 'Bug Report';
  const statCards = report
    ? [
        { label: 'Status', value: report.status || 'pending', icon: report.status === 'merged' || report.status === 'deployed' ? CheckCircle : XCircle, accent: report.status === 'merged' || report.status === 'deployed' ? 'success' : 'warning' as any },
        { label: 'Priority', value: report.priority || 'medium', icon: Bug },
        { label: 'Category', value: report.category || 'other', icon: Bug },
        { label: 'PR #', value: report.pull_request_number ? `#${report.pull_request_number}` : 'None', icon: GitMerge },
      ]
    : [];

  return (
    <PageShell
      title={title}
      icon={Bug}
      description={report ? `Reported ${formatDate(report.created_at)} · ${report.target_repo || 'no repo'}` : ''}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/admin/bug-reports"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>
          <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}><RefreshCw className="mr-1 h-4 w-4" /> Sync</Button>
          <Button variant="outline" size="sm" onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending}><RotateCcw className="mr-1 h-4 w-4" /> Retry</Button>
        </div>
      }
    >
      {isLoading || !report ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <StatCards cards={statCards} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-2xl">{report.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{report.category} · reported by {report.reporter ? `${report.reporter.first_name} ${report.reporter.last_name}` : 'Unknown'}</p>
                    </div>
                    <Badge variant={statusVariant(report.status)}>{report.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 text-sm">
                  <div>
                    <h4 className="font-medium mb-1">Description</h4>
                    <p className="whitespace-pre-wrap text-muted-foreground">{report.description}</p>
                  </div>

                  {report.error_message && (
                    <>
                      <Separator />
                      <div className="rounded-lg bg-destructive/5 p-3 text-destructive">
                        <h4 className="font-medium">Error message</h4>
                        <p className="whitespace-pre-wrap">{report.error_message}</p>
                      </div>
                    </>
                  )}

                  {report.fix_summary && (
                    <>
                      <Separator />
                      <div><h4 className="font-medium mb-1">Fix summary</h4><p className="whitespace-pre-wrap text-muted-foreground">{report.fix_summary}</p></div>
                    </>
                  )}

                  {report.screenshot_url && (
                    <>
                      <Separator />
                      <div><h4 className="font-medium mb-1">Screenshot</h4><a href={report.screenshot_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{report.screenshot_url}</a></div>
                    </>
                  )}

                  {report.devin_session_url && (
                    <>
                      <Separator />
                      <div><h4 className="font-medium mb-1">Devin session</h4><a href={report.devin_session_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{report.devin_session_url}</a></div>
                    </>
                  )}

                  {report.pull_request_url && (
                    <>
                      <Separator />
                      <div><h4 className="font-medium mb-1">Pull request</h4><a href={report.pull_request_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{report.pull_request_url}</a></div>
                    </>
                  )}
                </CardContent>
              </Card>

              {prDetails && Object.keys(prDetails).length > 0 && (
                <Card>
                  <CardHeader><CardTitle>PR Details</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-2">
                    {prDetails.title ? <p><span className="text-muted-foreground">Title:</span> {String(prDetails.title)}</p> : null}
                    {prDetails.state ? <p><span className="text-muted-foreground">State:</span> {String(prDetails.state)}</p> : null}
                    {prDetails.error ? <p className="text-destructive">{String(prDetails.error)}</p> : null}
                    <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(prDetails, null, 2)}</pre>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}><CheckCircle className="mr-1 h-4 w-4" /> Approve</Button>
                    <Button onClick={() => mergeMutation.mutate()} disabled={mergeMutation.isPending}><GitMerge className="mr-1 h-4 w-4" /> Force merge</Button>
                    <Button variant="outline" onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending}><Play className="mr-1 h-4 w-4" /> Retry</Button>
                    <Button variant="outline" onClick={() => fixedMutation.mutate()} disabled={fixedMutation.isPending}><CheckCircle className="mr-1 h-4 w-4" /> Mark fixed</Button>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">Set status</p>
                    <div className="flex flex-wrap gap-2">
                      {statusOptions.map((s) => (
                        <Button key={s} variant={report.status === s ? 'default' : 'outline'} size="sm" onClick={() => statusMutation.mutate(s)} disabled={statusMutation.isPending || report.status === s}>
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Target repo</span><span>{report.target_repo || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><span>{report.priority}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{report.category}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Requires approval</span><span>{report.require_approval ? 'Yes' : 'No'}</span></div>
                  {report.approver && <div className="flex justify-between"><span className="text-muted-foreground">Approved by</span><span>{report.approver.first_name} {report.approver.last_name}</span></div>}
                  {report.approved_at && <div className="flex justify-between"><span className="text-muted-foreground">Approved at</span><span>{formatDate(report.approved_at)}</span></div>}
                  {report.merged_at && <div className="flex justify-between"><span className="text-muted-foreground">Merged at</span><span>{formatDate(report.merged_at)}</span></div>}
                  {report.deployed_at && <div className="flex justify-between"><span className="text-muted-foreground">Deployed at</span><span>{formatDate(report.deployed_at)}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{formatDate(report.created_at)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span>{formatDate(report.updated_at)}</span></div>
                </CardContent>
              </Card>

              {report.pipelineStatus && (
                <Card>
                  <CardHeader><CardTitle>Pipeline status</CardTitle></CardHeader>
                  <CardContent><p className="text-sm">{report.pipelineStatus}</p></CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
