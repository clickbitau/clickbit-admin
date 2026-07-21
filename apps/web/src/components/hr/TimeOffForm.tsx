'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createTimeOff, fetchEmployees } from '@/lib/api';
import type { Employee } from '@clickbit/shared';
import { Plus } from 'lucide-react';

const leaveTypes = ['annual', 'sick', 'personal', 'unpaid', 'bereavement', 'maternity', 'paternity', 'study', 'jury_duty', 'other'];
const partialDayTypes = ['morning', 'afternoon', 'custom'];

interface TimeOffFormProps {
  token: string;
  onSuccess?: (timeOff: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function TimeOffForm({ token, onSuccess, onCancel, initial }: TimeOffFormProps) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Record<string, any>>({
    employee_id: '',
    leave_type: 'annual',
    start_date: today,
    end_date: today,
    is_partial_day: false,
    partial_day_type: '',
    partial_start_time: '',
    partial_end_time: '',
    reason: '',
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
    mutationFn: () => createTimeOff(token, {
      employee_id: form.employee_id ? Number(form.employee_id) : undefined,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      is_partial_day: !!form.is_partial_day,
      partial_day_type: form.partial_day_type || undefined,
      partial_start_time: form.partial_start_time || undefined,
      partial_end_time: form.partial_end_time || undefined,
      reason: form.reason,
      notes: form.notes,
    }),
    onSuccess: (data: any) => {
      toast.success('Time off request created');
      queryClient.invalidateQueries({ queryKey: ['time-off'] });
      onSuccess?.(data?.data ?? data);
    },
    onError: () => toast.error('Failed to create time off request'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Employee</Label>
        {loadingEmployees ? <Skeleton className="h-10 w-full" /> : (
          <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Select employee</option>
            {employees.map((e: Employee) => <option key={e.id} value={String(e.id)}>{e.user?.first_name} {e.user?.last_name} ({e.employee_number || e.id})</option>)}
          </select>
        )}
      </div>
      <div><Label>Leave type</Label>
        <select value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {leaveTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 md:col-span-2 text-sm">
        <input type="checkbox" id="partial" checked={form.is_partial_day} onChange={(e) => setForm({ ...form, is_partial_day: e.target.checked })} />
        <label htmlFor="partial">Partial day</label>
      </div>
      {form.is_partial_day && (
        <>
          <div><Label>Partial day type</Label>
            <select value={form.partial_day_type} onChange={(e) => setForm({ ...form, partial_day_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Select</option>
              {partialDayTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>Partial start time</Label><Input type="time" value={form.partial_start_time} onChange={(e) => setForm({ ...form, partial_start_time: e.target.value })} /></div>
          <div><Label>Partial end time</Label><Input type="time" value={form.partial_end_time} onChange={(e) => setForm({ ...form, partial_end_time: e.target.value })} /></div>
        </>
      )}
      <div><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
      <div><Label>End date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.employee_id && form.start_date && form.end_date && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Request
        </Button>
      </div>
    </div>
  );
}
