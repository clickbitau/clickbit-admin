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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { deletePayslip, fetchPayslip, fetchPayslipPdf, resendPayslipEmail } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { ArrowLeft, Download, FileText, Mail, Trash, Wallet } from 'lucide-react';

function statusVariant(status?: string | null) {
  if (status === 'paid') return 'default';
  if (status === 'sent') return 'secondary';
  if (status === 'generated' || status === 'pending') return 'outline';
  return 'outline';
}

export default function AdminPayslipDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['payslip', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchPayslip(token, id);
    },
    enabled: !!token && !!id,
  });

  const payslip = data;
  const displayName = payslip ? `Payslip #${payslip.id}` : 'Payslip';

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['payslip', token, id] });
    queryClient.invalidateQueries({ queryKey: ['payslips', token] });
  };

  const resend = useMutation({
    mutationFn: () => resendPayslipEmail(token!, id),
    onSuccess: () => toast.success('Payslip email resent'),
    onError: () => toast.error('Resend failed'),
  });

  const download = useMutation({
    mutationFn: async () => {
      const blob = await fetchPayslipPdf(token!, id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip-${payslip?.id || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    onError: () => toast.error('PDF download failed'),
  });

  const remove = useMutation({
    mutationFn: () => deletePayslip(token!, id),
    onSuccess: () => { toast.success('Payslip deleted'); router.push('/admin/hr/payslips'); },
    onError: () => toast.error('Delete failed'),
  });

  if (error) {
    return (
      <PageShell title="Payslip" icon={FileText} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/hr/payslips"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load payslip.</div>
      </PageShell>
    );
  }

  const statCards = payslip
    ? [
        { label: 'Status', value: payslip.status || 'draft', icon: Wallet, accent: payslip.status === 'paid' ? 'success' as const : 'warning' as const },
        { label: 'Gross pay', value: formatCurrency(payslip.gross_pay), icon: Wallet },
        { label: 'Net pay', value: formatCurrency(payslip.net_pay), icon: Wallet },
        { label: 'Payment date', value: formatDate(payslip.payment_date), icon: FileText },
      ]
    : [];

  return (
    <PageShell
      title={displayName}
      icon={FileText}
      description={payslip ? `${payslip.employee?.name || `Employee ${payslip.employee_id}`} · ${formatDate(payslip.pay_period_start)} – ${formatDate(payslip.pay_period_end)}` : ''}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/admin/hr/payslips"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>
          <Button variant="outline" size="sm" onClick={() => download.mutate()} disabled={download.isPending}><Download className="mr-1 h-4 w-4" /> PDF</Button>
          <Button variant="outline" size="sm" onClick={() => resend.mutate()} disabled={resend.isPending}><Mail className="mr-1 h-4 w-4" /> Resend</Button>
          <Button variant="destructive" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash className="mr-1 h-4 w-4" /> Delete</Button>
        </div>
      }
    >
      {isLoading || !payslip ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <StatCards cards={statCards} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{displayName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{payslip.employee?.name || `Employee ${payslip.employee_id}`}</p>
                    </div>
                    <Badge variant={statusVariant(payslip.status)}>{payslip.status || 'draft'}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <p><span className="text-muted-foreground">Pay period:</span> {formatDate(payslip.pay_period_start)} – {formatDate(payslip.pay_period_end)}</p>
                    <p><span className="text-muted-foreground">Payment date:</span> {formatDate(payslip.payment_date)}</p>
                    <p><span className="text-muted-foreground">Frequency:</span> {payslip.pay_frequency || '—'}</p>
                    <p><span className="text-muted-foreground">Currency:</span> {payslip.currency || 'AUD'}</p>
                    <p><span className="text-muted-foreground">Gross pay:</span> {formatCurrency(payslip.gross_pay)}</p>
                    <p><span className="text-muted-foreground">Tax withheld:</span> {formatCurrency(payslip.tax_withheld)}</p>
                    <p><span className="text-muted-foreground">Superannuation:</span> {formatCurrency(payslip.superannuation)}</p>
                    <p><span className="text-muted-foreground">Net pay:</span> {formatCurrency(payslip.net_pay)}</p>
                    <p><span className="text-muted-foreground">YTD gross:</span> {formatCurrency(payslip.ytd_gross)}</p>
                    <p><span className="text-muted-foreground">YTD tax:</span> {formatCurrency(payslip.ytd_tax)}</p>
                    <p><span className="text-muted-foreground">YTD super:</span> {formatCurrency(payslip.ytd_super)}</p>
                  </div>

                  {payslip.notes && (
                    <div className="rounded bg-muted p-3">
                      <h4 className="font-medium mb-1">Notes</h4>
                      <p className="whitespace-pre-wrap text-muted-foreground">{payslip.notes}</p>
                    </div>
                  )}

                  {payslip.line_items && payslip.line_items.length > 0 && (
                    <div className="rounded bg-muted p-3">
                      <h4 className="font-medium mb-2">Line items</h4>
                      <ul className="space-y-1">
                        {payslip.line_items.map((item: any, idx: number) => (
                          <li key={idx} className="flex justify-between">
                            <span>{item.description || 'Earning'}</span>
                            <span className="text-muted-foreground">{formatCurrency(item.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {payslip.leave_data && Object.keys(payslip.leave_data).length > 0 && (
                    <div className="rounded bg-muted p-3">
                      <h4 className="font-medium mb-1">Leave data</h4>
                      <pre className="text-xs text-muted-foreground overflow-x-auto">{JSON.stringify(payslip.leave_data, null, 2)}</pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Employee</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="font-medium">{payslip.employee?.name || `Employee ${payslip.employee_id}`}</p>
                  <p className="text-muted-foreground">{payslip.employee?.email || '—'}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full" onClick={() => download.mutate()} disabled={download.isPending}><Download className="mr-1 h-4 w-4" /> Download PDF</Button>
                  <Button variant="outline" className="w-full" onClick={() => resend.mutate()} disabled={resend.isPending}><Mail className="mr-1 h-4 w-4" /> Resend Email</Button>
                  <Button variant="destructive" className="w-full" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash className="mr-1 h-4 w-4" /> Delete</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
