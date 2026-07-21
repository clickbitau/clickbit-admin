'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createManualTimesheet, fetchEmployees } from '@/lib/api';
import { Plus } from 'lucide-react';

interface TimesheetFormProps {
  token: string;
  onSuccess?: (timesheet: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function TimesheetForm({ token, onSuccess, onCancel, initial }: TimesheetFormProps) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    employee_id: '',
    clock_in_time: `${today}T09:00`,
    clock_out_time: `${today}T17:00`,
    break_minutes: 30,
    reason: 'Manual entry',
    notes: '',
    ...initial,
  });

  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees', token],
    queryFn: () => fetchEmployees(token),
    enabled: !!token,
  });

  const employees = employeesData?.data ?? [];

  const mutation = useMutation({
    mutationFn: () => createManualTimesheet(token, {
      employee_id: form.employee_id || undefined,
      clock_in_time: new Date(form.clock_in_time).toISOString(),
      clock_out_time: form.clock_out_time ? new Date(form.clock_out_time).toISOString() : undefined,
      break_minutes: Number(form.break_minutes || 0),
      reason: form.reason,
      notes: form.notes,
    }),
    onSuccess: (data: any) => {
      toast.success('Timesheet entry created');
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      onSuccess?.(data?.timesheet ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create timesheet entry'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Employee</Label>
        {loadingEmployees ? <Skeleton className="h-10 w-full" /> : (
          <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Select employee</option>
            {employees.map((e: any) => <option key={e.id} value={String(e.id)}>{e.user?.first_name} {e.user?.last_name} ({e.employee_number || e.id})</option>)}
          </select>
        )}
      </div>
      <div><Label>Clock in</Label><Input type="datetime-local" value={form.clock_in_time} onChange={(e) => setForm({ ...form, clock_in_time: e.target.value })} /></div>
      <div><Label>Clock out</Label><Input type="datetime-local" value={form.clock_out_time} onChange={(e) => setForm({ ...form, clock_out_time: e.target.value })} /></div>
      <div><Label>Break minutes</Label><Input type="number" value={form.break_minutes} onChange={(e) => setForm({ ...form, break_minutes: e.target.value ? Number(e.target.value) : 0 })} /></div>
      <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.clock_in_time && form.reason && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Entry
        </Button>
      </div>
    </div>
  );
}
