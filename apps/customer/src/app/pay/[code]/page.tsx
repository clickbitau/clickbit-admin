'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { fetchPublicInvoice, createInvoiceCheckout, downloadPublicInvoicePdf, confirmPublicInvoicePayment } from '@/lib/api';
import { toast } from 'sonner';
import { Download, CreditCard, AlertCircle } from 'lucide-react';

interface AxiosErrorLike {
  response?: { status?: number; data?: { message?: string } };
  message?: string;
}

function getErrorStatus(error: unknown): number | undefined {
  return (error as AxiosErrorLike)?.response?.status;
}

function getErrorMessage(error: unknown): string {
  const data = (error as AxiosErrorLike)?.response?.data;
  if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') return data.message;
  return (error as AxiosErrorLike)?.message || 'Unable to load invoice.';
}

export default function PublicPayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const code = String(params.code || '').trim();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [tokenInput, setTokenInput] = useState('');
  const [verified, setVerified] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<'full' | 'half'>('full');

  const sessionId = searchParams.get('session_id') || undefined;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public-invoice', code, token || null],
    queryFn: () => fetchPublicInvoice(code, token || undefined),
    enabled: !!code,
    retry: false,
  });

  useEffect(() => {
    setSelectedPayment('full');
  }, [code]);

  useEffect(() => {
    if (sessionId && code && !verified) {
      setVerified(true);
      confirmPublicInvoicePayment(code, sessionId, token || undefined)
        .then(() => {
          toast.success('Payment confirmed');
          queryClient.invalidateQueries({ queryKey: ['public-invoice', code, token || null] });
        })
        .catch(() => {
          toast.error('Payment confirmation failed');
        });
    }
  }, [sessionId, code, token, verified, queryClient]);

  const checkoutMutation = useMutation({
    mutationFn: () => createInvoiceCheckout(code, selectedPayment, token || undefined),
    onSuccess: (result) => {
      if (result?.url) {
        window.location.href = result.url;
      } else {
        toast.error('No checkout URL returned');
      }
    },
    onError: () => toast.error('Failed to start checkout'),
  });

  const pdfMutation = useMutation({
    mutationFn: () => downloadPublicInvoicePdf(code, token || undefined),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${code}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onError: () => toast.error('Failed to download PDF'),
  });

  const status = getErrorStatus(error);
  const message = getErrorMessage(error);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {status === 404 ? 'Invoice not found' : status === 403 ? 'Access denied' : 'Unable to load invoice'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{message}</p>
            {(status === 400 || status === 403) && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Enter the security token from your invoice email to continue.</p>
                <div className="flex gap-2">
                  <Input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Security token" className="flex-1" />
                  <Button onClick={() => { setToken(tokenInput); setTimeout(() => refetch(), 0); }}>Continue</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const full = data.payment_options?.full_payment;
  const half = data.payment_options?.half_payment;

  const formatCurrency = (value: number | string | undefined) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: data?.currency || 'AUD' }).format(Number(value ?? 0));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">ClickBit</h1>
          <p className="text-sm text-muted-foreground">Secure invoice payment</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{data.type === 'estimate' ? 'Estimate' : 'Invoice'} {data.invoice_number}</CardTitle>
                <p className="text-sm text-muted-foreground">{data.client_name} · {data.client_email}</p>
              </div>
              <Badge variant={data.is_paid ? 'default' : data.is_expired ? 'destructive' : 'secondary'}>
                {data.is_paid ? 'Paid' : data.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Title</span><span className="font-medium">{data.title}</span></div>
              <div className="flex justify-between"><span>Issue date</span><span>{data.sent_at ? new Date(data.sent_at).toLocaleDateString() : '—'}</span></div>
              <div className="flex justify-between"><span>Valid until</span><span>{data.valid_until ? new Date(data.valid_until).toLocaleDateString() : '—'}</span></div>
            </div>
            <Separator />
            <div className="space-y-2">
              {(data.items || []).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{item.name} × {item.quantity}</span>
                  <span>{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(data.subtotal)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(data.tax_amount)}</span></div>
              <div className="flex justify-between"><span>Total</span><span className="font-semibold">{formatCurrency(data.total)}</span></div>
              <div className="flex justify-between"><span>Paid</span><span>{formatCurrency(data.amount_paid)}</span></div>
              <div className="flex justify-between text-lg font-semibold"><span>Amount due</span><span>{formatCurrency(data.amount_due)}</span></div>
            </div>
          </CardContent>
        </Card>

        {!data.is_paid && !data.is_expired && (
          <Card>
            <CardHeader><CardTitle>Pay by card</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Card payments include a {data.payment_options?.card_surcharge_rate || 2}% surcharge.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {full?.available !== false && (
                  <button
                    type="button"
                    onClick={() => setSelectedPayment('full')}
                    className={`rounded-lg border p-4 text-left transition ${selectedPayment === 'full' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
                  >
                    <div className="font-medium">Pay full amount</div>
                    <div className="text-sm text-muted-foreground">Base: {formatCurrency(full?.base_amount)}</div>
                    <div className="text-sm text-muted-foreground">Surcharge: {formatCurrency(full?.surcharge_amount)}</div>
                    <div className="mt-1 font-semibold">{formatCurrency(full?.total)}</div>
                  </button>
                )}
                {half?.available !== false && (
                  <button
                    type="button"
                    onClick={() => setSelectedPayment('half')}
                    className={`rounded-lg border p-4 text-left transition ${selectedPayment === 'half' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
                  >
                    <div className="font-medium">Pay 50% deposit</div>
                    <div className="text-sm text-muted-foreground">Base: {formatCurrency(half?.base_amount)}</div>
                    <div className="text-sm text-muted-foreground">Surcharge: {formatCurrency(half?.surcharge_amount)}</div>
                    <div className="mt-1 font-semibold">{formatCurrency(half?.total)}</div>
                  </button>
                )}
              </div>
              <Button className="w-full" size="lg" onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending}>
                <CreditCard className="mr-2 h-4 w-4" /> {checkoutMutation.isPending ? 'Redirecting...' : 'Pay securely'}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending}>
            <Download className="mr-2 h-4 w-4" /> Download {data.type === 'estimate' ? 'estimate' : 'invoice'}
          </Button>
        </div>

        {data.terms && (
          <Card>
            <CardHeader><CardTitle>Terms</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.terms}</p></CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
