'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { createInvoice } from '@/lib/api';
import type { Invoice, InvoiceLineItem } from '@/types/finance';
import { ArrowLeft, DollarSign, Plus, Save } from 'lucide-react';

const docTypes = ['invoice', 'estimate', 'quote', 'package'];
const taxTypes = ['gst_included', 'gst_calculated', 'no_gst'];

export default function AdminNewInvoicePage() {
  const { token } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<Partial<Invoice>>({
    document_type: 'invoice',
    tax_type: 'gst_included',
    tax_rate: 10,
    currency: 'AUD',
    line_items: [{ name: '', description: '', quantity: 1, unit_price: 0, total: 0 }],
  });

  const createMutation = useMutation({
    mutationFn: () => createInvoice(token!, form),
    onSuccess: (data: any) => {
      toast.success('Invoice created');
      const id = data?.invoice?.id || data?.data?.id || data?.id;
      router.push(id ? `/admin/finance/invoices/${id}` : '/admin/finance/invoices');
    },
    onError: () => toast.error('Failed to create invoice'),
  });

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    const items = [...(form.line_items || [])];
    items[index] = { ...items[index], [field]: value } as InvoiceLineItem;
    if (field === 'quantity' || field === 'unit_price') {
      const qty = Number(items[index].quantity) || 0;
      const price = Number(items[index].unit_price) || 0;
      items[index] = { ...items[index], total: qty * price } as InvoiceLineItem;
    }
    setForm({ ...form, line_items: items });
  };

  const removeLineItem = (index: number) => {
    const items = [...(form.line_items || [])];
    items.splice(index, 1);
    setForm({ ...form, line_items: items });
  };

  const addLineItem = () => {
    setForm({ ...form, line_items: [...(form.line_items || []), { name: '', description: '', quantity: 1, unit_price: 0, total: 0 }] });
  };

  const totals = () => {
    const subtotal = (form.line_items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const taxRate = Number(form.tax_rate) || 0;
    const tax = form.tax_type === 'gst_included' ? subtotal - subtotal / (1 + taxRate / 100) : subtotal * (taxRate / 100);
    const total = form.tax_type === 'gst_included' ? subtotal : subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleSubmit = () => {
    const { subtotal, tax, total } = totals();
    createMutation.mutate({
      ...form,
      subtotal,
      tax_amount: tax,
      total_amount: total,
    } as any);
  };

  return (
    <PageShell
      title="New Invoice"
      icon={DollarSign}
      description="Create a new invoice, estimate, quote or package"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/finance/invoices"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Client & Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>Client name</Label><Input value={form.client_name || ''} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
              <div><Label>Client email</Label><Input type="email" value={form.client_email || ''} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></div>
              <div><Label>Client company</Label><Input value={form.client_company || ''} onChange={(e) => setForm({ ...form, client_company: e.target.value })} /></div>
              <div><Label>Client phone</Label><Input value={form.client_phone || ''} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Title</Label><Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Document type</Label>
                <select value={form.document_type || 'invoice'} onChange={(e) => setForm({ ...form, document_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {docTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><Label>Tax type</Label>
                <select value={form.tax_type || 'gst_included'} onChange={(e) => setForm({ ...form, tax_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {taxTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><Label>Tax rate %</Label><Input type="number" value={form.tax_rate || ''} onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })} /></div>
              <div><Label>Valid until</Label><Input type="date" value={form.valid_until || ''} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div className="md:col-span-2"><Label>Terms</Label><Textarea value={form.terms || ''} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={3} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(form.line_items || []).map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2"><Input value={item.name} onChange={(e) => updateLineItem(idx, 'name', e.target.value)} className="h-8" /></td>
                        <td className="px-3 py-2"><Input value={item.description || ''} onChange={(e) => updateLineItem(idx, 'description', e.target.value)} className="h-8" /></td>
                        <td className="px-3 py-2"><Input type="number" value={item.quantity} onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))} className="h-8 text-right" /></td>
                        <td className="px-3 py-2"><Input type="number" value={item.unit_price} onChange={(e) => updateLineItem(idx, 'unit_price', Number(e.target.value))} className="h-8 text-right" /></td>
                        <td className="px-3 py-2 text-right">${(Number(item.total) || 0).toFixed(2)}</td>
                        <td className="px-3 py-2"><Button variant="ghost" size="sm" onClick={() => removeLineItem(idx)}>✕</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" className="mt-2" onClick={addLineItem}><Plus className="mr-1 h-4 w-4" /> Add item</Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>${totals().subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>${totals().tax.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>${totals().total.toFixed(2)}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent>
              <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending}>
                <Save className="mr-2 h-4 w-4" /> Create {form.document_type || 'invoice'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
