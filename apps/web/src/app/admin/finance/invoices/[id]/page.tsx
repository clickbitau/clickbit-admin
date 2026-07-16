'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  fetchInvoice,
  updateInvoice,
  sendInvoice,
  recordInvoicePayment,
  deleteInvoice,
  downloadInvoicePdf,
} from '@/lib/api';
import type { Invoice, InvoiceLineItem } from '@/types/finance';
import {
  ArrowLeft,
  DollarSign,
  Download,
  Mail,
  Trash,
  CheckCircle,
  Plus,
  Save,
} from 'lucide-react';

const statuses = ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'];
const docTypes = ['invoice', 'estimate', 'quote', 'package'];
const taxTypes = ['gst_included', 'gst_calculated', 'no_gst'];

export default function AdminInvoiceDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<Invoice>>({});
  const [paymentAmount, setPaymentAmount] = useState('');

  const { data, isLoading, error } = useQuery<Invoice>({
    queryKey: ['invoice', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchInvoice(token, id);
    },
    enabled: !!token && !!id,
  });

  const invoice = data;

  useEffect(() => {
    if (invoice) setForm(invoice);
  }, [invoice]);

  const formatCurrency = (value: number | string | undefined) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: invoice?.currency || 'AUD' }).format(Number(value ?? 0));

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Invoice>) => updateInvoice(token!, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', token, id] });
      toast.success('Invoice updated');
      setIsEditing(false);
    },
    onError: () => toast.error('Failed to update invoice'),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendInvoice(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', token, id] });
      toast.success('Invoice sent');
    },
    onError: () => toast.error('Failed to send invoice'),
  });

  const paidMutation = useMutation({
    mutationFn: () => fetch(`/api/invoices/${id}/mark-paid`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } } as any).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', token, id] });
      toast.success('Marked as paid');
    },
    onError: () => toast.error('Failed to mark as paid'),
  });

  const recordMutation = useMutation({
    mutationFn: (amount: number) => recordInvoicePayment(token!, id, { amount, method: 'manual' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', token, id] });
      toast.success('Payment recorded');
      setPaymentAmount('');
    },
    onError: () => toast.error('Failed to record payment'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInvoice(token!, id),
    onSuccess: () => {
      toast.success('Invoice deleted');
      router.push('/admin/finance/invoices');
    },
    onError: () => toast.error('Failed to delete invoice'),
  });

  const pdfMutation = useMutation({
    mutationFn: () => downloadInvoicePdf(token!, id),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice?.invoice_number || invoice?.package_code || 'invoice'}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onError: () => toast.error('Failed to download PDF'),
  });

  const canEdit = !['paid', 'cancelled'].includes(invoice?.status || '');

  const totals = useMemo(() => {
    const subtotal = Number(form.subtotal ?? invoice?.subtotal ?? 0);
    const tax = Number(form.tax_amount ?? invoice?.tax_amount ?? 0);
    const total = Number(form.total_amount ?? invoice?.total_amount ?? 0);
    const paid = Number(form.amount_paid ?? invoice?.amount_paid ?? 0);
    const due = Number(form.amount_due ?? invoice?.amount_due ?? total - paid);
    return { subtotal, tax, total, paid, due };
  }, [form, invoice]);

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    const items = [...(form.line_items || invoice?.line_items || [])];
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
    const items = [...(form.line_items || []), { name: '', description: '', quantity: 1, unit_price: 0, total: 0 }];
    setForm({ ...form, line_items: items });
  };

  const handleSave = () => {
    const payload: Partial<Invoice> = {
      client_name: form.client_name,
      client_email: form.client_email,
      client_company: form.client_company,
      client_phone: form.client_phone,
      title: form.title,
      description: form.description,
      terms: form.terms,
      client_notes: form.client_notes,
      status: form.status,
      document_type: form.document_type,
      tax_type: form.tax_type,
      tax_rate: Number(form.tax_rate) || 0,
      valid_until: form.valid_until,
      line_items: form.line_items,
    };
    updateMutation.mutate(payload);
  };

  if (error) {
    return (
      <PageShell title="Invoice" icon={DollarSign} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/finance/invoices"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load invoice.</div>
      </PageShell>
    );
  }

  const title = invoice ? `${invoice.invoice_number || invoice.package_code}` : 'Invoice';
  const description = invoice ? `${invoice.client_name} · ${formatCurrency(invoice.total)}` : '';

  return (
    <PageShell
      title={title}
      icon={DollarSign}
      description={description}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/finance/invoices"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} disabled={!canEdit}>Edit</Button>
          ) : (
            <Button variant="default" size="sm" onClick={handleSave} disabled={updateMutation.isPending}><Save className="mr-1 h-4 w-4" /> Save</Button>
          )}
          <Button variant="outline" size="sm" onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending}><Download className="mr-1 h-4 w-4" /> PDF</Button>
          <Button variant="outline" size="sm" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}><Mail className="mr-1 h-4 w-4" /> Send</Button>
        </div>
      }
    >
      {isLoading || !invoice ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{invoice.title || 'Untitled'}</CardTitle>
                    <p className="text-sm text-muted-foreground">{invoice.client_name} · {invoice.client_email}</p>
                  </div>
                  <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'overdue' ? 'destructive' : 'secondary'}>{invoice.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isEditing ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><Label>Client name</Label><Input value={form.client_name || ''} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
                    <div><Label>Client email</Label><Input value={form.client_email || ''} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></div>
                    <div><Label>Client company</Label><Input value={form.client_company || ''} onChange={(e) => setForm({ ...form, client_company: e.target.value })} /></div>
                    <div><Label>Client phone</Label><Input value={form.client_phone || ''} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} /></div>
                    <div className="md:col-span-2"><Label>Title</Label><Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                    <div><Label>Status</Label>
                      <Select value={form.status || ''} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Document type</Label>
                      <Select value={form.document_type || ''} onValueChange={(v) => setForm({ ...form, document_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{docTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Tax type</Label>
                      <Select value={form.tax_type || ''} onValueChange={(v) => setForm({ ...form, tax_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{taxTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Tax rate %</Label><Input type="number" value={form.tax_rate || ''} onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })} /></div>
                    <div><Label>Valid until</Label><Input type="date" value={form.valid_until ? new Date(form.valid_until).toISOString().split('T')[0] : ''} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <p><span className="text-muted-foreground">Number:</span> {invoice.invoice_number || invoice.package_code}</p>
                    <p><span className="text-muted-foreground">Type:</span> {invoice.document_type}</p>
                    <p><span className="text-muted-foreground">Status:</span> {invoice.status}</p>
                    <p><span className="text-muted-foreground">Tax:</span> {invoice.tax_type} ({invoice.tax_rate}%)</p>
                    <p><span className="text-muted-foreground">Issue date:</span> {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : '—'}</p>
                    <p><span className="text-muted-foreground">Valid until:</span> {invoice.valid_until ? new Date(invoice.valid_until).toLocaleDateString() : '—'}</p>
                  </div>
                )}

                <Separator />

                <div>
                  <h3 className="font-semibold">Line items</h3>
                  <div className="mt-3 rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Price</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          {isEditing && <th className="px-3 py-2"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(form.line_items || invoice.line_items || []).map((item, idx) => (
                          <tr key={idx} className="border-t">
                            {isEditing ? (
                              <>
                                <td className="px-3 py-2"><Input value={item.name} onChange={(e) => updateLineItem(idx, 'name', e.target.value)} className="h-8" /></td>
                                <td className="px-3 py-2"><Input value={item.description || ''} onChange={(e) => updateLineItem(idx, 'description', e.target.value)} className="h-8" /></td>
                                <td className="px-3 py-2"><Input type="number" value={item.quantity} onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))} className="h-8 text-right" /></td>
                                <td className="px-3 py-2"><Input type="number" value={item.unit_price} onChange={(e) => updateLineItem(idx, 'unit_price', Number(e.target.value))} className="h-8 text-right" /></td>
                                <td className="px-3 py-2 text-right">{formatCurrency(item.total)}</td>
                                <td className="px-3 py-2"><Button variant="ghost" size="sm" onClick={() => removeLineItem(idx)}>✕</Button></td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2 font-medium">{item.name}</td>
                                <td className="px-3 py-2 text-muted-foreground">{item.description}</td>
                                <td className="px-3 py-2 text-right">{item.quantity}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(item.total)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {isEditing && <Button variant="outline" size="sm" className="mt-2" onClick={addLineItem}><Plus className="mr-1 h-4 w-4" /> Add item</Button>}
                </div>

                <Separator />

                {isEditing ? (
                  <>
                    <div><Label>Terms</Label><Textarea value={form.terms || ''} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={3} /></div>
                    <div><Label>Client notes</Label><Textarea value={form.client_notes || ''} onChange={(e) => setForm({ ...form, client_notes: e.target.value })} rows={3} /></div>
                    <div><Label>Internal description</Label><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                  </>
                ) : (
                  <div className="space-y-4 text-sm">
                    {invoice.terms && <div><h4 className="font-medium">Terms</h4><p className="whitespace-pre-wrap">{invoice.terms}</p></div>}
                    {invoice.client_notes && <div><h4 className="font-medium">Client notes</h4><p className="whitespace-pre-wrap">{invoice.client_notes}</p></div>}
                    {invoice.description && <div><h4 className="font-medium">Description</h4><p className="whitespace-pre-wrap">{invoice.description}</p></div>}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
              <CardContent>
                {(invoice.payments || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {(invoice.payments || []).map((p: any) => (
                      <li key={p.id} className="flex justify-between border-b pb-2">
                        <span>{p.payment_method} · {p.transaction_id || 'manual'}</span>
                        <span className="font-medium">{formatCurrency(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(totals.tax)}</span></div>
                <Separator />
                <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(totals.total)}</span></div>
                <div className="flex justify-between"><span>Paid</span><span>{formatCurrency(totals.paid)}</span></div>
                <div className="flex justify-between text-destructive"><span>Due</span><span>{formatCurrency(totals.due)}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || invoice.status === 'paid'}><Mail className="mr-2 h-4 w-4" /> Send invoice</Button>
                {invoice.status !== 'paid' && (
                  <>
                    <Button className="w-full" variant="secondary" onClick={() => paidMutation.mutate()} disabled={paidMutation.isPending}><CheckCircle className="mr-2 h-4 w-4" /> Mark as paid</Button>
                    <div className="flex gap-2">
                      <Input type="number" placeholder="Amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                      <Button onClick={() => recordMutation.mutate(Number(paymentAmount))} disabled={recordMutation.isPending || !paymentAmount}>Record</Button>
                    </div>
                  </>
                )}
                <Button className="w-full" variant="outline" onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
                <Button className="w-full" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash className="mr-2 h-4 w-4" /> Delete</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
