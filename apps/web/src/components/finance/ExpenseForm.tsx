'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createExpense } from '@/lib/api';
import type { Expense } from '@/types/finance';
import { Plus } from 'lucide-react';

const categories = ['travel', 'meals', 'office', 'software', 'hardware', 'training', 'utilities', 'other'];

interface ExpenseFormProps {
  token: string;
  onSuccess?: (expense: Expense) => void;
  onCancel?: () => void;
  initial?: Partial<Expense>;
}

export function ExpenseForm({ token, onSuccess, onCancel, initial }: ExpenseFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<Expense>>({
    description: '',
    category: 'other',
    amount: 0,
    tax_amount: 0,
    total_amount: 0,
    currency: 'AUD',
    payment_method: '',
    is_billable: false,
    is_reimbursable: false,
    status: 'draft',
    ...initial,
  });

  const mutation = useMutation({
    mutationFn: () => createExpense(token, form),
    onSuccess: (data: any) => {
      toast.success('Expense created');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      onSuccess?.(data?.expense ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create expense'),
  });

  const updateAmount = (amount: number) => {
    const tax = Number(form.tax_amount) || 0;
    setForm({ ...form, amount, total_amount: amount + tax });
  };

  const updateTax = (tax: number) => {
    const amount = Number(form.amount) || 0;
    setForm({ ...form, tax_amount: tax, total_amount: amount + tax });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Description</Label><Input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div><Label>Category</Label>
        <select value={form.category || 'other'} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div><Label>Amount</Label><Input type="number" value={form.amount ?? ''} onChange={(e) => updateAmount(Number(e.target.value))} /></div>
      <div><Label>Tax</Label><Input type="number" value={form.tax_amount ?? ''} onChange={(e) => updateTax(Number(e.target.value))} /></div>
      <div><Label>Total</Label><Input type="number" value={form.total_amount ?? ''} onChange={(e) => setForm({ ...form, total_amount: Number(e.target.value) })} /></div>
      <div><Label>Currency</Label><Input value={form.currency || 'AUD'} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
      <div><Label>Payment method</Label><Input value={form.payment_method || ''} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} /></div>
      <div><Label>Expense date</Label><Input type="date" value={form.expense_date ? new Date(form.expense_date).toISOString().split('T')[0] : ''} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
      <div className="flex items-center gap-2"><input type="checkbox" checked={!!form.is_billable} onChange={(e) => setForm({ ...form, is_billable: e.target.checked })} id="billable" /><Label htmlFor="billable">Billable</Label></div>
      <div className="flex items-center gap-2"><input type="checkbox" checked={!!form.is_reimbursable} onChange={(e) => setForm({ ...form, is_reimbursable: e.target.checked })} id="reimbursable" /><Label htmlFor="reimbursable">Reimbursable</Label></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Expense
        </Button>
      </div>
    </div>
  );
}
