'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { fetchExpense, updateExpense, deleteExpense } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Expense } from '@/types/finance';
import { ArrowLeft, Wallet, Save, Trash, DollarSign, FileText, Folder, Building2, User, Receipt, CheckCircle, XCircle } from 'lucide-react';

const statuses = ['draft', 'pending', 'approved', 'rejected', 'reimbursed'];
const categories = ['travel', 'meals', 'office', 'software', 'hardware', 'training', 'utilities', 'other'];

export default function AdminExpenseDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<Expense>>({});

  const { data, isLoading, error } = useQuery<{ success: boolean; data: Expense }>({
    queryKey: ['expense', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchExpense(token!, id);
    },
    enabled: !!token && !!id,
  });

  const expense = data?.data;

  useEffect(() => {
    if (expense) setForm(expense);
  }, [expense]);

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Expense>) => updateExpense(token!, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', token, id] });
      toast.success('Expense updated');
      setIsEditing(false);
    },
    onError: () => toast.error('Failed to update expense'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteExpense(token!, id),
    onSuccess: () => {
      toast.success('Expense deleted');
      router.push('/admin/finance/expenses');
    },
    onError: () => toast.error('Failed to delete expense'),
  });

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  if (error) {
    return (
      <PageShell title="Expense" icon={Wallet} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/finance/expenses"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load expense.</div>
      </PageShell>
    );
  }

  const title = expense ? `${expense.expense_number || `#${expense.id}`}` : 'Expense';
  const description = expense ? `${expense.description || 'No description'} · ${formatCurrency(expense.total_amount, expense.currency)}` : '';

  return (
    <PageShell
      title={title}
      icon={Wallet}
      description={description}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/finance/expenses"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
          ) : (
            <Button variant="default" size="sm" onClick={handleSave} disabled={updateMutation.isPending}><Save className="mr-1 h-4 w-4" /> Save</Button>
          )}
        </div>
      }
    >
      {isLoading || !expense ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <StatCards
            cards={[
              { label: 'Amount', value: formatCurrency(expense.amount, expense.currency), icon: DollarSign, accent: 'primary' },
              { label: 'Tax', value: formatCurrency(expense.tax_amount, expense.currency), icon: DollarSign, accent: 'secondary' },
              { label: 'Total', value: formatCurrency(expense.total_amount, expense.currency), icon: DollarSign, accent: 'primary' },
              { label: 'Status', value: expense.status || 'draft', icon: expense.status === 'approved' || expense.status === 'reimbursed' ? CheckCircle : XCircle, accent: expense.status === 'approved' || expense.status === 'reimbursed' ? 'success' : 'warning' },
            ]}
          />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{expense.description || 'Expense'}</CardTitle>
                      <p className="text-sm text-muted-foreground">{expense.expense_number || `#${expense.id}`} · {expense.category || 'Uncategorised'}</p>
                    </div>
                    <Badge variant={expense.status === 'approved' || expense.status === 'reimbursed' ? 'default' : expense.status === 'rejected' ? 'destructive' : 'secondary'}>{expense.status || 'draft'}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isEditing ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2"><Label>Description</Label><Input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                      <div>
                        <Label>Category</Label>
                        <select value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                          <option value="">Select...</option>
                          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <select value={form.status || ''} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div><Label>Amount</Label><Input type="number" value={form.amount ?? ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                      <div><Label>Tax</Label><Input type="number" value={form.tax_amount ?? ''} onChange={(e) => setForm({ ...form, tax_amount: Number(e.target.value) })} /></div>
                      <div><Label>Total</Label><Input type="number" value={form.total_amount ?? ''} onChange={(e) => setForm({ ...form, total_amount: Number(e.target.value) })} /></div>
                      <div><Label>Expense date</Label><Input type="date" value={form.expense_date ? new Date(form.expense_date).toISOString().split('T')[0] : ''} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
                      <div><Label>Payment method</Label><Input value={form.payment_method || ''} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} /></div>
                      <div className="flex items-center gap-2"><input type="checkbox" checked={!!form.is_billable} onChange={(e) => setForm({ ...form, is_billable: e.target.checked })} id="billable" /><Label htmlFor="billable">Billable</Label></div>
                      <div className="flex items-center gap-2"><input type="checkbox" checked={!!form.is_reimbursable} onChange={(e) => setForm({ ...form, is_reimbursable: e.target.checked })} id="reimbursable" /><Label htmlFor="reimbursable">Reimbursable</Label></div>
                    </div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2 text-sm">
                      <p><span className="text-muted-foreground">Description:</span> {expense.description || '—'}</p>
                      <p><span className="text-muted-foreground">Category:</span> {expense.category || '—'}</p>
                      <p><span className="text-muted-foreground">Status:</span> {expense.status || 'draft'}</p>
                      <p><span className="text-muted-foreground">Payment method:</span> {expense.payment_method || '—'}</p>
                      <p><span className="text-muted-foreground">Amount:</span> {formatCurrency(expense.amount, expense.currency)}</p>
                      <p><span className="text-muted-foreground">Tax:</span> {formatCurrency(expense.tax_amount, expense.currency)}</p>
                      <p><span className="text-muted-foreground">Total:</span> {formatCurrency(expense.total_amount, expense.currency)}</p>
                      <p><span className="text-muted-foreground">Expense date:</span> {formatDate(expense.expense_date)}</p>
                      <p><span className="text-muted-foreground">Billable:</span> {expense.is_billable ? 'Yes' : 'No'}</p>
                      <p><span className="text-muted-foreground">Reimbursable:</span> {expense.is_reimbursable ? 'Yes' : 'No'}</p>
                      {expense.vendor && <p><span className="text-muted-foreground">Vendor:</span> {expense.vendor.name}</p>}
                      {expense.employee && <p><span className="text-muted-foreground">Employee:</span> {(expense.employee as any).user?.first_name || ''} {(expense.employee as any).user?.last_name || ''}</p>}
                    </div>
                  )}

                  {expense.notes && (
                    <>
                      <Separator />
                      <div><h4 className="font-medium mb-1">Notes</h4><p className="whitespace-pre-wrap text-sm text-muted-foreground">{expense.notes}</p></div>
                    </>
                  )}

                  <Separator />

                  <div className="flex justify-end">
                    <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash className="mr-2 h-4 w-4" /> Delete expense</Button>
                  </div>
                </CardContent>
              </Card>

              {expense.linkedReceipts && (expense.linkedReceipts as any[]).length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Receipts</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      {(expense.linkedReceipts as any[]).map((r: any) => (
                        <li key={r.id} className="flex items-center justify-between border-b pb-2">
                          <span className="flex items-center gap-2"><Receipt className="w-4 h-4 text-muted-foreground" /> {r.file_name || `Receipt #${r.id}`}</span>
                          {r.file_url ? (
                            <Button variant="outline" size="sm" asChild><a href={r.file_url} target="_blank" rel="noreferrer">View</a></Button>
                          ) : (
                            <span className="text-muted-foreground">{formatCurrency(r.total_amount, expense.currency)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Related</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {expense.invoice ? (
                    <Link href={`/admin/finance/invoices/${expense.invoice.id}`} className="flex items-center gap-3 hover:underline">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><FileText className="w-4 h-4 text-gray-600 dark:text-gray-300" /></div>
                      <div className="min-w-0"><p className="font-medium truncate">{expense.invoice.title || expense.invoice.package_code || `#${expense.invoice.id}`}</p><p className="text-xs text-muted-foreground">Invoice</p></div>
                    </Link>
                  ) : (
                    <p className="text-muted-foreground">No linked invoice.</p>
                  )}
                  {expense.deal && (
                    <Link href={`/admin/crm/deals/${expense.deal.id}`} className="flex items-center gap-3 hover:underline">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><DollarSign className="w-4 h-4 text-gray-600 dark:text-gray-300" /></div>
                      <div className="min-w-0"><p className="font-medium truncate">{expense.deal.title}</p><p className="text-xs text-muted-foreground">Deal</p></div>
                    </Link>
                  )}
                  {expense.crmProject && (
                    <Link href={`/admin/crm/projects/${expense.crmProject.id}`} className="flex items-center gap-3 hover:underline">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Folder className="w-4 h-4 text-gray-600 dark:text-gray-300" /></div>
                      <div className="min-w-0"><p className="font-medium truncate">{expense.crmProject.name}</p><p className="text-xs text-muted-foreground">{expense.crmProject.project_number || 'Project'}</p></div>
                    </Link>
                  )}
                  {expense.vendor && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Building2 className="w-4 h-4 text-gray-600 dark:text-gray-300" /></div>
                      <div className="min-w-0"><p className="font-medium truncate">{expense.vendor.name}</p><p className="text-xs text-muted-foreground">Vendor</p></div>
                    </div>
                  )}
                  {expense.employee && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><User className="w-4 h-4 text-gray-600 dark:text-gray-300" /></div>
                      <div className="min-w-0"><p className="font-medium truncate">{(expense.employee as any).user?.first_name || ''} {(expense.employee as any).user?.last_name || ''}</p><p className="text-xs text-muted-foreground">Employee</p></div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>People</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Created by</span><span>{expense.creator ? `${expense.creator.first_name} ${expense.creator.last_name}` : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Approver</span><span>{expense.approver ? `${expense.approver.first_name} ${expense.approver.last_name}` : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Reimbursed to</span><span>{expense.reimbursedToUser ? `${expense.reimbursedToUser.first_name} ${expense.reimbursedToUser.last_name}` : '-'}</span></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
