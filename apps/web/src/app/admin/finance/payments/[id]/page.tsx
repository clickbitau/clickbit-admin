'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { PageShell } from '@/components/design-system/PageShell';
import { fetchPayment, deletePayment } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Payment } from '@/types/finance';
import { ArrowLeft, CreditCard, Trash2, Building2, FileText, Folder } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPaymentDetailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const { data: response, isLoading, error } = useQuery<{ success: boolean; data: Payment }>({
    queryKey: ['payment', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchPayment(token!, id) as unknown as { success: boolean; data: Payment };
    },
    enabled: !!token && !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePayment(token!, id),
    onSuccess: () => {
      toast.success('Payment deleted');
      router.push('/admin/finance/payments');
    },
    onError: () => toast.error('Failed to delete payment'),
  });

  if (error) {
    return (
      <PageShell title="Payment" icon={CreditCard} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/finance/payments"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load payment.</div>
      </PageShell>
    );
  }

  const payment = response?.data;
  const net = (payment?.amount ?? 0) - (payment?.gateway_fee ?? 0);

  return (
    <PageShell
      title={payment ? payment.transaction_id || `Payment #${payment.id}` : 'Payment'}
      icon={CreditCard}
      description={payment ? `${formatCurrency(payment.amount)} · ${payment.status}` : ''}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/finance/payments"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
        </div>
      }
    >
      {isLoading || !payment ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{payment.transaction_id || `Payment #${payment.id}`}</CardTitle>
                    <p className="text-sm text-muted-foreground">{payment.payment_provider || 'Manual'} · {payment.payment_method || '-'}</p>
                  </div>
                  <Badge variant={payment.status === 'completed' ? 'default' : payment.status === 'failed' ? 'destructive' : 'secondary'}>{payment.status || 'pending'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 text-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <p><span className="text-muted-foreground">Date:</span> {formatDate(payment.payment_date || payment.created_at)}</p>
                  <p><span className="text-muted-foreground">Processed:</span> {formatDate(payment.processed_at)}</p>
                  <p><span className="text-muted-foreground">Method:</span> {payment.payment_method || '-'}</p>
                  <p><span className="text-muted-foreground">Provider:</span> {payment.payment_provider || '-'}</p>
                  {payment.failed_at && <p><span className="text-muted-foreground">Failed at:</span> {formatDate(payment.failed_at)}</p>}
                  {payment.retry_count ? <p><span className="text-muted-foreground">Retries:</span> {payment.retry_count}</p> : null}
                </div>

                {payment.notes && (
                  <>
                    <Separator />
                    <div><h4 className="font-medium mb-1">Notes</h4><p className="whitespace-pre-wrap text-muted-foreground">{payment.notes}</p></div>
                  </>
                )}

                {(payment.gateway_response || payment.gateway_error) && (
                  <>
                    <Separator />
                    <div className="grid gap-3 md:grid-cols-2">
                      {payment.gateway_response && <p><span className="text-muted-foreground">Gateway response:</span> {payment.gateway_response}</p>}
                      {payment.gateway_error && <p><span className="text-destructive">Gateway error:</span> {payment.gateway_error}</p>}
                    </div>
                  </>
                )}

                {Number(payment.refunded_amount) > 0 && (
                  <>
                    <Separator />
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <p className="font-medium text-destructive">Refund recorded</p>
                      <p className="text-muted-foreground">{formatCurrency(payment.refunded_amount)} on {formatDate(payment.refunded_at)} {payment.refunded_reason ? `· ${payment.refunded_reason}` : ''}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {payment.billing_address && (
              <Card>
                <CardHeader><CardTitle>Billing address</CardTitle></CardHeader>
                <CardContent><p className="whitespace-pre-wrap text-sm">{payment.billing_address}</p></CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Amounts</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>{formatCurrency(payment.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gateway fee</span><span>{formatCurrency(payment.gateway_fee ?? 0)}</span></div>
                <Separator />
                <div className="flex justify-between font-semibold"><span>Net</span><span>{formatCurrency(net)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Refunded</span><span>{formatCurrency(payment.refunded_amount ?? 0)}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Related</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {payment.invoice ? (
                  <Link href={`/admin/finance/invoices/${payment.invoice.id}`} className="flex items-center gap-3 hover:underline">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><FileText className="w-4 h-4 text-gray-600 dark:text-gray-300" /></div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{payment.invoice.title || payment.invoice.invoice_number || `#${payment.invoice.id}`}</p>
                      <p className="text-xs text-muted-foreground">{payment.invoice.client_name || payment.invoice.client_company || 'Invoice'}</p>
                    </div>
                  </Link>
                ) : (
                  <p className="text-muted-foreground">No linked invoice.</p>
                )}
                {payment.project && (
                  <Link href={`/admin/crm/projects/${payment.project.id}`} className="flex items-center gap-3 hover:underline">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Folder className="w-4 h-4 text-gray-600 dark:text-gray-300" /></div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{payment.project.name}</p>
                      <p className="text-xs text-muted-foreground">{payment.project.project_number || 'Project'}</p>
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
