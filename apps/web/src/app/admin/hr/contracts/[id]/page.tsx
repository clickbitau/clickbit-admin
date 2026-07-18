'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { activateContract, fetchContract, fetchContractPdfUrl, terminateContract } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { ArrowLeft, CheckCircle, Download, FileText, Power, XCircle } from 'lucide-react';

function statusVariant(status?: string | null) {
  if (status === 'active') return 'default';
  if (status === 'pending') return 'secondary';
  if (status === 'terminated' || status === 'superseded') return 'destructive';
  return 'outline';
}

export default function AdminContractDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['contract', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchContract(token, id);
    },
    enabled: !!token && !!id,
  });

  const contract = data;
  const displayName = contract ? `Contract #${contract.contract_number || contract.id}` : 'Contract';

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['contract', token, id] });
    queryClient.invalidateQueries({ queryKey: ['contracts', token] });
  };

  const activate = useMutation({
    mutationFn: () => activateContract(token!, Number(id)),
    onSuccess: () => { toast.success('Contract activated'); invalidate(); },
    onError: () => toast.error('Activation failed'),
  });

  const terminate = useMutation({
    mutationFn: () => terminateContract(token!, Number(id), 'Terminated from detail page'),
    onSuccess: () => { toast.success('Contract terminated'); invalidate(); },
    onError: () => toast.error('Termination failed'),
  });

  const download = useMutation({
    mutationFn: async () => {
      const blob = await fetchContractPdfUrl(token!, Number(id));
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contract-${contract?.contract_number || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    onError: () => toast.error('PDF download failed'),
  });

  if (error) {
    return (
      <PageShell title="Contract" icon={FileText} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/hr/contracts"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load contract.</div>
      </PageShell>
    );
  }

  const statCards = contract
    ? [
        { label: 'Status', value: contract.status || 'active', icon: contract.status === 'active' ? CheckCircle : XCircle, accent: contract.status === 'active' ? 'success' as const : 'warning' as const },
        { label: 'Salary', value: formatCurrency(contract.salary ?? undefined, contract.currency || 'AUD'), icon: FileText },
        { label: 'Hourly rate', value: formatCurrency(contract.hourly_rate ?? undefined, contract.currency || 'AUD'), icon: FileText },
        { label: 'Start date', value: formatDate(contract.start_date), icon: FileText },
      ]
    : [];

  return (
    <PageShell
      title={displayName}
      icon={FileText}
      description={contract ? `${contract.employment_type?.replace('_', ' ')} · ${contract.position || 'No position'}` : ''}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/admin/hr/contracts"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>
          <Button variant="outline" size="sm" onClick={() => download.mutate()} disabled={download.isPending}><Download className="mr-1 h-4 w-4" /> PDF</Button>
          {contract?.status !== 'active' && <Button size="sm" onClick={() => activate.mutate()} disabled={activate.isPending}><Power className="mr-1 h-4 w-4" /> Activate</Button>}
          {contract?.status !== 'terminated' && <Button variant="destructive" size="sm" onClick={() => terminate.mutate()} disabled={terminate.isPending}><XCircle className="mr-1 h-4 w-4" /> Terminate</Button>}
        </div>
      }
    >
      {isLoading || !contract ? (
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
                      <CardTitle className="text-2xl">{displayName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{contract.position || 'No position'} · {contract.department || 'No department'}</p>
                    </div>
                    <Badge variant={statusVariant(contract.status)}>{contract.status || 'active'}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <p><span className="text-muted-foreground">Employment type:</span> {contract.employment_type?.replace('_', ' ') || '—'}</p>
                    <p><span className="text-muted-foreground">Pay frequency:</span> {contract.pay_frequency || '—'}</p>
                    <p><span className="text-muted-foreground">Start date:</span> {formatDate(contract.start_date)}</p>
                    <p><span className="text-muted-foreground">End date:</span> {formatDate(contract.end_date)}</p>
                    <p><span className="text-muted-foreground">Renewal date:</span> {formatDate(contract.renewal_date)}</p>
                    <p><span className="text-muted-foreground">Default weekly hours:</span> {contract.default_weekly_hours ?? '—'}</p>
                    <p><span className="text-muted-foreground">Currency:</span> {contract.currency || 'AUD'}</p>
                    <p><span className="text-muted-foreground">Salary:</span> {formatCurrency(contract.salary ?? undefined, contract.currency || 'AUD')}</p>
                    <p><span className="text-muted-foreground">Hourly rate:</span> {formatCurrency(contract.hourly_rate ?? undefined, contract.currency || 'AUD')}</p>
                  </div>

                  {contract.terms_summary && (
                    <>
                      <Separator />
                      <div><h4 className="font-medium mb-1">Terms summary</h4><p className="whitespace-pre-wrap text-muted-foreground">{contract.terms_summary}</p></div>
                    </>
                  )}

                  {contract.responsibilities && (
                    <>
                      <Separator />
                      <div><h4 className="font-medium mb-1">Responsibilities</h4><p className="whitespace-pre-wrap text-muted-foreground">{contract.responsibilities}</p></div>
                    </>
                  )}

                  {contract.notes && (
                    <>
                      <Separator />
                      <div><h4 className="font-medium mb-1">Notes</h4><p className="whitespace-pre-wrap text-muted-foreground">{contract.notes}</p></div>
                    </>
                  )}

                  {contract.change_reason && (
                    <>
                      <Separator />
                      <div><h4 className="font-medium mb-1">Change reason</h4><p className="whitespace-pre-wrap text-muted-foreground">{contract.change_reason}</p></div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Employee</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="font-medium">{contract.employee?.name || `Employee ${contract.employee_id}`}</p>
                  <p className="text-muted-foreground">{contract.employee?.email || '—'}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Manager</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="font-medium">{contract.manager?.name || `Manager ${contract.manager_id || '—'}`}</p>
                  <p className="text-muted-foreground">{contract.manager?.email || '—'}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Work location</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Address:</span> {contract.work_address || '—'}</p>
                  <p><span className="text-muted-foreground">City:</span> {contract.work_city || '—'}</p>
                  <p><span className="text-muted-foreground">State:</span> {contract.work_state || '—'}</p>
                  <p><span className="text-muted-foreground">Postcode:</span> {contract.work_postcode || '—'}</p>
                  <p><span className="text-muted-foreground">Country:</span> {contract.work_country || '—'}</p>
                  <p><span className="text-muted-foreground">Timezone:</span> {contract.work_timezone || '—'}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {contract.status !== 'active' && <Button className="w-full" onClick={() => activate.mutate()} disabled={activate.isPending}><Power className="mr-1 h-4 w-4" /> Activate</Button>}
                  {contract.status !== 'terminated' && <Button variant="destructive" className="w-full" onClick={() => terminate.mutate()} disabled={terminate.isPending}><XCircle className="mr-1 h-4 w-4" /> Terminate</Button>}
                  <Button variant="outline" className="w-full" onClick={() => download.mutate()} disabled={download.isPending}><Download className="mr-1 h-4 w-4" /> Download PDF</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
