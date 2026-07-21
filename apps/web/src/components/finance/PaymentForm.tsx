'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createPayment, fetchInvoices } from '@/lib/api';
import type { Invoice, Payment } from '@clickbit/shared';
import { Plus } from 'lucide-react';

const methods = ['bank_transfer', 'credit_card', 'cash', 'cheque', 'stripe', 'paypal'];
const providers = ['manual', 'stripe', 'square', 'paypal'];

interface PaymentFormProps {
  token: string;
  onSuccess?: (payment: Payment) => void;
  onCancel?: () => void;
  initial?: Partial<Payment>;
}

export function PaymentForm({ token, onSuccess, onCancel, initial }: PaymentFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<Payment>>({
    invoice_id: undefined,
    amount: 0,
    payment_method: 'bank_transfer',
    payment_provider: 'manual',
    payment_date: new Date().toISOString().slice(0, 10),
    notes: '',
    ...initial,
  });

  const { data: invoicesData, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', token],
    queryFn: () => fetchInvoices(token),
    enabled: !!token,
  });

  const invoices = invoicesData?.invoices ?? invoicesData?.data ?? [];

  const mutation = useMutation({
    mutationFn: () => createPayment(token, {
      ...form,
      invoice_id: form.invoice_id ? Number(form.invoice_id) : undefined,
      amount: Number(form.amount || 0),
    }),
    onSuccess: (data: any) => {
      toast.success('Payment recorded');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      onSuccess?.(data?.payment ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to record payment'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Invoice</Label>
        {loadingInvoices ? <Skeleton className="h-10 w-full" /> : (
          <select value={form.invoice_id || ''} onChange={(e) => setForm({ ...form, invoice_id: e.target.value ? Number(e.target.value) : undefined })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">No invoice</option>
            {invoices.map((inv: Invoice) => <option key={inv.id} value={inv.id}>{inv.invoice_number || `Invoice ${inv.id}`} — {inv.contact?.name || inv.company?.name || 'Unknown'}</option>)}
          </select>
        )}
      </div>
      <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value ? Number(e.target.value) : 0 })} /></div>
      <div><Label>Payment date</Label><Input type="date" value={form.payment_date || ''} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div>
      <div><Label>Method</Label>
        <select value={form.payment_method || 'bank_transfer'} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {methods.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div><Label>Provider</Label>
        <select value={form.payment_provider || 'manual'} onChange={(e) => setForm({ ...form, payment_provider: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {providers.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div><Label>Transaction ID</Label><Input value={form.transaction_id || ''} onChange={(e) => setForm({ ...form, transaction_id: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.amount && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Record Payment
        </Button>
      </div>
    </div>
  );
}
