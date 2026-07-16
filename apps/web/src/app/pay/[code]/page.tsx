'use client';

import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { fetchPublicInvoice, createInvoiceCheckout, downloadPublicInvoicePdf } from '@/lib/api';
import { toast } from 'sonner';
import { Download, CreditCard, FileText } from 'lucide-react';

export default function PublicPayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = String(params.code);
  const token = searchParams.get('token') || undefined;
  const [selectedPayment, setSelectedPayment] = useState<'full' | 'half'>('full');

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-invoice', code, token],
    queryFn: () => fetchPublicInvoice(code, token),
    enabled: !!code,
  });

  const checkoutMutation = useMutation({
    mutationFn: () => createInvoiceCheckout(code, selectedPayment, token),
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
    mutationFn: () => downloadPublicInvoicePdf(code, token),
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

  const formatCurrency = (value: number | string | undefined) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: data?.currency || 'AUD' }).format(Number(value ?? 0));

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
          <CardHeader><CardTitle>Invoice not found</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">This invoice link is invalid or has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const full = data.payment_options?.full_payment;
  const half = data.payment_options?.half_payment;

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
