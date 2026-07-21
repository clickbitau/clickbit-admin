'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createShift, fetchEmployees } from '@/lib/api';
import type { Shift } from '@/types/hr';
import { Plus } from 'lucide-react';

const shiftTypes = ['regular', 'overtime', 'weekend', 'public_holiday', 'on_call', 'training'];

interface ShiftFormProps {
  token: string;
  onSuccess?: (shift: Shift) => void;
  onCancel?: () => void;
  initial?: Partial<Shift>;
}

export function ShiftForm({ token, onSuccess, onCancel, initial }: ShiftFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<Shift>>({
    employee_id: undefined,
    shift_date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    end_time: '17:00',
    shift_type: 'regular',
    scheduled_break_minutes: 30,
    location: '',
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
    mutationFn: () => createShift(token, {
      employee_id: String(form.employee_id || ''),
      shift_date: form.shift_date,
      start_time: form.start_time,
      end_time: form.end_time,
      shift_type: form.shift_type,
      scheduled_break_minutes: Number(form.scheduled_break_minutes || 0),
      location: form.location,
      notes: form.notes,
    }),
    onSuccess: (data: any) => {
      toast.success('Shift created');
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      onSuccess?.(data?.shift ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create shift'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Employee</Label>
        {loadingEmployees ? <Skeleton className="h-10 w-full" /> : (
          <select value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value ? Number(e.target.value) : undefined })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Select employee</option>
            {employees.map((e: any) => <option key={e.id} value={e.id}>{e.user?.first_name} {e.user?.last_name} ({e.employee_number || e.id})</option>)}
          </select>
        )}
      </div>
      <div><Label>Shift date</Label><Input type="date" value={form.shift_date || ''} onChange={(e) => setForm({ ...form, shift_date: e.target.value })} /></div>
      <div><Label>Shift type</Label>
        <select value={form.shift_type || 'regular'} onChange={(e) => setForm({ ...form, shift_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {shiftTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div><Label>Start time</Label><Input type="time" value={form.start_time || ''} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
      <div><Label>End time</Label><Input type="time" value={form.end_time || ''} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
      <div><Label>Break minutes</Label><Input type="number" value={form.scheduled_break_minutes || ''} onChange={(e) => setForm({ ...form, scheduled_break_minutes: e.target.value ? Number(e.target.value) : 0 })} /></div>
      <div><Label>Location</Label><Input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.employee_id && form.shift_date && form.start_time && form.end_time && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Shift
        </Button>
      </div>
    </div>
  );
}
