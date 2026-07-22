'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createStaffAdvance, fetchEmployees } from '@/lib/api';
import type { StaffAdvance } from '@/types/staff-advances';
import { Plus } from 'lucide-react';

interface StaffAdvanceFormProps {
  token: string;
  onSuccess?: (advance: StaffAdvance) => void;
  onCancel?: () => void;
  initial?: Partial<StaffAdvance>;
}

export function StaffAdvanceForm({ token, onSuccess, onCancel, initial }: StaffAdvanceFormProps) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState(String(initial?.employee_id || ''));
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [amount, setAmount] = useState(String(initial?.total_amount || ''));
  const [advanceType, setAdvanceType] = useState<'asset' | 'cash' | 'loan'>((initial?.advance_type as any) || 'cash');
  const [advanceDate, setAdvanceDate] = useState((initial?.advance_date as string) || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(initial?.notes || '');

  const employeesQuery = useQuery({
    queryKey: ['employees', token],
    queryFn: async () => fetchEmployees(token, { limit: 250 }),
    enabled: !!token,
  });

  const mutation = useMutation({
    mutationFn: () => createStaffAdvance(token, {
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
      onSuccess?.(res?.data ?? res);
    },
    onError: () => toast.error('Failed to create advance'),
  });

  const employees = employeesQuery.data?.data ?? [];
  const valid = employeeId && title.trim() && Number(amount) > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="employee">Employee</Label>
        {employeesQuery.isLoading ? <Skeleton className="h-10 w-full" /> : (
          <select id="employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Select employee</option>
            {employees.map((e: any) => {
              const name = e.user ? `${e.user.first_name || ''} ${e.user.last_name || ''}`.trim() : `Employee #${e.id}`;
              return <option key={e.id} value={e.id}>{name}</option>;
            })}
          </select>
        )}
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
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}><Plus className="mr-1 h-4 w-4" /> Create</Button>
      </div>
    </div>
  );
}
