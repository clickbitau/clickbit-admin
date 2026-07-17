'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HandCoins, Plus, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createStaffAdvance, fetchEmployees } from '@/lib/api';
import { toast } from 'sonner';

export default function NewStaffAdvancePage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [advanceType, setAdvanceType] = useState<'asset' | 'cash' | 'loan'>('cash');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const employeesQuery = useQuery({
    queryKey: ['employees', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployees(token, { limit: 250 });
    },
    enabled: !!token,
  });

  const mutation = useMutation({
    mutationFn: () => createStaffAdvance(token!, {
      employee_id: Number(employeeId),
      title,
      description,
      total_amount: Number(amount),
      advance_type: advanceType,
      advance_date: advanceDate,
      notes,
    }),
    onSuccess: (res) => {
      toast.success('Advance created');
      queryClient.invalidateQueries({ queryKey: ['staff-advances'] });
      router.push(`/admin/finance/staff-advances/${res.data.id}`);
    },
    onError: () => toast.error('Failed to create advance'),
  });

  const employees = employeesQuery.data?.data ?? [];

  const valid = employeeId && title.trim() && Number(amount) > 0;

  return (
    <PageShell
      title="New Staff Advance"
      icon={HandCoins}
      description="Create an employee advance, loan or asset advance"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/finance/staff-advances"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Label htmlFor="employee">Employee</Label>
          <select id="employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Select employee</option>
            {employees.map((e: any) => {
              const name = e.user ? `${e.user.first_name || ''} ${e.user.last_name || ''}`.trim() : `Employee #${e.id}`;
              return <option key={e.id} value={e.id}>{name}</option>;
            })}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pay advance - June" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Advance Type</Label>
            <select id="type" value={advanceType} onChange={(e) => setAdvanceType(e.target.value as any)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="cash">Cash</option>
              <option value="asset">Asset</option>
              <option value="loan">Loan</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amount">Total Amount</Label>
            <Input id="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Advance Date</Label>
            <Input id="date" type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild><Link href="/admin/finance/staff-advances">Cancel</Link></Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}><Plus className="mr-1 h-4 w-4" /> Create</Button>
        </div>
      </div>
    </PageShell>
  );
}
